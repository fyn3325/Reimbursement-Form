export type ExpenseCategory = 'COMPANY' | 'PERSONAL';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  reasoning: string;
  hasReceipt: boolean;
}

export interface AuditStats {
  totalSpend: number;
  companySpend: number;
  personalSpend: number;
  missingReceiptsCount: number;
}

export interface SheetData {
  id: string;
  name: string;
  headers: string[];
  rows: Array<Record<string, any>>;
}

export interface EmployeeInfo {
  name: string;
  branch: string;
  bankAccount: string;
  bankName: string;
  chargeTo: string;
  claimDate: string; // YYYY-MM-DD
}

export interface ClaimItem {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  category: string;
  description: string;
  receiptNo?: string;
  amount: number | string;
  currency?: string;
  receiptImage?: string;
  receiptPage?: number;
}

export interface ReimbursementClaim {
  id: string;
  claimNumber: string;
  employee: EmployeeInfo;
  items: ClaimItem[];
  updatedAt?: number;
}

export interface MileageClaimRow {
  id: string;
  date: string; // YYYY-MM-DD
  from: string;
  to: string;
  purpose: string;
  startOdometer?: number | string;
  endOdometer?: number | string;
  distanceKm: number | string;
  rate: number | string;
  remarks?: string;
}

export interface MileageClaim {
  id: string;
  claimNumber: string;
  employee: EmployeeInfo;
  rows: MileageClaimRow[];
  currency?: string;
  updatedAt?: number;
}

export interface BenefitClaimItem {
  id: string;
  date: string; // YYYY-MM-DD
  benefitType: string;
  description: string;
  amount: number | string;
  currency?: string;
  receiptRef?: string;
  receiptFileUrl?: string;
  receiptFileName?: string;
  remarks?: string;
}

export interface StaffBenefitClaim {
  id: string;
  claimNumber: string;
  employee: EmployeeInfo;
  items: BenefitClaimItem[];
  updatedAt?: number;
}
