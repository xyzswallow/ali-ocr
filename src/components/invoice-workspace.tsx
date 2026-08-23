"use client";

import Image from "next/image";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  ChevronRight,
  FileText,
  History,
  ImageIcon,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type {
  InvoiceRecord,
  InvoiceRecordSummary,
  JsonObject,
  RecognizeResult,
} from "@/lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const acceptedExtensions = [
  ".png",
  ".jpg",
  ".jpeg",
  ".bmp",
  ".gif",
  ".tif",
  ".tiff",
  ".webp",
  ".pdf",
  ".ofd",
];

type ViewStatus = "idle" | "ready" | "loading" | "success" | "error";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function getInvoiceData(payload: JsonObject | null) {
  if (!payload) return {} as JsonObject;
  return isObject(payload.data) ? payload.data : payload;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isDocument(file: File | null) {
  return Boolean(file && /\.(pdf|ofd)$/i.test(file.name));
}

function isPdf(file: File | null) {
  return Boolean(file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name)));
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 border-b border-[#e4e8ea] py-3 last:border-b-0">
      <dt className="mb-1 text-[12px] text-[#758086]">{label}</dt>
      <dd className="m-0 break-words text-sm font-medium text-[#202a2e]">
        {textValue(value)}
      </dd>
    </div>
  );
}

function PdfPreview({ file, pageNo }: { file: File; pageNo: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let pdf: PDFDocumentProxy | undefined;

    async function renderPdf() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
        });
        pdf = await loadingTask.promise;
        const page = await pdf.getPage(Math.min(pageNo, pdf.numPages));
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1200 / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("当前浏览器不支持 Canvas 预览。");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setState("ready");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "PDF 页面无法预览。");
          setState("error");
        }
      }
    }

    void renderPdf();
    return () => {
      cancelled = true;
      void pdf?.destroy();
    };
  }, [file, pageNo]);

  return (
    <div className="absolute inset-0 grid place-items-center overflow-auto bg-[#eef1f2] p-3">
      <canvas
        ref={canvasRef}
        aria-label={`PDF 第 ${pageNo} 页预览`}
        className={`max-h-full max-w-full bg-white shadow-sm ${state === "ready" ? "block" : "invisible"}`}
      />
      {state === "loading" && (
        <div className="absolute text-center text-sm text-[#758086]">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[#087f72]" />
          <p className="mt-3">正在生成发票预览…</p>
        </div>
      )}
      {state === "error" && (
        <div className="absolute max-w-[260px] text-center text-sm text-[#a13f31]">
          <FileText className="mx-auto h-10 w-10" />
          <p className="mt-3">{error || "PDF 页面无法预览。"}</p>
        </div>
      )}
    </div>
  );
}

function StatusMessage({ status, error }: { status: ViewStatus; error: string }) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm text-[#4e5b60]" role="status">
        <LoaderCircle className="h-5 w-5 animate-spin text-[#087f72]" />
        正在上传并识别发票，通常需要数秒…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-start gap-3 text-sm text-[#a13f31]" role="alert">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  if (status === "success") {
    return (
      <div className="flex items-center gap-2 text-sm text-[#087367]" role="status">
        <CheckCircle2 className="h-5 w-5" />
        识别完成，结果已保存
      </div>
    );
  }
  return null;
}

