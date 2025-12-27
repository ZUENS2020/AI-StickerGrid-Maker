import { Language } from './types';

export const translations = {
  en: {
    // Header
    titlePart1: "Sticker",
    titlePart2: "Grid",

    // Settings
    settingsTitle: "Settings",
    settingsBtn: "API Settings",
    apiKeyLabel: "Gemini API Key",
    baseUrlLabel: "API Base URL (Optional)",
    saveBtn: "Save Settings",
    configureMsg: "Please configure your API settings to start.",

    // Auth (Legacy/Removed, reused for config prompt)
    authTitle: "Configure API",
    authSubtitle: "Enter your API Key to start generating stickers.",
    authBtn: "Open Settings",
    authNote: "Your key is stored locally in your browser.",

    // Hero
    heroTitle1: "Create Sticker Packs",
    heroTitle2: "in Seconds",
    heroSubtitle: "Upload a grid or generate one with AI. We'll handle slicing, tagging, and zip packaging.",
    modeUpload: "Upload Grid",
    modeGenerate: "Generate AI",

    // DropZone
    dropTitle: "Upload Sticker Sheet",
    dropDrag: "Drop file to upload",
    dropSubtitle: "Drag & drop a 4x4 grid image here, or click to browse.",
    dropError: "Please upload an image file.",

    // Generate
    refSubject: "Subject Reference",
    refSubjectPlaceholder: "Add Character",
    refStyle: "Style Reference",
    refStylePlaceholder: "Add Style",
    promptLabel: "Describe your sticker pack",
    promptPlaceholder: "e.g. A collection of cute isometric sushi characters...",
    btnGenerate: "Generate Stickers",
    supportsRef: "Supports Reference Images (Gemini Only)",
    standardGen: "Standard Generation",

    // Status
    statusGeneratingTitle: "Dreaming up your stickers...",
    statusProcessingTitle: "Processing your image...",
    statusGeneratingDesc: "Generating artwork...",
    statusProcessingDesc: "Slicing grid and analyzing contents",

    // Error
    errorTitle: "Something went wrong",
    btnTryAgain: "Try Again",

    // Preview
    previewTitle: "Preview & Edit",
    previewSubtitle: "Review generated tags before downloading.",
    btnReset: "Reset",
    btnDownload: "Download ZIP",
    labelPlaceholder: "Label...",

    // Edit Modal
    editTitle: "Modify Sticker",
    editSubtitle: "Describe how you want to change this specific sticker.",
    editPromptPlaceholder: "e.g. Make the character wink, Change the hat color to red...",
    btnCancel: "Cancel",
    btnRegenerate: "Regenerate",
  },
  zh: {
    // Header
    titlePart1: "Sticker",
    titlePart2: "Grid",

    // Settings
    settingsTitle: "设置",
    settingsBtn: "API 配置",
    apiKeyLabel: "Gemini API 密钥",
    baseUrlLabel: "API 代理地址 (可选)",
    saveBtn: "保存配置",
    configureMsg: "请先配置 API 设置。",

    // Auth
    authTitle: "配置 API",
    authSubtitle: "输入您的 API 密钥以开始生成表情包。",
    authBtn: "打开设置",
    authNote: "您的密钥仅存储在本地浏览器中。",

    // Hero
    heroTitle1: "极速制作",
    heroTitle2: "表情包",
    heroSubtitle: "上传或通过 AI 生成网格图。我们自动完成切片、打标和打包。",
    modeUpload: "上传网格",
    modeGenerate: "AI 生成",

    // DropZone
    dropTitle: "上传表情包网格",
    dropDrag: "松开以上传",
    dropSubtitle: "拖放 4x4 网格图片到这里，或点击浏览。",
    dropError: "请上传图片文件。",

    // Generate
    refSubject: "主体参考图",
    refSubjectPlaceholder: "添加角色",
    refStyle: "风格参考图",
    refStylePlaceholder: "添加风格",
    promptLabel: "描述你的表情包",
    promptPlaceholder: "例如：一套可爱的等轴测寿司角色...",
    btnGenerate: "开始生成",
    supportsRef: "支持参考图 (仅 Gemini)",
    standardGen: "标准生成",

    // Status
    statusGeneratingTitle: "正在构思表情包...",
    statusProcessingTitle: "正在处理图片...",
    statusGeneratingDesc: "AI 绘图中...",
    statusProcessingDesc: "正在切片并分析内容",

    // Error
    errorTitle: "出错了",
    btnTryAgain: "重试",

    // Preview
    previewTitle: "预览与编辑",
    previewSubtitle: "下载前预览并修改标签。",
    btnReset: "重置",
    btnDownload: "下载 ZIP",
    labelPlaceholder: "标签...",

    // Edit Modal
    editTitle: "修改表情",
    editSubtitle: "描述你想如何修改这个特定的表情。",
    editPromptPlaceholder: "例如：让角色眨眼，把帽子改成红色...",
    btnCancel: "取消",
    btnRegenerate: "重新生成",
  }
};
