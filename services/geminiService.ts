
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
    คุณเป็นผู้ช่วยจัดการการเงินส่วนบุคคล โปรดฟังเสียงภาษาไทยนี้และสกัดข้อมูลธุรกรรมออกมา
    ส่งกลับเป็นวัตถุ JSON ที่มีข้อมูลดังนี้:
    - type: 'income' (รายรับ) หรือ 'expense' (รายจ่าย)
    - amount: จำนวนเงิน (ตัวเลขบวก)
    - category: หมวดหมู่ที่เหมาะสมที่สุด โดยต้องเลือกจากรายการด้านล่างนี้เท่านั้น:
        รายรับ: ${INCOME_CATEGORIES.join(', ')}
        รายจ่าย: ${EXPENSE_CATEGORIES.join(', ')}
      หากไม่แน่ใจให้ใช้ 'รายได้อื่นๆ' หรือ 'รายจ่ายอื่นๆ'
    - date: วันที่ที่ระบุ หรือถ้าไม่ระบุให้ใช้ค่าวันนี้ (${new Date().toISOString().split('T')[0]}) รูปแบบ YYYY-MM-DD
    - description: สรุปสั้นๆ เกี่ยวกับรายการนี้เป็นภาษาไทย
    - status: 'paid' (ถ้าพูดว่าจ่ายแล้ว/ได้รับแล้ว) หรือ 'pending' (ถ้ายังไม่จ่าย/ค้างจ่าย) หากไม่ระบุให้เป็น 'paid' เป็นค่าเริ่มต้น
    
    หากไม่พบข้อมูลธุรกรรม ให้ส่งกลับค่า null
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
