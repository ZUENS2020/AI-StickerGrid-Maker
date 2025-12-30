# AI StickerGrid Maker

> AI驱动的表情包网格制作工具 - 将4×4网格图片自动分割成16个独立贴纸，并用AI生成智能标签

![AI StickerGrid Maker](https://img.shields.io/badge/React-19.2.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Express](https://img.shields.io/badge/Express-5.2.1-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 功能特性

- **双模式操作**
  - **Upload模式**: 上传现有的4×4网格图片进行切片
  - **Generate模式**: 使用AI从文本提示生成全新的贴纸网格

- **智能图像处理**
  - Canvas自动切片：将4×4网格分割为16个独立贴纸
  - 分辨率调整：支持256×256到2048×2048多种分辨率
  - 批量处理：一键调整所有贴纸分辨率

- **AI增强功能**
  - 智能标签生成：AI分析每个贴纸内容，生成描述性标签
  - 贴纸网格生成：根据文本提示生成完整的4×4贴纸网格
  - 单贴纸重绘：修改特定贴纸的部分内容
  - AI图片放大：智能提升低分辨率图片质量

- **编辑与导出**
  - 单个贴纸独立编辑
  - 支持图片替换和AI重绘
  - 一键ZIP打包下载所有贴纸

- **国际化**
  - 支持中英文双语界面切换

## 技术架构

```
前端: React 19 + TypeScript + Vite + Tailwind CSS
后端: Node.js + Express 5
AI服务: Google Generative AI SDK (Gemini)
工具库: JSZip, Lucide React
```

## 项目结构

```
AI-StickerGrid-Maker/
├── src/
│   ├── App.tsx                    # 主应用组件
│   ├── types.ts                   # TypeScript类型定义
│   └── locales.ts                 # 国际化翻译文件
├── components/
│   ├── DropZone.tsx              # 文件上传组件
│   └── GridPreview.tsx           # 网格预览组件
├── services/
│   ├── imageProcessing.ts        # 图像处理服务
│   └── geminiService.ts          # AI服务代理
├── server/
│   ├── index.js                  # Express后端API
│   └── config.json               # 服务器配置
├── Dockerfile                    # Docker容器配置
└── docker-compose.yml           # Docker Compose配置
```

## 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn
- Google Gemini API密钥

### 本地运行

1. **安装依赖**
```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install
```

2. **配置环境变量**

创建 `.env.local` 文件：
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

3. **启动开发服务器**
```bash
# 启动前端 (端口 3000)
npm run dev

# 启动后端 (端口 5001)
cd server && node index.js
```

4. **访问应用**

打开浏览器访问: `http://localhost:3000`

### Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 访问应用
http://localhost:3000
```

### PM2 部署

```bash
# 使用PM2启动
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs sticker-grid
```

## API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/config` | GET/POST | 获取/保存服务器配置 |
| `/api/generate-labels` | POST | AI生成贴纸标签 |
| `/api/generate-sheet` | POST | 生成贴纸网格 |
| `/api/regenerate` | POST | 重新生成单个贴纸 |
| `/api/upscale` | POST | AI图片放大 |

### API 使用示例

**生成标签**
```bash
curl -X POST http://localhost:5001/api/generate-labels \
  -H "Content-Type: application/json" \
  -d '{
    "segments": ["data:image/png;base64,..."]
  }'
```

**生成贴纸网格**
```bash
curl -X POST http://localhost:5001/api/generate-sheet \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "cute animal stickers",
    "reference": "data:image/png;base64,..."
  }'
```

## 工作流程

```
用户上传/生成图片
       │
       ▼
  Canvas切片 (4×4 → 16个)
       │
       ▼
  AI分析生成标签
       │
       ▼
  预览与编辑
       │
       ▼
  ZIP打包下载
```

## 配置说明

### 服务器配置 (`server/config.json`)
```json
{
  "geminiApiKey": "your_api_key",
  "maxImageSize": 10485760,
  "allowedFormats": ["image/png", "image/jpeg", "image/webp"]
}
```

### Vite 配置 (`vite.config.ts`)
- 开发服务器端口: `3000`
- API代理: `/api` → `http://localhost:5001`

## 开发指南

### 添加新的AI功能

1. 在 `server/index.js` 添加新的API端点
2. 在 `services/geminiService.ts` 添加对应的AI服务方法
3. 在前端组件中调用新接口

### 添加新的分辨率选项

编辑 `src/types.ts` 和相关组件，添加新的分辨率配置。

## 许可证

MIT License

## 致谢

- [Google Generative AI](https://ai.google.dev/) - AI生成能力
- [Vite](https://vitejs.dev/) - 构建工具
- [React](https://react.dev/) - 前端框架
