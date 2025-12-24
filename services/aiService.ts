
import { SEOData, StockConstraints, PLATFORM_FIELDS, AppSettings, AIProvider } from "../types";
import { GoogleGenAI } from "@google/genai";

/**
 * Intelligent Multi-Provider Engine
 * Rotates through Groq, Gemini, OpenAI, DeepSeek, and OpenRouter keys.
 */
export const analyzeImageWithAI = async (
  base64Data: string,
  mimeType: string,
  constraints: StockConstraints,
  settings: AppSettings
): Promise<SEOData> => {
  
  // Strategy: Most capable/cost-effective models first
  const strategy: { model: string, provider: AIProvider }[] = [
    { model: 'gemini-2.0-flash', provider: 'gemini' },
    { model: 'llama-3.2-90b-vision-preview', provider: 'groq' },
    { model: 'gpt-4o-mini', provider: 'openai' },
    { model: 'deepseek-chat', provider: 'deepseek' },
    { model: 'google/gemini-2.0-flash-001', provider: 'openrouter' },
    { model: 'llama-3.2-11b-vision-preview', provider: 'groq' },
    { model: 'gpt-4o', provider: 'openai' }
  ];

  let lastError: string = "No active API keys found.";

  for (const step of strategy) {
    const keys = settings.keys[step.provider];
    if (!keys || keys.length === 0) continue;

    for (const apiKey of keys) {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) continue;

      const requiredFields = PLATFORM_FIELDS[constraints.selectedPlatform];
      const promptText = `
        TASK: Professional Stock SEO Analysis for ${constraints.selectedPlatform}.
        STYLE: ${constraints.imageType}.
        LIMITS: Title < ${constraints.maxTitleChars} chars, Keywords = ${constraints.keywordCount} tags.
        EXCLUDE: ${constraints.negKeywordsEnabled ? constraints.negKeywords : 'none'}.
        JSON SCHEMA: { 
          "title": "string (concise, high-converting)", 
          ${requiredFields.description ? '"description": "string (descriptive but brief)",' : ''} 
          "keywords": ["array", "of", "strings", "relevant", "to", "stock", "photography"] 
        }
        IMPORTANT: Return ONLY raw JSON. No markdown blocks.
      `;

      try {
        let rawContent = "";

        if (step.provider === 'gemini') {
          // Gemini SDK Implementation
          const ai = new GoogleGenAI({ apiKey: trimmedKey });
          const response = await ai.models.generateContent({
            model: step.model,
            contents: [{
              parts: [
                { text: promptText },
                { inlineData: { mimeType, data: base64Data } }
              ]
            }],
            config: { 
              responseMimeType: "application/json",
              temperature: 0.2
            }
          });
          
          rawContent = response.text || "";
        } else {
          // Standard OpenAI-Compatible Fetch for others
          const endpoints: Record<string, string> = {
            groq: "https://api.groq.com/openai/v1/chat/completions",
            openai: "https://api.openai.com/v1/chat/completions",
            deepseek: "https://api.deepseek.com/chat/completions",
            openrouter: "https://openrouter.ai/api/v1/chat/completions"
          };

          const response = await fetch(endpoints[step.provider], {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${trimmedKey}`,
              "Content-Type": "application/json",
              ...(step.provider === 'openrouter' ? { "HTTP-Referer": window.location.origin, "X-Title": "SEO Vision Pro" } : {})
            },
            body: JSON.stringify({
              model: step.model,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: promptText },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                  ]
                }
              ],
              response_format: { type: "json_object" },
              temperature: 0.1
            })
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || response.statusText);
          }

          const result = await response.json();
          rawContent = result.choices[0].message.content;
        }

        if (!rawContent) throw new Error("Empty AI response");

        // Clean potentially problematic markdown wrapper if it exists
        const cleanedJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanedJson) as SEOData;
        
        return applyPostProcessing(data, constraints);

      } catch (err: any) {
        lastError = `${step.provider.toUpperCase()} [${step.model}]: ${err.message}`;
        console.warn(`Engine Fallback - ${lastError}`);
        // If it's a critical error like 401/429, we proceed to next key/provider
        continue; 
      }
    }
  }

  throw new Error(`All providers exhausted. Final error: ${lastError}`);
};

const applyPostProcessing = (data: SEOData, constraints: StockConstraints): SEOData => {
  let title = data.title.trim();
  
  // Title Length Truncation safety
  if (title.length > constraints.maxTitleChars) {
    title = title.substring(0, constraints.maxTitleChars - 3) + "...";
  }

  if (constraints.prefixEnabled && constraints.prefix) {
    title = `${constraints.prefix.trim()} ${title}`;
  }
  if (constraints.suffixEnabled && constraints.suffix) {
    title = `${title} ${constraints.suffix.trim()}`;
  }

  // Keywords count enforcement
  let keywords = data.keywords || [];
  if (keywords.length > constraints.keywordCount) {
    keywords = keywords.slice(0, constraints.keywordCount);
  }

  return { ...data, title, keywords };
};
