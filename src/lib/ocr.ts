import { Readable } from "node:stream";
import OcrApi, { RecognizeInvoiceRequest } from "@alicloud/ocr-api20210707";
import { Config } from "@alicloud/openapi-client";
import type { JsonObject } from "@/lib/types";

export class OcrServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrServiceError";
  }
}

function createClient() {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  const regionId = process.env.ALIBABA_CLOUD_REGION_ID || "cn-hangzhou";
  if (!accessKeyId || !accessKeySecret) {
    throw new OcrServiceError("服务端尚未配置阿里云 AccessKey，请检查环境变量。");
  }
  return new OcrApi(new Config({
    accessKeyId,
    accessKeySecret,
    regionId,
    endpoint: "ocr-api.cn-hangzhou.aliyuncs.com",
  }));
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) return "阿里云 OCR 服务调用失败。";
  const sdkError = error as Error & { code?: string; statusCode?: number; data?: { Message?: string; message?: string } };
  if (sdkError.code === "InvalidAccessKeyId.NotFound" || sdkError.statusCode === 401) {
    return "阿里云 AccessKey 无效或已失效，请检查服务端配置。";
  }
  if (sdkError.code === "Forbidden" || sdkError.statusCode === 403) {
    return "当前阿里云账号没有发票识别权限，请检查 RAM 授权和 OCR 服务状态。";
  }
  if (sdkError.code === "ENOTFOUND" || sdkError.message.includes("getaddrinfo")) {
    return "无法连接阿里云 OCR 服务，请检查网络或服务端点配置。";
  }
  const detail = sdkError.data?.Message || sdkError.data?.message || sdkError.message;
  return detail ? `阿里云 OCR 识别失败：${detail}` : "阿里云 OCR 服务调用失败。";
}

export async function recognizeInvoice(buffer: Buffer, pageNo = 1) {
  try {
    const response = await createClient().recognizeInvoice(new RecognizeInvoiceRequest({
      body: Readable.from([buffer]),
      pageNo,
    }));
    const body = response.body;
    if (!body) throw new OcrServiceError("阿里云 OCR 未返回响应内容。");
    if (body.code && body.code !== "200") throw new OcrServiceError(body.message || `阿里云 OCR 返回错误：${body.code}`);
    if (!body.data) throw new OcrServiceError("阿里云 OCR 未返回识别数据。");
    let data: JsonObject;
    try {
      data = JSON.parse(body.data) as JsonObject;
    } catch {
      throw new OcrServiceError("阿里云 OCR 返回的数据格式无法解析。");
    }
    const rawResponse: JsonObject = {
      statusCode: response.statusCode,
      requestId: body.requestId,
      code: body.code,
      message: body.message,
      data,
    };
    return { requestId: body.requestId || null, data, rawResponse };
  } catch (error) {
    if (error instanceof OcrServiceError) throw error;
    throw new OcrServiceError(describeError(error));
  }
}
