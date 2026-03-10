import { createWorker } from 'tesseract.js';
import { ExtractionResult } from './geminiService';

/**
 * Process image locally using Tesseract.js (Free, no API key needed)
 */
export async function processImageLocally(base64Image: string): Promise<ExtractionResult> {
  const worker = await createWorker('eng');
  
  try {
    const { data: { text } } = await worker.recognize(base64Image);
    
    return {
      type: 'Local OCR (Text Only)',
      language: 'English',
      content: text,
      confidence: 0.7, // Tesseract is generally less confident than Gemini
      summary: "Local OCR extraction. AI features like summaries and structured data are only available in AI Mode."
    };
  } finally {
    await worker.terminate();
  }
}
