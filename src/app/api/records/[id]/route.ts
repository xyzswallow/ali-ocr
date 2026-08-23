import { NextResponse } from "next/server";
import { getInvoiceRecord } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const record = getInvoiceRecord(id);
    if (!record) return NextResponse.json({ error: "未找到该识别记录。" }, { status: 404 });
    return NextResponse.json(record, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "读取识别详情失败，请检查数据库状态。" }, { status: 500 });
  }
}
