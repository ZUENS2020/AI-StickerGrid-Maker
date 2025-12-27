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

export type ApiProvider = 'google' | 'openai';

export interface ApiConfig {
  provider: ApiProvider;
  apiKey: string;
  baseUrl: string;
  visionModel: string;     // e.g. gemini-2.5-flash or gpt-4o
  generationModel: string; // e.g. gemini-2.5-flash-image or dall-e-3
}

export type Language = 'en' | 'zh';
