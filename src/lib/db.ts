import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import type { InvoiceRecord, InvoiceRecordSummary, JsonObject } from "@/lib/types";

interface Row {
  id: string; user_id: string | null; file_name: string; mime_type: string; size_bytes: number;
  status: "processing" | "success" | "failed"; request_id: string | null;
  data_json: string | null; raw_response_json: string | null;
  error_message: string | null; created_at: string;
}

const globalForDb = globalThis as unknown as { invoiceDb?: Database.Database };

function schemaVersion(database: Database.Database) {
  return database.pragma("user_version", { simple: true }) as number;
}

function migrate(database: Database.Database) {
  if (schemaVersion(database) < 1) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS invoice_records (
        id TEXT PRIMARY KEY, file_name TEXT NOT NULL, mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('processing','success','failed')),
        request_id TEXT, data_json TEXT, raw_response_json TEXT, error_message TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_invoice_records_created_at ON invoice_records(created_at DESC);
    `);
    database.pragma("user_version = 1");
  }

  if (schemaVersion(database) < 2) {
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_user_id ON sessions(user_id);

      ALTER TABLE invoice_records ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      CREATE INDEX idx_invoice_records_user_created ON invoice_records(user_id, created_at DESC);
    `);
    database.pragma("user_version = 2");
  }
}

function openDatabase() {
  const configured = process.env.DATABASE_PATH || "./data/invoices.db";
  const filePath = configured === ":memory:"
    ? configured
    : isAbsolute(configured)
      ? configured
      : resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  migrate(database);
  return database;
}

export function getDatabase() {
  if (!globalForDb.invoiceDb) globalForDb.invoiceDb = openDatabase();
  return globalForDb.invoiceDb;
}

function summary(row: Row): InvoiceRecordSummary {
  return {
    id: row.id, fileName: row.file_name, mimeType: row.mime_type, sizeBytes: row.size_bytes,
    status: row.status, requestId: row.request_id, errorMessage: row.error_message, createdAt: row.created_at,
  };
}

function parseJson(value: string | null): JsonObject | null {
  if (!value) return null;
  try { return JSON.parse(value) as JsonObject; } catch { return null; }
}

export function createInvoiceRecord(userId: string, file: File) {
  const id = randomUUID();
  getDatabase().prepare(`INSERT INTO invoice_records
    (id,user_id,file_name,mime_type,size_bytes,status,created_at) VALUES (?,?,?,?,?,'processing',?)`)
    .run(id, userId, file.name, file.type || "application/octet-stream", file.size, new Date().toISOString());
  return id;
}

export function completeInvoiceRecord(userId: string, id: string, requestId: string | null, data: JsonObject, rawResponse: JsonObject) {
  getDatabase().prepare(`UPDATE invoice_records SET status='success',request_id=?,data_json=?,raw_response_json=?,error_message=NULL WHERE id=? AND user_id=?`)
    .run(requestId, JSON.stringify(data), JSON.stringify(rawResponse), id, userId);
}

export function failInvoiceRecord(userId: string, id: string, message: string) {
  getDatabase().prepare(`UPDATE invoice_records SET status='failed',error_message=? WHERE id=? AND user_id=?`).run(message, id, userId);
}

export function listInvoiceRecords(userId: string, limit = 10) {
  return (getDatabase().prepare(`SELECT * FROM invoice_records WHERE user_id=? ORDER BY created_at DESC LIMIT ?`).all(userId, limit) as Row[]).map(summary);
}

export function getInvoiceRecord(userId: string, id: string): InvoiceRecord | null {
  const row = getDatabase().prepare("SELECT * FROM invoice_records WHERE id=? AND user_id=?").get(id, userId) as Row | undefined;
  return row ? { ...summary(row), data: parseJson(row.data_json), rawResponse: parseJson(row.raw_response_json) } : null;
}
