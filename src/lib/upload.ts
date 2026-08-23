import { extname } from "node:path";
import { z } from "zod";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const extensions = new Set([".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff", ".webp", ".pdf", ".ofd"]);
const mimeTypes = new Set([
  "image/png", "image/jpeg", "image/bmp", "image/gif", "image/tiff", "image/webp",
  "application/pdf", "application/ofd", "application/vnd.ofd", "application/octet-stream",
]);

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function validateFile(file: File) {
  if (!extensions.has(extname(file.name).toLowerCase())) {
    throw new UploadValidationError("不支持该文件格式，请上传 PNG、JPG、BMP、GIF、TIFF、WebP、PDF 或 OFD 文件。");
  }
  if (file.type && !mimeTypes.has(file.type.toLowerCase())) {
    throw new UploadValidationError("文件类型与支持的发票格式不匹配。");
  }
  if (file.size === 0) throw new UploadValidationError("上传文件不能为空。");
  if (file.size > MAX_FILE_SIZE) throw new UploadValidationError("文件大小不能超过 10 MB。");
}

export function parsePageNo(value: FormDataEntryValue | null) {
  if (value === null || value === "") return 1;
  if (typeof value !== "string") throw new UploadValidationError("页码格式不正确。");
  const parsed = z.coerce.number().int().min(1).max(9999).safeParse(value);
  if (!parsed.success) throw new UploadValidationError("页码必须是 1 到 9999 之间的整数。");
  return parsed.data;
}
