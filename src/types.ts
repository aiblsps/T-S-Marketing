export type UserRole = 'super_admin' | 'admin' | 'director';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  assignedOutletId?: string;
  canTransact?: boolean;
  displayName?: string;
  customUserId?: string;
}

export interface Outlet {
  id: string;
  name: string;
  address?: string;
  cashBalance: number;
  isLocked: boolean;
}

export interface MotherAccount {
  id: string;
  date: string;
  amount: number;
}

export interface CompanyInfo {
  companyName: string;
  companyAddress: string;
}

export interface DailySummary {
  id: string;
  date: string;
  motherAccountBalance: number;
  outletBalances: {
    outletId: string;
    outletName: string;
    balance: number;
  }[];
  totalBalance: number;
  createdAt: string;
}

export type TransactionType = 'receive' | 'payment' | 'expense' | 'profit';

export interface Transaction {
  id: string;
  outletId: string;
  type: TransactionType | string;
  amount: number;
  cashAmount?: number;
  motherAmount?: number;
  description?: string;
  timestamp: any; // Firestore Timestamp
  userId: string;
  userName?: string;
  isLocked: boolean;
  date: string;
  directorId?: string;
  customUserId?: string;
  category?: string;
  note?: string;
}

export interface CashClosingData {
  id: string;
  date: string;
  outletId: string;
  previousDaysCashMother: number;
  todayTotalReceive: number;
  todayTotalProfit: number;
  todayTotalPayment: number;
  todayTotalExpense: number;
  todayLastBalance: number;
  todayCash: number;
  todayMother: number;
  denominations: Record<number, string>;
  createdAt: any;
}

export interface AppSettings {
  appName: string;
}

export type Language = 'en';
