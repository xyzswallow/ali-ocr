# 票识

基于 Next.js 16 和阿里云 OCR `RecognizeInvoice` 接口的增值税发票识别工具。上传的原始文件只在请求期间保存在内存中；SQLite 仅保存文件元数据和识别结果。

## 环境要求

- Node.js 20.9 或更高版本
- 已开通阿里云文字识别服务
- RAM 用户拥有 `ocr:RecognizeInvoice` 权限

## 本地运行

安装依赖：

```bash
npm install
```

复制 `.env.example` 为 `.env.local`，并填写已轮换的 AccessKey：

```env
ALIBABA_CLOUD_ACCESS_KEY_ID=your-access-key-id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your-access-key-secret
ALIBABA_CLOUD_REGION_ID=cn-hangzhou
DATABASE_PATH=./data/invoices.db
```

启动开发服务器：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。SQLite 数据库及表会在首次访问接口时自动创建，无需单独执行迁移。

## 验证

```bash
npm run lint
npm test
npm run build
```

自动化测试使用内存数据库和模拟 OCR 响应，不会消耗阿里云调用额度。

## 安全说明

- AccessKey 只允许配置在服务端环境变量中，变量名不能使用 `NEXT_PUBLIC_` 前缀。
- `.env.local` 与 `data/` 已被 Git 忽略，不要将真实凭证或识别数据提交到仓库。
- 日志和 API 响应不输出 AccessKey。
- 已经发送到聊天、工单或代码仓库的 AccessKey 应立即在阿里云 RAM 控制台禁用并轮换。
