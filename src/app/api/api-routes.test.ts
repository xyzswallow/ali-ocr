import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { recognizeMock, cookieState } = vi.hoisted(() => ({
  recognizeMock: vi.fn(),
  cookieState: { token: undefined as string | undefined },
}));

vi.mock("@/lib/ocr", () => {
  class OcrServiceError extends Error {}
  return {
    OcrServiceError,
    recognizeInvoice: recognizeMock,
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "ali_ocr_session" && cookieState.token ? { value: cookieState.token } : undefined,
  }),
}));

import { POST } from "@/app/api/recognize/route";
import { GET as listRecords } from "@/app/api/records/route";
import { GET as getRecord } from "@/app/api/records/[id]/route";
import { createSession, createUser } from "@/lib/users";

function uploadRequest(file?: File, pageNo?: string) {
  const data = new FormData();
  if (file) data.set("file", file);
  if (pageNo) data.set("pageNo", pageNo);
  return new Request("http://localhost/api/recognize", { method: "POST", body: data });
}

const listRequest = () => new Request("http://localhost/api/records?limit=10");
const detailRequest = (id: string) =>
  getRecord(new Request("http://localhost"), { params: Promise.resolve({ id }) });

const pngFile = () => new File([new Uint8Array([137, 80, 78, 71])], "invoice.png", { type: "image/png" });

let tokenA = "";
let tokenB = "";

describe("invoice API routes", () => {
  beforeAll(() => {
    tokenA = createSession(createUser("tester@example.com", "password123", "测试用户").id).token;
    tokenB = createSession(createUser("other@example.com", "password123", "另一个用户").id).token;
  });

  beforeEach(() => {
    cookieState.token = tokenA;
    recognizeMock.mockReset();
    recognizeMock.mockResolvedValue({
      requestId: "request-001",
      data: { data: { invoiceNumber: "12345678", totalAmount: "108.00" } },
      rawResponse: { statusCode: 200, requestId: "request-001" },
    });
  });

  it("rejects a missing file", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("rejects unsupported files and invalid page numbers", async () => {
    const wrongType = await POST(uploadRequest(new File(["text"], "invoice.txt", { type: "text/plain" })));
    expect(wrongType.status).toBe(400);

    const invalidPage = await POST(uploadRequest(new File(["pdf"], "invoice.pdf", { type: "application/pdf" }), "0"));
    expect(invalidPage.status).toBe(400);
  });

  it("rejects files larger than 10 MB", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    const response = await POST(uploadRequest(file));
    expect(response.status).toBe(400);
  });

  it("recognizes, persists, lists and retrieves an invoice", async () => {
    const response = await POST(uploadRequest(pngFile()));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result).toMatchObject({ requestId: "request-001", recordId: expect.any(String) });
    expect(recognizeMock).toHaveBeenCalledOnce();

    const listResponse = await listRecords(listRequest());
    const list = await listResponse.json();
    expect(list.records[0]).toMatchObject({ id: result.recordId, status: "success", fileName: "invoice.png" });

    const detailResponse = await detailRequest(result.recordId);
    const detail = await detailResponse.json();
    expect(detail.data.data.invoiceNumber).toBe("12345678");
  });

  it("returns 404 for a missing history record", async () => {
    const response = await detailRequest("missing");
    expect(response.status).toBe(404);
  });

  it("rejects every route without a session", async () => {
    cookieState.token = undefined;
    expect((await POST(uploadRequest(pngFile()))).status).toBe(401);
    expect((await listRecords(listRequest())).status).toBe(401);
    expect((await detailRequest("any-id")).status).toBe(401);
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("hides one user's records from another", async () => {
    const created = await (await POST(uploadRequest(pngFile()))).json();

    cookieState.token = tokenB;
    const list = await (await listRecords(listRequest())).json();
    expect(list.records.some((record: { id: string }) => record.id === created.recordId)).toBe(false);

    // 越权访问按 404 返回，不泄露记录是否存在。
    expect((await detailRequest(created.recordId)).status).toBe(404);
  });
});