function InvoiceResult({ result }: { result: RecognizeResult }) {
  const invoice = getInvoiceData(result.data);
  const details = Array.isArray(invoice.invoiceDetails)
    ? invoice.invoiceDetails.filter(isObject)
    : [];

  return (
    <div className="space-y-7">
      <section aria-labelledby="basic-heading">
        <div className="mb-3 flex items-center justify-between border-b border-[#d9dfe2] pb-2">
          <h2 id="basic-heading" className="text-sm font-semibold text-[#263236]">
            发票信息
          </h2>
          <span className="text-xs text-[#7a858a]">
            {textValue(invoice.invoiceType)}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
          <Field label="发票代码" value={invoice.invoiceCode} />
          <Field label="发票号码" value={invoice.invoiceNumber} />
          <Field label="开票日期" value={invoice.invoiceDate} />
          <Field label="校验码" value={invoice.checkCode} />
        </dl>
      </section>

      <section className="grid gap-6 border-y border-[#d9dfe2] py-5 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-semibold text-[#087f72]">购买方</h2>
          <dl>
            <Field label="名称" value={invoice.purchaserName} />
            <Field label="纳税人识别号" value={invoice.purchaserTaxNumber} />
            <Field label="地址、电话" value={invoice.purchaserContactInfo} />
            <Field label="开户行及账号" value={invoice.purchaserBankAccountInfo} />
          </dl>
        </div>
        <div>
          <h2 className="mb-2 text-xs font-semibold text-[#c86826]">销售方</h2>
          <dl>
            <Field label="名称" value={invoice.sellerName} />
            <Field label="纳税人识别号" value={invoice.sellerTaxNumber} />
            <Field label="地址、电话" value={invoice.sellerContactInfo} />
            <Field label="开户行及账号" value={invoice.sellerBankAccountInfo} />
          </dl>
        </div>
      </section>

      <section aria-labelledby="amount-heading">
        <h2 id="amount-heading" className="mb-3 text-sm font-semibold text-[#263236]">
          金额汇总
        </h2>
        <dl className="grid grid-cols-1 border border-[#d9dfe2] sm:grid-cols-3">
          <div className="border-b border-[#d9dfe2] p-4 sm:border-r sm:border-b-0">
            <dt className="text-xs text-[#758086]">不含税金额</dt>
            <dd className="mt-1 text-lg font-semibold text-[#263236]">
              ¥ {textValue(invoice.invoiceAmountPreTax)}
            </dd>
          </div>
          <div className="border-b border-[#d9dfe2] p-4 sm:border-r sm:border-b-0">
            <dt className="text-xs text-[#758086]">税额</dt>
            <dd className="mt-1 text-lg font-semibold text-[#263236]">
              ¥ {textValue(invoice.invoiceTax)}
            </dd>
          </div>
          <div className="bg-[#f1f8f7] p-4">
            <dt className="text-xs text-[#087367]">价税合计</dt>
            <dd className="mt-1 text-lg font-semibold text-[#05675e]">
              ¥ {textValue(invoice.totalAmount)}
            </dd>
          </div>
        </dl>
      </section>

      {details.length > 0 && (
        <section aria-labelledby="details-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="details-heading" className="text-sm font-semibold text-[#263236]">
              发票明细
            </h2>
            <span className="text-xs text-[#758086]">{details.length} 项</span>
          </div>
          <div className="overflow-x-auto border border-[#d9dfe2]">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="bg-[#f3f5f6] text-[#59656a]">
                <tr>
                  {[
                    "项目名称",
                    "规格型号",
                    "单位",
                    "数量",
                    "单价",
                    "金额",
                    "税率",
                    "税额",
                  ].map((heading) => (
                    <th key={heading} className="border-b border-[#d9dfe2] px-3 py-2.5 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {details.map((item, index) => (
                  <tr key={index} className="border-b border-[#e5e9eb] last:border-0">
                    <td className="max-w-[190px] px-3 py-3 text-[#263236]">
                      {textValue(item.itemName)}
                    </td>
                    <td className="px-3 py-3">{textValue(item.specification)}</td>
                    <td className="px-3 py-3">{textValue(item.unit)}</td>
                    <td className="px-3 py-3">{textValue(item.quantity)}</td>
                    <td className="px-3 py-3">{textValue(item.unitPrice)}</td>
                    <td className="px-3 py-3">{textValue(item.amount)}</td>
                    <td className="px-3 py-3">{textValue(item.taxRate)}</td>
                    <td className="px-3 py-3">{textValue(item.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <details className="border-t border-[#d9dfe2] pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#4e5b60]">
          <Braces className="h-4 w-4" />
          原始 JSON
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto bg-[#172024] p-4 text-xs leading-5 text-[#d9e3e2]">
          {JSON.stringify(result.rawResponse, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function InvoiceWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [status, setStatus] = useState<ViewStatus>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecognizeResult | null>(null);
  const [history, setHistory] = useState<InvoiceRecordSummary[]>([]);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/records?limit=10", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { records: InvoiceRecordSummary[] };
      setHistory(payload.records);
    } catch {
      // History should not block the primary recognition workflow.
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/records?limit=10", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { records: InvoiceRecordSummary[] } | null) => {
        if (active && payload) setHistory(payload.records);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectFile = useCallback((selected: File | null) => {
    if (!selected) return;
    const extension = selected.name.slice(selected.name.lastIndexOf(".")).toLowerCase();
    if (!acceptedExtensions.includes(extension)) {
      setError("不支持该文件格式，请重新选择发票文件。");
      setStatus("error");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("文件大小不能超过 10 MB。");
      setStatus("error");
      return;
    }
    setFile(selected);
    setPageNo(1);
    setError("");
    setStatus("ready");
  }, []);

  async function submit() {
    if (!file || status === "loading") return;
    setStatus("loading");
    setError("");

    const body = new FormData();
    body.append("file", file);
    if (isDocument(file)) body.append("pageNo", String(pageNo));

    try {
      const response = await fetch("/api/recognize", { method: "POST", body });
      const payload = (await response.json()) as RecognizeResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "识别失败，请稍后重试。");
      setResult(payload);
      setStatus("success");
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "识别失败，请稍后重试。");
      setStatus("error");
      await loadHistory();
    }
  }

  async function openHistory(id: string) {
    setHistoryLoadingId(id);
    setError("");
    try {
      const response = await fetch(`/api/records/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const record = (await response.json()) as InvoiceRecord & { error?: string };
      if (!response.ok || !record.data || !record.rawResponse) {
        throw new Error(record.error || "该记录没有可展示的识别结果。");
      }
      setResult({
        recordId: record.id,
        requestId: record.requestId,
        data: record.data,
        rawResponse: record.rawResponse,
      });
      setStatus("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取历史记录失败。");
      setStatus("error");
    } finally {
      setHistoryLoadingId(null);
    }
  }

  function clearFile() {
    setFile(null);
    setPageNo(1);
    setStatus(result ? "success" : "idle");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const fileTypeLabel = useMemo(() => {
    if (!file) return "";
    const extension = file.name.split(".").pop();
    return extension?.toUpperCase() || "FILE";
  }, [file]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#d9dfe2] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center bg-[#172024] text-white">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold leading-5">票识</div>
              <div className="text-[11px] text-[#758086]">阿里云 OCR 发票识别</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#667177]">
            <ShieldCheck className="h-4 w-4 text-[#087f72]" />
            文件不留存
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 sm:py-8 lg:flex lg:h-[calc(100vh-65px)] lg:flex-col">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end lg:shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-[#172024]">发票识别</h1>
            <p className="mt-1 text-sm text-[#667177]">上传单张发票，获取结构化字段和明细</p>
          </div>
          <div className="text-xs text-[#7a858a]">支持图片、PDF 与 OFD · 最大 10 MB</div>
        </div>

        <div className="grid min-h-0 flex-1 items-start border border-[#d9dfe2] bg-white lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.5fr)] lg:items-stretch lg:overflow-hidden">
          <section className="border-b border-[#d9dfe2] p-5 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">上传发票</div>
                <div className="mt-0.5 text-xs text-[#758086]">选择一个待识别文件</div>
              </div>
              <span className="bg-[#edf3f2] px-2 py-1 text-[11px] font-medium text-[#087367]">步骤 1</span>
            </div>

            {!file ? (
              <div
                className={`grid min-h-[350px] cursor-pointer place-items-center border border-dashed p-6 text-center transition-colors ${
                  dragging
                    ? "border-[#087f72] bg-[#f1f8f7]"
                    : "border-[#bfc8cc] bg-[#fafbfb] hover:border-[#087f72] hover:bg-[#f7faf9]"
                }`}
                role="button"
                tabIndex={0}
                aria-label="选择或拖拽发票文件"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  selectFile(event.dataTransfer.files.item(0));
                }}
              >
                <div>
                  <div className="mx-auto mb-5 grid h-14 w-14 place-items-center border border-[#cdd5d8] bg-white text-[#087f72]">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-[#263236]">拖拽发票到此处</p>
                  <p className="mt-1 text-xs text-[#7a858a]">或点击选择本地文件</p>
                  <button
                    type="button"
                    className="mt-5 h-9 border border-[#aeb9bd] bg-white px-4 text-sm font-medium text-[#354247] hover:border-[#087f72] hover:text-[#087f72]"
                    onClick={(event) => {
                      event.stopPropagation();
                      inputRef.current?.click();
                    }}
                  >
                    选择文件
                  </button>
                  <p className="mx-auto mt-5 max-w-[260px] text-[11px] leading-5 text-[#879196]">
                    PNG、JPG、BMP、GIF、TIFF、WebP、PDF、OFD
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="relative min-h-[350px] overflow-hidden border border-[#d9dfe2] bg-[#f3f5f6]">
                  {previewUrl && file.type.startsWith("image/") ? (
                    <Image
                      src={previewUrl}
                      alt="待识别发票预览"
                      fill
                      unoptimized
                      className="object-contain p-4"
                    />
                  ) : isPdf(file) ? (
                    <PdfPreview key={`${file.name}-${pageNo}`} file={file} pageNo={pageNo} />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center p-6 text-center">
                      <div>
                        <FileText className="mx-auto h-14 w-14 text-[#7b878c]" />
                        <div className="mt-4 text-sm font-semibold text-[#354247]">{fileTypeLabel} 文档</div>
                        <div className="mt-1 text-xs text-[#7a858a]">阿里云将识别指定页面</div>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute top-3 right-3 grid h-8 w-8 place-items-center border border-[#ccd4d7] bg-white text-[#59656a] shadow-sm hover:text-[#a13f31]"
                    aria-label="移除文件"
                    title="移除文件"
                    onClick={clearFile}
                    disabled={status === "loading"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-start gap-3 border-b border-[#e2e6e8] pb-4">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#087f72]" />
                  ) : (
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#c86826]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[#263236]" title={file.name}>
                      {file.name}
                    </div>
                    <div className="mt-0.5 text-xs text-[#7a858a]">
                      {fileTypeLabel} · {formatBytes(file.size)}
                    </div>
                  </div>
                </div>

                {isDocument(file) && (
                  <label className="mt-4 flex items-center justify-between text-sm text-[#4e5b60]">
                    识别页码
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={pageNo}
                      onChange={(event) => setPageNo(Math.max(1, Number(event.target.value) || 1))}
                      className="h-9 w-24 border border-[#bfc8cc] bg-white px-3 text-right text-sm"
                      disabled={status === "loading"}
                    />
                  </label>
                )}

                <button
                  type="button"
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 bg-[#087f72] px-5 text-sm font-semibold text-white hover:bg-[#05675e] disabled:cursor-not-allowed disabled:bg-[#9aa8a7]"
                  onClick={submit}
                  disabled={status === "loading"}
                >
                  {status === "loading" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : status === "success" ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <ScanLine className="h-4 w-4" />
                  )}
                  {status === "loading" ? "正在识别" : status === "success" ? "重新识别" : "开始识别"}
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={acceptedExtensions.join(",")}
              onChange={(event) => selectFile(event.target.files?.item(0) || null)}
            />

            <div className="mt-5 min-h-6">
              <StatusMessage status={status} error={error} />
            </div>
          </section>

          <section className="min-w-0 p-5 sm:p-6 lg:min-h-0 lg:overflow-y-auto">
            <div className="mb-5 flex items-center justify-between border-b border-[#d9dfe2] pb-4">
              <div>
                <div className="text-sm font-semibold">识别结果</div>
                <div className="mt-0.5 text-xs text-[#758086]">结构化字段由阿里云 OCR 返回</div>
              </div>
              {result?.requestId && (
                <span className="max-w-[210px] truncate font-mono text-[10px] text-[#879196]" title={result.requestId}>
                  {result.requestId}
                </span>
              )}
            </div>

            {status === "loading" ? (
              <div className="grid min-h-[440px] place-items-center text-center">
                <div>
                  <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-[#087f72]" />
                  <p className="mt-4 text-sm font-medium text-[#354247]">正在解析发票内容</p>
                  <p className="mt-1 text-xs text-[#7a858a]">请保持当前页面打开</p>
                </div>
              </div>
            ) : result ? (
              <InvoiceResult result={result} />
            ) : (
              <div className="grid min-h-[440px] place-items-center text-center">
                <div className="max-w-[300px]">
                  <ReceiptText className="mx-auto h-11 w-11 text-[#aab4b8]" />
                  <p className="mt-4 text-sm font-medium text-[#4e5b60]">等待发票识别</p>
                  <p className="mt-1 text-xs leading-5 text-[#879196]">
                    上传文件并完成识别后，发票基本信息、金额和商品明细将在这里展示
                  </p>
                </div>
              </div>
            )}

            <section className="mt-8 border-t border-[#d9dfe2] pt-5" aria-labelledby="history-heading">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="history-heading" className="flex items-center gap-2 text-sm font-semibold text-[#354247]">
                  <History className="h-4 w-4" />
                  最近识别
                </h2>
                <span className="text-[11px] text-[#879196]">最多 10 条</span>
              </div>
              {history.length === 0 ? (
                <div className="border border-dashed border-[#d1d8db] px-4 py-5 text-center text-xs text-[#879196]">
                  暂无识别记录
                </div>
              ) : (
                <div className="divide-y divide-[#e2e6e8] border-y border-[#d9dfe2]">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-[#f7f9f9] disabled:cursor-default"
                      onClick={() => item.status === "success" && openHistory(item.id)}
                      disabled={historyLoadingId === item.id || item.status !== "success"}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center ${
                          item.status === "success"
                            ? "bg-[#edf5f4] text-[#087f72]"
                            : item.status === "failed"
                              ? "bg-[#faeeee] text-[#a13f31]"
                              : "bg-[#f3f5f6] text-[#758086]"
                        }`}
                      >
                        {historyLoadingId === item.id || item.status === "processing" ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : item.status === "failed" ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[#354247]">{item.fileName}</span>
                        <span className="mt-0.5 block text-[11px] text-[#879196]">
                          {formatTime(item.createdAt)} · {formatBytes(item.sizeBytes)}
                        </span>
                      </span>
                      {item.status === "success" && <ChevronRight className="h-4 w-4 shrink-0 text-[#9aa4a8]" />}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
