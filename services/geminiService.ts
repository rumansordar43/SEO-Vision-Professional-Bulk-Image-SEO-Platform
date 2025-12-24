
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SEOData, StockConstraints, PLATFORM_FIELDS } from "../types";

/**
 * Analyzes a stock image and generates SEO metadata using Gemini.
 * Adheres strictly to the requirement of using process.env.API_KEY exclusively.
 */
export const analyzeStockImage = async (
  base64Data: string, 
  mimeType: string, 
  constraints: StockConstraints
): Promise<SEOData> => {
  // Always create a new instance to ensure the most up-to-date API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = constraints.model || 'gemini-3-flash-preview';
  
  const requiredFields = PLATFORM_FIELDS[constraints.selectedPlatform];
  
  const negTitleInstructions = constraints.negWordsTitleEnabled && constraints.negWordsTitle
    ? `- DO NOT include any of the following words in the TITLE: ${constraints.negWordsTitle}`
    : "";
  
  const negKeywordsInstructions = constraints.negKeywordsEnabled && constraints.negKeywords
    ? `- DO NOT include any of the following KEYWORDS: ${constraints.negKeywords}`
    : "";

  // Platform specific logic
  let platformRules = "";
  switch(constraints.selectedPlatform) {
    case 'Adobe Stock':
      platformRules = "- Adobe Stock Rule: Title must be highly descriptive and literal. Focus everything into the title.";
      break;
    case 'Shutterstock':
      platformRules = "- Shutterstock Rule: Provide clear title and context-rich description.";
      break;
    case 'Freepik':
      platformRules = "- Freepik Rule: Catchy but descriptive titles.";
      break;
    default:
      platformRules = "- Standard microstock metadata rules apply.";
  }

  const properties: any = {
    title: { type: Type.STRING },
    keywords: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
  };
  const required = ["title", "keywords"];

  if (requiredFields.description) {
    properties.description = { type: Type.STRING };
    required.push("description");
  }

  const prompt = `
    Analyze this commercial stock image. Provide metadata optimized for ${constraints.selectedPlatform}.
    Using Model: ${model}
    
    STRICT CONSTRAINTS:
    ${platformRules}
    - Title: Max ${constraints.maxTitleChars} characters. Literal description of the scene.
    ${negTitleInstructions}
    ${requiredFields.description ? `- Description: Max ${constraints.maxDescChars} characters.` : "- Skip Description."}
    - Keywords: Exactly ${constraints.keywordCount} relevant keywords, most important first.
    ${negKeywordsInstructions}
    - Style: Commercial, non-subjective.
    - Image Type: ${constraints.imageType}

    Return valid JSON:
    {
      "title": "string",
      ${requiredFields.description ? '"description": "string",' : ''}
      "keywords": ["string"]
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: properties,
          required: required
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("Empty AI response");

    const data = JSON.parse(jsonStr) as SEOData;
    
    if (constraints.prefixEnabled && constraints.prefix) data.title = `${constraints.prefix} ${data.title}`;
    if (constraints.suffixEnabled && constraints.suffix) data.title = `${data.title} ${constraints.suffix}`;

    return data;
  } catch (error: any) {
    // If request fails with "Requested entity was not found", it might mean the API key is invalid or model unavailable
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_ERROR: Please select a valid Paid API Key in Settings.");
    }
    throw error;
  }
};
