
import { Transaction, TransactionType, TransactionStatus } from "../types";

export async function fetchFromSheets(webhookUrl: string): Promise<Transaction[] | null> {
  try {
    const url = new URL(webhookUrl);
    url.searchParams.set('t', Date.now().toString());

    const response = await fetch(url.toString());
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
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
        // Use local time components to prevent timezone shift from UTC
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
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
    return null;
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
