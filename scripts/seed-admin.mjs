// 创建管理员账号，并把存量（user_id 为空的）发票记录划归该账号。可重复执行。
// 用法：npm run seed:admin（从 .env.local 读取 ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_DISPLAY_NAME）
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const displayName = process.env.ADMIN_DISPLAY_NAME || "管理员";

if (!email || !password) {
  console.error("缺少 ADMIN_EMAIL 或 ADMIN_PASSWORD，请先在 .env.local 中配置。");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD 至少 8 位。");
  process.exit(1);
}

const configured = process.env.DATABASE_PATH || "./data/invoices.db";
const filePath = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
mkdirSync(dirname(filePath), { recursive: true });

const db = new Database(filePath);
db.pragma("foreign_keys = ON");

if (db.pragma("user_version", { simple: true }) < 2) {
  console.error(
    `数据库 ${filePath} 尚未升级到多用户 schema。请先运行一次 npm run dev（应用启动时会自动迁移），然后重新执行本脚本。`,
  );
  process.exit(1);
}

// 与 src/lib/users.ts 的 hashPassword 保持一致：saltHex:hashHex，scrypt 64 字节。
function hashPassword(plain) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
let adminId;
if (existing) {
  adminId = existing.id;
  console.log(`管理员账号已存在：${email}`);
} else {
  adminId = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)",
  ).run(adminId, email, hashPassword(password), displayName, new Date().toISOString());
  console.log(`已创建管理员账号：${email}`);
}

const claimed = db
  .prepare("UPDATE invoice_records SET user_id = ? WHERE user_id IS NULL")
  .run(adminId).changes;
console.log(`已认领存量识别记录：${claimed} 条`);

db.close();
