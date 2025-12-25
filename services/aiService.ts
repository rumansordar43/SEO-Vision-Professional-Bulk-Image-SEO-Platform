
import { SEOData, StockConstraints, PLATFORM_FIELDS, AppSettings, AIProvider } from "../types";
import { GoogleGenAI } from "@google/genai";

/**
 * Intelligent Multi-Provider Vision Engine
 * Enhanced with CORS Proxy support for Groq/OpenAI in browser environments.
 */
export const analyzeImageWithAI = async (
  base64Data: string,
  mimeType: string,
  constraints: StockConstraints,
  settings: AppSettings
): Promise<SEOData> => {
  
  const strategy: { model: string, provider: AIProvider }[] = [
    { model: 'llama-3.2-90b-vision-preview', provider: 'groq' }, // Primary
    { model: 'gemini-2.0-flash', provider: 'gemini' },           // Fallback
    { model: 'gpt-4o-mini', provider: 'openai' },
    { model: 'google/gemini-2.0-flash-001', provider: 'openrouter' }
  ];

  let detailedLogs: string[] = [];

  for (const step of strategy) {
    const keys = settings.keys[step.provider];
    if (!keys || keys.length === 0) continue;

    for (const apiKey of keys) {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) continue;

      const requiredFields = PLATFORM_FIELDS[constraints.selectedPlatform];
      const promptText = `
        Analyze this stock ${constraints.imageType} for ${constraints.selectedPlatform}.
        Return ONLY valid JSON.
        Required: 
        - Title (50-100 chars)
        - Keywords (exactly ${constraints.keywordCount})
        - Description (if needed)
        Exclude: ${constraints.negKeywordsEnabled ? constraints.negKeywords : 'none'}.
        
        Format:
        {
          "title": "string",
          ${requiredFields.description ? '"description": "string",' : ''}
          "keywords": ["tag1", "tag2", ...]
        }
      `;

      try {
        let rawContent = "";

        if (step.provider === 'gemini') {
          // Gemini SDK doesn't need proxy as it has better browser CORS config
          const ai = new GoogleGenAI({ apiKey: trimmedKey });
          const response = await ai.models.generateContent({
            model: step.model,
            contents: {
              parts: [
                { text: promptText },
                { inlineData: { mimeType, data: base64Data } }
              ]
            },
            config: { responseMimeType: "application/json", temperature: 0.1 }
          });
          rawContent = response.text || "";
        } else {
          // OpenAI-compatible providers (Groq, etc.)
          const baseEndpoints: Record<string, string> = {
            groq: "https://api.groq.com/openai/v1/chat/completions",
            openai: "https://api.openai.com/v1/chat/completions",
            openrouter: "https://openrouter.ai/api/v1/chat/completions"
          };

          let url = baseEndpoints[step.provider];
          
          // Apply CORS Proxy if enabled and not already handled by Gemini
          if (settings.useProxy) {
            // Using corsproxy.io as a reliable public wrapper
            url = `https://corsproxy.io/?${encodeURIComponent(url)}`;
          }

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${trimmedKey}`,
              "Content-Type": "application/json",
              ...(step.provider === 'openrouter' ? { "HTTP-Referer": window.location.origin } : {})
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
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
          }

          const result = await response.json();
          rawContent = result.choices[0].message.content;
        }

        if (!rawContent) throw new Error("Empty AI Response");

        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : rawContent;
        const data = JSON.parse(cleanedJson) as SEOData;
        
        return applyPostProcessing(data, constraints);

      } catch (err: any) {
        let errorMsg = err.message;
        detailedLogs.push(`${step.provider.toUpperCase()}: ${errorMsg}`);
        console.warn(`Attempt failed: ${step.provider}`, errorMsg);
        continue; 
      }
    }
  }

  throw new Error(`Automation Stalled. Logs: ${detailedLogs.join(' | ')}`);
};

const applyPostProcessing = (data: SEOData, constraints: StockConstraints): SEOData => {
  let title = (data.title || "").trim();
  if (title.length > constraints.maxTitleChars) title = title.substring(0, constraints.maxTitleChars).trim();
  if (constraints.prefixEnabled && constraints.prefix) title = `${constraints.prefix.trim()} ${title}`;
  if (constraints.suffixEnabled && constraints.suffix) title = `${title} ${constraints.suffix.trim()}`;

  let keywords = Array.from(new Set(data.keywords || []))
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0)
    .slice(0, constraints.keywordCount);

  return { ...data, title, keywords };
};
