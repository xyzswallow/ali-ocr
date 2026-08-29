import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { completeInvoiceRecord, createInvoiceRecord, failInvoiceRecord } from "@/lib/db";
import { OcrServiceError, recognizeInvoice } from "@/lib/ocr";
import { parsePageNo, UploadValidationError, validateFile } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failure = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return failure("请求格式不正确，请以表单方式上传发票文件。", 400); }

  const file = formData.get("file");
  if (!(file instanceof File)) return failure("请选择需要识别的发票文件。", 400);

  let pageNo: number;
  try {
    validateFile(file);
    pageNo = parsePageNo(formData.get("pageNo"));
  } catch (error) {
    return failure(error instanceof UploadValidationError ? error.message : "上传参数不正确。", 400);
  }

  let recordId: string;
  try { recordId = createInvoiceRecord(userId, file); }
  catch { return failure("无法创建识别记录，请检查 SQLite 数据目录。", 500); }

  try {
    const result = await recognizeInvoice(Buffer.from(await file.arrayBuffer()), pageNo);
    completeInvoiceRecord(userId, recordId, result.requestId, result.data, result.rawResponse);
    return NextResponse.json({ recordId, ...result });
  } catch (error) {
    const message = error instanceof OcrServiceError ? error.message : "发票识别失败，请稍后重试。";
    try { failInvoiceRecord(userId, recordId, message); } catch { /* Preserve the OCR error. */ }
    return failure(message, error instanceof OcrServiceError ? 502 : 500);
  }
}
