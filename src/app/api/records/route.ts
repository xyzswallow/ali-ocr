import { NextResponse } from "next/server";
import { z } from "zod";
import { listInvoiceRecords } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = z.coerce.number().int().min(1).max(50).safeParse(new URL(request.url).searchParams.get("limit") || "10");
  if (!parsed.success) return NextResponse.json({ error: "limit 必须是 1 到 50 之间的整数。" }, { status: 400 });
  try {
    return NextResponse.json({ records: listInvoiceRecords(parsed.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "读取识别记录失败，请检查数据库状态。" }, { status: 500 });
  }
}
