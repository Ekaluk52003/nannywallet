
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  date: string;
  description: string;
  status: TransactionStatus;
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyStats {
  month: string;
  income: number;
  expense: number;
}

export interface SheetConfig {
  id: string;
  name: string;
  url: string;
  budget?: number;
}

export interface Wallet {
  id: string;
  name: string;
}
