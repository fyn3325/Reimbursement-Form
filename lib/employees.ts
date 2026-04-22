import { EMPLOYEES_LIST } from '../constants';

export type EmployeeRecord = { name: string; account: string; bank: string };

const DEFAULT_EMPLOYEES_KEY = 'auditlink_default_employees';
const CUSTOM_EMPLOYEES_KEY = 'auditlink_custom_employees';

function safeParseEmployees(raw: string | null): EmployeeRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.name === 'string')
      .map((e) => ({
        name: String(e.name).trim(),
        account: String(e.account ?? '').trim(),
        bank: String(e.bank ?? '').trim(),
      }))
      .filter((e) => e.name.length > 0);
  } catch {
    return [];
  }
}

export function loadEmployees(): EmployeeRecord[] {
  const defaults = safeParseEmployees(localStorage.getItem(DEFAULT_EMPLOYEES_KEY));
  const customs = safeParseEmployees(localStorage.getItem(CUSTOM_EMPLOYEES_KEY));

  const byName = new Map<string, EmployeeRecord>();
  // Start with bundled list.
  for (const e of EMPLOYEES_LIST) {
    byName.set(e.name, { name: e.name, account: e.account, bank: e.bank });
  }
  // Overwrite with user-edited defaults.
  for (const e of defaults) {
    byName.set(e.name, e);
  }
  // Add/overwrite with custom employees.
  for (const e of customs) {
    byName.set(e.name, e);
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

