import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "票识 - 阿里云 OCR 发票识别",
  description: "上传增值税发票图片或文档，提取结构化发票信息。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
