
import { Transaction, TransactionType, TransactionStatus } from "../types";

export async function fetchFromSheets(webhookUrl: string): Promise<Transaction[]> {
  try {
    const url = new URL(webhookUrl);
    url.searchParams.set('t', Date.now().toString());

    console.log("Fetching from URL:", url.toString());
    const response = await fetch(url.toString());
    console.log("Response status:", response.status);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse Error. Response text:", text);
      throw new Error(`Invalid JSON response. The sheet might not be public (Anyone). Response start: ${text.substring(0, 50)}...`);
    }

    if (!Array.isArray(data)) return [];

    return data.map((rawItem: any) => {
      // Normalize keys to lowercase to handle "Amount", "AMOUNT", "amount" etc.
      const item: any = {};
      Object.keys(rawItem).forEach(key => {
        item[key.toLowerCase()] = rawItem[key];
      });

      const rawAmount = parseFloat(item.amount) || 0;
      const rawType = String(item.type || '').toLowerCase();
      const rawStatus = String(item.status || '').toLowerCase();

      // Determine Status from both column and type name
      const status: TransactionStatus = (rawStatus === 'pending' || rawType.includes('pending')) ? 'pending' : 'paid';

      // Determine Type (Internal app logic uses 'income' | 'expense')
      let type: TransactionType = 'expense';
      if (rawType.includes('income')) {
        type = 'income';
      } else if (rawType.includes('expense')) {
        type = 'expense';
      } else {
        type = rawAmount < 0 ? 'expense' : 'income';
      }

      // Handle Date - Fix timezone off-by-one error
      let dateStr = new Date().toISOString().split('T')[0];
      if (item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          // Use local time components to prevent timezone shift from UTC
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          console.warn("Invalid date found:", item.date, "Using today's date.");
        }
      }

      return {
        id: String(item.id || crypto.randomUUID()),
        type,
        category: String(item.category || 'อื่นๆ'),
        amount: Math.abs(rawAmount),
        date: dateStr,
        description: String(item.description || item.category || ''),
        status
      };
    });
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
}

export async function syncToSheets(transactions: Transaction[], webhookUrl: string): Promise<boolean> {
  try {
    const dataToSync = transactions.map(t => {
      // Descriptive type for native filtering in Sheets
      const sheetType = t.status === 'pending' ? `pending_${t.type}` : t.type;

      return {
        ...t,
        type: sheetType,
        amount: t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount)
      };
    });

    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(dataToSync),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    return true;
  } catch (error) {
    return false;
  }
}
