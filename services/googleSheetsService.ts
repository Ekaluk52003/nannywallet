
const WALLET_PREFIX = "NannyWallet";

export interface SheetTransaction {
  id: string;
  date: string;
  category: string;
  type: string;
  amount: number;
  description: string;
  status: string;
}

export interface Wallet {
  id: string;
  name: string;
}

export const createWallet = async (accessToken: string, walletName: string): Promise<Wallet> => {
  const title = `${WALLET_PREFIX} ${walletName}`;
  
  // Check if wallet already exists
  console.log(`Checking for existing wallet: ${title}...`);
  const q = `name = '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name)`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      console.log(`Found existing wallet "${title}" with ID: ${searchData.files[0].id}`);
      return { id: searchData.files[0].id, name: walletName };
    }
  }

  console.log(`Creating new wallet sheet: ${title}...`);
  
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title
      },
      sheets: [
        {
          properties: {
            title: "Transactions",
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to create spreadsheet:", errorText);
    throw new Error('Failed to create spreadsheet: ' + errorText);
  }
  const data = await response.json();
  console.log("Wallet created with ID:", data.spreadsheetId);
  
  // Add headers
  console.log("Adding headers...");
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${data.spreadsheetId}/values/Transactions!A1:G1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [["id", "date", "category", "type", "amount", "description", "status"]]
    })
  });
  console.log("Headers added.");

  return { id: data.spreadsheetId, name: walletName };
};

export const listWallets = async (accessToken: string): Promise<Wallet[]> => {
  console.log("Searching for wallet spreadsheets...");
  const q = `name contains '${WALLET_PREFIX}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name)`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to search for spreadsheets:", errorText);
    throw new Error('Failed to search for spreadsheets: ' + errorText);
  }
  const data = await response.json();
  
  if (data.files && data.files.length > 0) {
    return data.files.map((f: any) => ({
      id: f.id,
      name: f.name.replace(WALLET_PREFIX, '').trim() || f.name // Strip prefix for display
    }));
  }
  return [];
};

export const appendTransaction = async (accessToken: string, spreadsheetId: string, transaction: SheetTransaction) => {
  if (!spreadsheetId) throw new Error("Spreadsheet ID required");

  const values = [[
    transaction.id,
    transaction.date,
    transaction.category,
    transaction.type,
    transaction.amount,
    transaction.description,
    transaction.status
  ]];

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:G:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) throw new Error('Failed to append transaction');
  return await response.json();
};

export const getTransactions = async (accessToken: string, spreadsheetId: string): Promise<SheetTransaction[]> => {
  if (!spreadsheetId) throw new Error("Spreadsheet ID required");

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:G`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) throw new Error('Failed to fetch transactions');
  const data = await response.json();
  
  if (!data.values) return [];

  return data.values.map((row: any[]) => ({
    id: row[0],
    date: row[1],
    category: row[2],
    type: row[3],
    amount: Number(row[4]),
    description: row[5],
    status: row[6]
  }));
};

export const updateTransaction = async (accessToken: string, spreadsheetId: string, transaction: SheetTransaction) => {
    if (!spreadsheetId) throw new Error("Spreadsheet ID required");
    
    // Fetch all IDs to find the row index
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:A`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    const rows = data.values || [];
    
    // Find row index (1-based, +1 because A1 is header)
    const rowIndex = rows.findIndex((r: any[]) => r[0] === transaction.id);
    
    if (rowIndex === -1) throw new Error("Transaction not found");
    
    const range = `Transactions!A${rowIndex + 1}:G${rowIndex + 1}`;
    
    const values = [[
        transaction.id,
        transaction.date,
        transaction.category,
        transaction.type,
        transaction.amount,
        transaction.description,
        transaction.status
    ]];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
    });
};

export const deleteTransaction = async (accessToken: string, spreadsheetId: string, id: string) => {
    if (!spreadsheetId) throw new Error("Spreadsheet ID required");
    
    // Fetch all IDs
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:A`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    const rows = data.values || [];
    
    const rowIndex = rows.findIndex((r: any[]) => r[0] === id);
    if (rowIndex === -1) throw new Error("Transaction not found");

    // Delete row request
    // First, get the sheetId
    const sheetMetaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
         headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const sheetMeta = await sheetMetaRes.json();
    const sheetId = sheetMeta.sheets[0].properties.sheetId;

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
             'Authorization': `Bearer ${accessToken}`,
             'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [{
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: "ROWS",
                        startIndex: rowIndex,
                        endIndex: rowIndex + 1
                    }
                }
            }]
        })
    });
};
