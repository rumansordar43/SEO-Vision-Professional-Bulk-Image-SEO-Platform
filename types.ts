
export interface SEOData {
  title: string;
  description?: string;
  keywords: string[];
}

export type ExportPlatform = 'Generic' | 'Shutterstock' | 'Adobe Stock' | 'Freepik' | 'Vecteezy' | 'Pond5';

// Simplified model list for internal logic
export type AIModel = 
  | 'llama-3.2-90b-vision-preview'
  | 'llama-3.2-11b-vision-preview'
  | 'gpt-4o'
  | 'gpt-4o-mini';

export const PLATFORM_FIELDS: Record<ExportPlatform, { title: boolean; description: boolean; keywords: boolean }> = {
  'Generic': { title: true, description: true, keywords: true },
  'Shutterstock': { title: true, description: true, keywords: true },
  'Adobe Stock': { title: true, description: false, keywords: true },
  'Freepik': { title: true, description: false, keywords: true },
  'Vecteezy': { title: true, description: false, keywords: true },
  'Pond5': { title: true, description: true, keywords: true }
};

export interface AppSettings {
  keys: {
    groq: string[]; // Supports multiple keys
    openai: string[]; // Supports multiple keys
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
