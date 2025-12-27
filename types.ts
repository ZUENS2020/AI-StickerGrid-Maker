export interface StickerSegment {
  id: number;
  dataUrl: string; // Base64 for display
  blob: Blob;      // Blob for zip
  label: string;   // AI generated label
  isProcessing: boolean;
}

export interface GridDimensions {
  rows: number;
  cols: number;
}

export type ProcessingStatus = 'idle' | 'slicing' | 'analyzing' | 'complete' | 'error';

export type Language = 'en' | 'zh';

export type ApiProvider = 'gemini' | 'openai';

export interface AppSettings {
  provider: ApiProvider;
  apiKey: string;
  baseUrl: string; // Optional, for proxies
  modelName?: string; // Optional override
}
