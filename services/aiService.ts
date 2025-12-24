
import { SEOData, StockConstraints, PLATFORM_FIELDS, AppSettings, AIModel } from "../types";

/**
 * Intelligent Engine: Rotates through all keys and models automatically.
 */
export const analyzeImageWithAI = async (
  base64Data: string,
  mimeType: string,
  constraints: StockConstraints,
  settings: AppSettings
): Promise<SEOData> => {
  
  // Define prioritized models and their corresponding provider keys
  const strategy: { model: AIModel, provider: 'groq' | 'openai' }[] = [
    { model: 'llama-3.2-90b-vision-preview', provider: 'groq' },
    { model: 'gpt-4o-mini', provider: 'openai' },
    { model: 'llama-3.2-11b-vision-preview', provider: 'groq' },
    { model: 'gpt-4o', provider: 'openai' }
  ];

  let lastError: string = "No API keys configured.";

  // Iterate through each model strategy
  for (const step of strategy) {
    const keys = settings.keys[step.provider];
    if (!keys || keys.length === 0) continue;

    const endpoint = step.provider === 'groq' 
      ? "https://api.groq.com/openai/v1/chat/completions" 
      : "https://api.openai.com/v1/chat/completions";

    // For each model, try every provided API key for that provider
    for (const apiKey of keys) {
      if (!apiKey.trim()) continue;

      const requiredFields = PLATFORM_FIELDS[constraints.selectedPlatform];
      const prompt = `
        TASK: Professional Stock SEO Analysis.
        CONTEXT: ${constraints.selectedPlatform} | ${constraints.imageType}.
        CONSTRAINTS: Title < ${constraints.maxTitleChars} chars, ${constraints.keywordCount} tags.
        FORMAT: JSON { "title": "string", ${requiredFields.description ? '"description": "string",' : ''} "keywords": ["string"] }
      `;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: step.model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
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
          lastError = errData.error?.message || response.statusText;
          console.warn(`Attempt failed (Model: ${step.model}, Key: ...${apiKey.slice(-4)}): ${lastError}`);
          continue; // Try next key or model
        }

        const result = await response.json();
        const content = result.choices[0].message.content;
        const data = JSON.parse(content) as SEOData;

        // Branding/Prefix adjustments
        if (constraints.prefixEnabled && constraints.prefix) data.title = `${constraints.prefix.trim()} ${data.title.trim()}`;
        if (constraints.suffixEnabled && constraints.suffix) data.title = `${data.title.trim()} ${constraints.suffix.trim()}`;

        return data;
      } catch (err: any) {
        lastError = err.message;
        console.warn(`Execution error with ${step.model}:`, lastError);
        continue;
      }
    }
  }

  throw new Error(`All available models and keys failed. Last error: ${lastError}`);
};
