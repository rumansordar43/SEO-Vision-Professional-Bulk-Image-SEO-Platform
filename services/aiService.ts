import { SEOData, StockConstraints, PLATFORM_FIELDS, AppSettings } from "../types";

/**
 * Universal service to analyze images using various AI providers.
 * Optimized for Groq Llama 3.2 Vision.
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
    throw new Error(`MISSING_KEY: API Key for ${model} is not configured.`);
  }

  const requiredFields = PLATFORM_FIELDS[constraints.selectedPlatform];
  
  // Refined prompt for better Groq/Llama visual intelligence
  const prompt = `
    TASK: Act as a professional Stock Photography SEO Expert. Analyze the provided image for the ${constraints.selectedPlatform} marketplace.
    
    VISUAL ANALYSIS REQUIREMENTS:
    1. Identify the primary subject, environment, lighting, and mood.
    2. Note any technical aspects (e.g., "minimalist", "top-down view", "shallow depth of field").
    3. Determine the specific image type: ${constraints.imageType}.

    METADATA CONSTRAINTS:
    - TITLE: Max ${constraints.maxTitleChars} chars. Must be literal, keyword-rich, and descriptive.
    ${requiredFields.description ? `- DESCRIPTION: Max ${constraints.maxDescChars} chars. Describe the context and usage.` : "- NO DESCRIPTION: Do not generate a description field."}
    - KEYWORDS: Exactly ${constraints.keywordCount} single-word or short-phrase keywords. Rank by relevance.
    ${constraints.negWordsTitleEnabled ? `- FORBIDDEN WORDS (TITLE): ${constraints.negWordsTitle}` : ""}
    ${constraints.negKeywordsEnabled ? `- FORBIDDEN KEYWORDS: ${constraints.negKeywords}` : ""}

    OUTPUT FORMAT: Return ONLY a JSON object. No markdown, no intro.
    JSON SCHEMA:
    {
      "title": "string",
      ${requiredFields.description ? '"description": "string",' : ''}
      "keywords": ["string"]
    }
  `;

  const payload = {
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
    temperature: 0.3, // Lower temperature for more consistent stock tagging
    max_tokens: 1024
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

    // Post-processing for Prefix/Suffix
    if (constraints.prefixEnabled && constraints.prefix) data.title = `${constraints.prefix.trim()} ${data.title.trim()}`;
    if (constraints.suffixEnabled && constraints.suffix) data.title = `${data.title.trim()} ${constraints.suffix.trim()}`;

    return data;
  } catch (error: any) {
    console.error("AI Service Error:", error);
    throw error;
  }
};