
import { SEOData, StockConstraints, PLATFORM_FIELDS, AppSettings } from "../types";

/**
 * Universal service to analyze images using various AI providers via Fetch API.
 */
export const analyzeImageWithAI = async (
  base64Data: string,
  mimeType: string,
  constraints: StockConstraints,
  settings: AppSettings
): Promise<SEOData> => {
  const model = constraints.model;
  let endpoint = "";
  let apiKey = "";
  let payload: any = {};

  // Determine provider configuration
  if (model.includes('llama')) {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
    apiKey = settings.keys.groq;
  } else if (model.startsWith('gpt')) {
    endpoint = "https://api.openai.com/v1/chat/completions";
    apiKey = settings.keys.openai;
  } else if (model.includes('deepseek')) {
    endpoint = "https://api.deepseek.com/v1/chat/completions";
    apiKey = settings.keys.deepseek;
  } else if (model.includes('openrouter')) {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    apiKey = settings.keys.openrouter;
  }

  if (!apiKey) {
    throw new Error(`MISSING_KEY: API Key for ${model} is not configured in Settings.`);
  }

  const requiredFields = PLATFORM_FIELDS[constraints.selectedPlatform];
  const prompt = `
    Analyze this commercial stock image for ${constraints.selectedPlatform}.
    CONSTRAINTS:
    - Title: Max ${constraints.maxTitleChars} chars. Literal and descriptive.
    ${requiredFields.description ? `- Description: Max ${constraints.maxDescChars} chars.` : "- NO Description needed."}
    - Keywords: Exactly ${constraints.keywordCount} relevant keywords.
    - Image Type: ${constraints.imageType}
    - Style: Commercial, stock-photo quality.
    ${constraints.negWordsTitleEnabled ? `- EXCLUDE these words from Title: ${constraints.negWordsTitle}` : ""}
    ${constraints.negKeywordsEnabled ? `- EXCLUDE these Keywords: ${constraints.negKeywords}` : ""}

    IMPORTANT: Return ONLY a valid JSON object.
    Format:
    {
      "title": "string",
      ${requiredFields.description ? '"description": "string",' : ''}
      "keywords": ["string"]
    }
  `;

  payload = {
    model: model === 'openrouter-auto' ? 'openai/gpt-4o-mini' : model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`
            }
          }
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.5
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API Error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const data = JSON.parse(content) as SEOData;

    // Apply Prefix/Suffix logic
    if (constraints.prefixEnabled && constraints.prefix) data.title = `${constraints.prefix} ${data.title}`;
    if (constraints.suffixEnabled && constraints.suffix) data.title = `${data.title} ${constraints.suffix}`;

    return data;
  } catch (error: any) {
    console.error("AI Service Error:", error);
    throw error;
  }
};
