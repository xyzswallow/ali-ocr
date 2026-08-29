export type JsonObject = Record<string, unknown>;

export interface RecognizeResult {
  recordId: string;
  requestId: string | null;
  data: JsonObject;
  rawResponse: JsonObject;
}

export interface InvoiceRecordSummary {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "processing" | "success" | "failed";
  requestId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface InvoiceRecord extends InvoiceRecordSummary {
  data: JsonObject | null;
  rawResponse: JsonObject | null;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "member" | "admin";
  createdAt: string;
}

export interface UserWithHash extends User {
  passwordHash: string;
}

/** 下发到客户端的用户 DTO，不含 id、role 与密码哈希。 */
export type SessionUser = Pick<User, "email" | "displayName">;
