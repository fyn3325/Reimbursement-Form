import { Expense, SheetData } from '../types';

// Added parseCSV function to parse raw CSV string into SheetData
export const parseCSV = (csvText: string, name: string): SheetData => {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    return { id: crypto.randomUUID(), name, headers: [], rows: [] };
  }
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim();
    });
    return row;
  });

  return {
    id: crypto.randomUUID(),
    name,
    headers,
    rows
  };
};

export const exportAuditReport = (expenses: Expense[]): string => {
  const headers = ['Date', 'Merchant', 'Amount', 'Currency', 'Category', 'Reasoning', 'Receipt_Attached', 'Audit_Status'];
  const headerLine = headers.join(',');

  const rows = expenses.map(e => {
    const status = e.category === 'COMPANY' && !e.hasReceipt ? 'NON_COMPLIANT' : 'OK';
    return [
      e.date,
      `"${e.merchant}"`,
      e.amount,
      e.currency,
      e.category,
      `"${e.reasoning}"`,
      e.hasReceipt ? 'Yes' : 'No',
      status
    ].join(',');
  });

  return [headerLine, ...rows].join('\n');
};