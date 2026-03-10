import { GoogleGenAI, Type } from "@google/genai";

export type ProcessingMode = 'auto' | 'text' | 'table' | 'address' | 'summary' | 'handwriting';

export interface ExtractionResult {
  type: string;
  language: string;
  content: string;
  structuredData?: Record<string, any>;
  tableData?: any[][];
  summary?: string;
  confidence: number;
}

/**
 * Helper to sleep for a given duration
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process image with Gemini AI, including retry logic for rate limits.
 */
export async function processImage(
  base64Image: string, 
  mode: ProcessingMode = 'auto',
  customApiKey?: string,
  retries = 3
): Promise<ExtractionResult> {
  // Use provided key or environment key
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("No API Key provided. Please set it in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Use gemini-3-flash-preview for higher rate limits and faster processing
  const model = "gemini-3-flash-preview";
  
  let systemInstruction = "";

  switch (mode) {
    case 'auto':
      systemInstruction = `Analyze the document in the image. 
      1. Detect the document type (Plain Text, Table, Address Label, Invoice, Receipt, Form, Mixed Content).
      2. Detect the language.
      3. Extract the content.
      4. If it's a table, extract as a 2D array.
      5. If it's an address, extract fields: name, company, street, houseNumber, city, state, postalCode, country.
      6. Provide a confidence score (0-1).`;
      break;
    case 'text':
      systemInstruction = "Extract all text from the image accurately. Maintain layout where possible.";
      break;
    case 'table':
      systemInstruction = "Detect and extract the table from the image. Return the data as a 2D array representing rows and columns.";
      break;
    case 'address':
      systemInstruction = "Extract address components: name, company, street, houseNumber, city, state, postalCode, country, phone, email.";
      break;
    case 'summary':
      systemInstruction = "Summarize the document content in less than 200 words. Include a title and key points.";
      break;
    case 'handwriting':
      systemInstruction = `This document contains handwritten text. 
      1. Carefully transcribe all handwritten notes, numbers, and symbols.
      2. If it's a table with handwritten entries, maintain the table structure.
      3. Pay special attention to 'ditto marks' (") and interpret them as the value from the row above.
      4. Extract the content as accurately as possible.`;
      break;
  }

  const prompt = `Process this image in ${mode} mode. Return a JSON object.`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Image.split(',')[1] || base64Image
                }
              }
            ]
          }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              language: { type: Type.STRING },
              content: { type: Type.STRING },
              structuredData: { 
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  company: { type: Type.STRING },
                  street: { type: Type.STRING },
                  houseNumber: { type: Type.STRING },
                  city: { type: Type.STRING },
                  state: { type: Type.STRING },
                  postalCode: { type: Type.STRING },
                  country: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  email: { type: Type.STRING },
                }
              },
              tableData: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              summary: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["type", "language", "content", "confidence"]
          }
        }
      });

      return JSON.parse(response.text);
    } catch (error: any) {
      // If we hit a rate limit (429), wait and retry
      if (error?.status === 'RESOURCE_EXHAUSTED' || error?.code === 429) {
        if (i < retries - 1) {
          const waitTime = Math.pow(2, i) * 2000; // Exponential backoff: 2s, 4s, 8s...
          console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
          await sleep(waitTime);
          continue;
        }
      }
      throw error;
    }
  }

  throw new Error("Max retries reached");
}
