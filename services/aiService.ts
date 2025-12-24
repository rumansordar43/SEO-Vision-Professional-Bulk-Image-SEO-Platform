
import { SEOData, StockConstraints, PLATFORM_FIELDS, AppSettings, AIModel, AIProvider } from "../types";
import { GoogleGenAI } from "@google/genai";

/**
 * Enhanced Auto-Pilot Engine: 
 * Tries Groq -> Gemini -> OpenAI -> DeepSeek -> OpenRouter
 */
export const analyzeImageWithAI = async (
  base64Data: string,
  mimeType: string,
  constraints: StockConstraints,
  settings: AppSettings
): Promise<SEOData> => {
  
  const strategy: { model: string, provider: AIProvider }[] = [
    { model: 'llama-3.2-90b-vision-preview', provider: 'groq' },
    { model: 'gemini-2.0-flash', provider: 'gemini' },
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
      if (!apiKey.trim()) continue;

      const requiredFields = PLATFORM_FIELDS[constraints.selectedPlatform];
      const promptText = `
        TASK: Professional Stock SEO Analysis for ${constraints.selectedPlatform}.
        STYLE: ${constraints.imageType}.
        LIMITS: Title < ${constraints.maxTitleChars} chars, Keywords = ${constraints.keywordCount} tags.
        JSON SCHEMA: { "title": "string", ${requiredFields.description ? '"description": "string",' : ''} "keywords": ["string"] }
        OUTPUT: JSON ONLY.
      `;

      try {
        // Special Handling for Gemini
        if (step.provider === 'gemini') {
          const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
          const response = await ai.models.generateContent({
            model: step.model,
            contents: [{
              parts: [
                { text: promptText },
                { inlineData: { mimeType, data: base64Data } }
              ]
            }],
            config: { responseMimeType: "application/json" }
          });
          
          if (!response.text) throw new Error("Empty response from Gemini");
          const data = JSON.parse(response.text) as SEOData;
          return applyPostProcessing(data, constraints);
        }

        // Standard Fetch for others
        const endpoints: Record<string, string> = {
          groq: "https://api.groq.com/openai/v1/chat/completions",
          openai: "https://api.openai.com/v1/chat/completions",
          deepseek: "https://api.deepseek.com/chat/completions",
          openrouter: "https://openrouter.ai/api/v1/chat/completions"
        };

        const response = await fetch(endpoints[step.provider], {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
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
        const data = JSON.parse(result.choices[0].message.content) as SEOData;
        return applyPostProcessing(data, constraints);

      } catch (err: any) {
        lastError = `${step.provider.toUpperCase()} (${step.model}): ${err.message}`;
        console.warn(lastError);
        continue; // Fallback to next key/model
      }
    }
  }

  throw new Error(`Critical Failure: ${lastError}`);
};

const applyPostProcessing = (data: SEOData, constraints: StockConstraints): SEOData => {
  let title = data.title.trim();
  if (constraints.prefixEnabled && constraints.prefix) title = `${constraints.prefix.trim()} ${title}`;
  if (constraints.suffixEnabled && constraints.suffix) title = `${title} ${constraints.suffix.trim()}`;
  return { ...data, title };
};
