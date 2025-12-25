
export interface SEOData {
  title: string;
  description?: string;
  keywords: string[];
}

export type ExportPlatform = 'Generic' | 'Shutterstock' | 'Adobe Stock' | 'Freepik' | 'Vecteezy' | 'Pond5';

export type AIProvider = 'groq' | 'openai' | 'gemini' | 'deepseek' | 'openrouter';

export const PLATFORM_FIELDS: Record<ExportPlatform, { title: boolean; description: boolean; keywords: boolean }> = {
  'Generic': { title: true, description: true, keywords: true },
  'Shutterstock': { title: true, description: true, keywords: true },
  'Adobe Stock': { title: true, description: false, keywords: true },
  'Freepik': { title: true, description: false, keywords: true },
  'Vecteezy': { title: true, description: false, keywords: true },
  'Pond5': { title: true, description: true, keywords: true }
};

export interface AppSettings {
  useProxy: boolean;
  keys: {
    groq: string[];
    openai: string[];
    gemini: string[];
    deepseek: string[];
    openrouter: string[];
  };
}

export interface StockConstraints {
  maxTitleChars: number;
  maxDescChars: number;
  keywordCount: number;
  excludeKeywords: string[];
  imageType: 'None' | 'Photo' | 'Vector' | 'Illustration';
  prefix: string;
  suffix: string;
  prefixEnabled: boolean;
  suffixEnabled: boolean;
  negWordsTitleEnabled: boolean;
  negKeywordsEnabled: boolean;
  negWordsTitle: string;
  negKeywords: string;
  selectedPlatform: ExportPlatform;
}

export interface OptimizedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  seoData?: SEOData;
  error?: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED'
}
