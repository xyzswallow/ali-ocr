import { beforeEach, describe, expect, it, vi } from "vitest";

const { recognizeMock } = vi.hoisted(() => ({ recognizeMock: vi.fn() }));

vi.mock("@/lib/ocr", () => {
  class OcrServiceError extends Error {}
  return {
    OcrServiceError,
    recognizeInvoice: recognizeMock,
  };
});

import { POST } from "@/app/api/recognize/route";
import { GET as listRecords } from "@/app/api/records/route";
import { GET as getRecord } from "@/app/api/records/[id]/route";

function uploadRequest(file?: File, pageNo?: string) {
  const data = new FormData();
  if (file) data.set("file", file);
  if (pageNo) data.set("pageNo", pageNo);
  return new Request("http://localhost/api/recognize", { method: "POST", body: data });
}

describe("invoice API routes", () => {
  beforeEach(() => {
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
    const file = new File([new Uint8Array([137, 80, 78, 71])], "invoice.png", { type: "image/png" });
    const response = await POST(uploadRequest(file));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result).toMatchObject({ requestId: "request-001", recordId: expect.any(String) });
    expect(recognizeMock).toHaveBeenCalledOnce();

    const listResponse = await listRecords(new Request("http://localhost/api/records?limit=10"));
    const list = await listResponse.json();
    expect(list.records[0]).toMatchObject({ id: result.recordId, status: "success", fileName: "invoice.png" });

    const detailResponse = await getRecord(new Request("http://localhost"), {
      params: Promise.resolve({ id: result.recordId }),
    });
    const detail = await detailResponse.json();
    expect(detail.data.data.invoiceNumber).toBe("12345678");
  });

  it("returns 404 for a missing history record", async () => {
    const response = await getRecord(new Request("http://localhost"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
  });
});
