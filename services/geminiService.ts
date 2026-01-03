
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from "../types";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../constants";

export async function processVoiceCommand(
  apiKey: string,
  audioBase64: string,
  mimeType: string
): Promise<Partial<Transaction> | null> {
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are a personal finance assistant. Listen to this audio (Thai or English) and extract transaction details.
    Return a JSON object with:
    - type: 'income' or 'expense'
    - amount: number (positive)
    - category: The most appropriate category from the list below ONLY:
        Income: ${INCOME_CATEGORIES.join(', ')}
        Expense: ${EXPENSE_CATEGORIES.join(', ')}
      If unsure, use 'Other Income' or 'Other Expense'.
    - date: Specified date, or today (${new Date().toISOString().split('T')[0]}) if not specified. Format YYYY-MM-DD.
    - description: Brief summary in English (translate if necessary).
    - status: 'paid' (if mentioned as paid/received) or 'pending'. Default to 'paid'.
    
    If no transaction data is found, return null.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType
          }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['income', 'expense'] },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING, enum: [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] },
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            status: { type: Type.STRING, enum: ['paid', 'pending'] }
          },
          required: ["type", "amount", "category", "date", "description", "status"]
        }
      }
    });

    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("Gemini Voice Error:", error);
    return null;
  }
}
