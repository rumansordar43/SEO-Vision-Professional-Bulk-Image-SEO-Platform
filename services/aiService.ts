
import { SEOData, StockConstraints, PLATFORM_FIELDS, AppSettings, AIProvider } from "../types";
import { GoogleGenAI } from "@google/genai";

/**
 * Robust Multi-Provider Engine
 * Now excludes decommissioned Groq models and prioritizes Gemini 2.0.
 */
export const analyzeImageWithAI = async (
  base64Data: string,
  mimeType: string,
  constraints: StockConstraints,
  settings: AppSettings
): Promise<SEOData> => {
  
  // Strategy: Try the most reliable and active models first
  const strategy: { model: string, provider: AIProvider }[] = [
    { model: 'gemini-2.0-flash', provider: 'gemini' },
    { model: 'llama-3.2-90b-vision-preview', provider: 'groq' },
    { model: 'gpt-4o-mini', provider: 'openai' },
    { model: 'google/gemini-2.0-flash-001', provider: 'openrouter' },
    { model: 'deepseek-chat', provider: 'deepseek' },
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
        EXCLUDE KEYWORDS: ${constraints.negKeywordsEnabled ? constraints.negKeywords : 'none'}.
        FORMAT: Strictly JSON object only.
        SCHEMA: { 
          "title": "string (descriptive, high search volume)", 
          ${requiredFields.description ? '"description": "string (brief context)",' : ''} 
          "keywords": ["50", "relevant", "tags", "comma", "separated"] 
        }
      `;

      try {
        let rawContent = "";

        if (step.provider === 'gemini') {
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
              temperature: 0.1
            }
          });
          
          rawContent = response.text || "";
        } else {
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

        // Clean potentially problematic markdown wrapper
        const cleanedJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanedJson) as SEOData;
        
        return applyPostProcessing(data, constraints);

      } catch (err: any) {
        lastError = `${step.provider.toUpperCase()} [${step.model}]: ${err.message}`;
        console.warn(`Fallback triggered: ${lastError}`);
        // If a model is decommissioned or key is invalid, continue to next in strategy
        continue; 
      }
    }
  }

  throw new Error(`Engine stopped: ${lastError}`);
};

const applyPostProcessing = (data: SEOData, constraints: StockConstraints): SEOData => {
  let title = data.title.trim();
  
  // Ensure title length is respected
  if (title.length > constraints.maxTitleChars) {
    title = title.substring(0, constraints.maxTitleChars - 1).trim();
  }

  // Apply Prefix/Suffix
  if (constraints.prefixEnabled && constraints.prefix) {
    title = `${constraints.prefix.trim()} ${title}`;
  }
  if (constraints.suffixEnabled && constraints.suffix) {
    title = `${title} ${constraints.suffix.trim()}`;
  }

  // Ensure keyword count is strictly followed
  let keywords = data.keywords || [];
  if (keywords.length > constraints.keywordCount) {
    keywords = keywords.slice(0, constraints.keywordCount);
  }

  return { ...data, title, keywords };
};
