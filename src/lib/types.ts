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
