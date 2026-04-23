import type { StaffBenefitClaim } from '../types';
import type { MedicalLegacyEntry } from '../types';

export const MEDICAL_YEARLY_QUOTA = 200;
export const MEDICAL_ITEM_MAX = 50;

export type MedicalUsageEntry = {
  claimId: string;
  claimNumber: string;
  date: string;
  amount: number;
  description: string;
};

export type MedicalUsageSummary = {
  employeeName: string;
  year: number;
  used: number;
  remaining: number;
  entries: MedicalUsageEntry[];
  lastUsedDate: string | null;
};

function yearFromDate(dateStr: string | undefined | null): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return new Date().getFullYear();
  return Number(m[1]);
}

function toNumber(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

export function createEmptyMedicalUsageSummary(employeeName: string, year: number): MedicalUsageSummary {
  return {
    employeeName: (employeeName || '').trim(),
    year,
    used: 0,
    remaining: MEDICAL_YEARLY_QUOTA,
    entries: [],
    lastUsedDate: null,
  };
}

export function listBenefitClaimYears(benefitClaims: StaffBenefitClaim[]): number[] {
  const years = new Set<number>();
  for (const claim of benefitClaims || []) {
    const y = yearFromDate(claim?.employee?.claimDate || null);
    if (Number.isFinite(y)) years.add(y);
  }
  const current = new Date().getFullYear();
  years.add(current);
  return Array.from(years).sort((a, b) => b - a);
}

export function computeMedicalUsage(
  benefitClaims: StaffBenefitClaim[],
  opts?: { year?: number; excludeClaimId?: string | null }
): Map<string, MedicalUsageSummary> {
  const targetYear = opts?.year ?? new Date().getFullYear();
  const excludeId = opts?.excludeClaimId ?? null;

  const map = new Map<string, MedicalUsageSummary>();

  for (const claim of benefitClaims || []) {
    if (!claim) continue;
    if (excludeId && claim.id === excludeId) continue;
    const claimDate = claim.employee?.claimDate || '';
    const year = yearFromDate(claimDate);
    if (year !== targetYear) continue;
    const employeeName = (claim.employee?.name || '').trim();
    if (!employeeName) continue;

    const items = claim.items || [];
    for (const item of items) {
      if (!item) continue;
      if ((item.benefitType || '').trim() !== 'Medical') continue;
      const entry: MedicalUsageEntry = {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        date: item.date || claimDate || '',
        amount: toNumber(item.amount),
        description: (item.description || '').trim(),
      };

      const key = `${employeeName}::${targetYear}`;
      const existing =
        map.get(key) ||
        createEmptyMedicalUsageSummary(employeeName, targetYear);

      existing.used += entry.amount;
      existing.entries.push(entry);
      if (entry.date && (!existing.lastUsedDate || entry.date > existing.lastUsedDate)) {
        existing.lastUsedDate = entry.date;
      }

      map.set(key, existing);
    }
  }

  for (const summary of map.values()) {
    summary.remaining = Math.max(0, MEDICAL_YEARLY_QUOTA - summary.used);
    summary.entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  return map;
}

export function sumMedicalItems(items: Array<{ benefitType?: string; amount?: unknown }>): number {
  return (items || [])
    .filter((i) => (i?.benefitType || '').trim() === 'Medical')
    .reduce((s, i) => s + toNumber(i?.amount), 0);
}

export type MedicalLedgerEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  employeeName: string;
  clinicName: string;
  totalAmount: number | null;
  claimedAmount: number;
  source: 'benefit' | 'legacy';
  claimNumber?: string;
};

export function parseDateToISO(dateStr: string): string | null {
  const s = String(dateStr || '').trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const iso2 = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s);
  if (iso2) return `${iso2[1]}-${iso2[2]}-${iso2[3]}`;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const dmy2 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (dmy2) {
    const dd = dmy2[1].padStart(2, '0');
    const mm = dmy2[2].padStart(2, '0');
    return `${dmy2[3]}-${mm}-${dd}`;
  }
  const dmy3 = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (dmy3) {
    const dd = dmy3[1].padStart(2, '0');
    const mm = dmy3[2].padStart(2, '0');
    return `${dmy3[3]}-${mm}-${dd}`;
  }

  // Compact formats commonly found in spreadsheets: "DDMMYYYY", "DDMM YYYY", "DMMYYYY", etc.
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4, 8));
    if (yyyy >= 1900 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  if (digits.length === 7) {
    // Try DMMYYYY
    const dd = Number(digits.slice(0, 1));
    const mm = Number(digits.slice(1, 3));
    const yyyy = Number(digits.slice(3, 7));
    if (yyyy >= 1900 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
    // Try DD M YYYY (e.g. "010 2026" after stripping)
    const dd2 = Number(digits.slice(0, 2));
    const mm2 = Number(digits.slice(2, 3));
    const yyyy2 = Number(digits.slice(3, 7));
    if (yyyy2 >= 1900 && yyyy2 <= 2100 && mm2 >= 1 && mm2 <= 12 && dd2 >= 1 && dd2 <= 31) {
      return `${String(yyyy2)}-${String(mm2).padStart(2, '0')}-${String(dd2).padStart(2, '0')}`;
    }
  }
  return null;
}

export function extractMedicalLedgerEntries(
  benefitClaims: StaffBenefitClaim[],
  legacy: MedicalLegacyEntry[],
  opts: { year: number; excludeClaimId?: string | null }
): MedicalLedgerEntry[] {
  const targetYear = opts.year;
  const excludeId = opts.excludeClaimId ?? null;
  const entries: MedicalLedgerEntry[] = [];

  for (const claim of benefitClaims || []) {
    if (!claim) continue;
    if (excludeId && claim.id === excludeId) continue;
    const claimDate = claim.employee?.claimDate || '';
    const y = yearFromDate(claimDate);
    if (y !== targetYear) continue;
    const employeeName = (claim.employee?.name || '').trim();
    if (!employeeName) continue;
    for (const item of claim.items || []) {
      if (!item) continue;
      if ((item.benefitType || '').trim() !== 'Medical') continue;
      const d = parseDateToISO(item.date || claimDate || '') || '';
      entries.push({
        id: `${claim.id}:${item.id}`,
        date: d,
        employeeName,
        clinicName: (item.description || 'Medical').trim(),
        totalAmount: null,
        claimedAmount: toNumber(item.amount),
        source: 'benefit',
        claimNumber: claim.claimNumber,
      });
    }
  }

  for (const e of legacy || []) {
    if (!e) continue;
    const d = parseDateToISO(e.date);
    if (!d) continue;
    const y = yearFromDate(d);
    if (y !== targetYear) continue;
    const employeeName = (e.employeeName || '').trim();
    if (!employeeName) continue;
    entries.push({
      id: e.id,
      date: d,
      employeeName,
      clinicName: (e.clinicName || 'Medical').trim(),
      totalAmount: typeof e.totalAmount === 'number' && Number.isFinite(e.totalAmount) ? e.totalAmount : null,
      claimedAmount: toNumber(e.claimedAmount),
      source: 'legacy',
    });
  }

  entries.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.employeeName.localeCompare(b.employeeName));
  return entries;
}

export function parseLegacyMedicalEntriesFromText(text: string): Array<Omit<MedicalLegacyEntry, 'id'>> {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('staff') || first.includes('clinic') || first.includes('claimed') || first.includes('quota');

  const rows = hasHeader ? lines.slice(1) : lines;
  const out: Array<Omit<MedicalLegacyEntry, 'id'>> = [];

  for (const line of rows) {
    const cols = line.split(/\t|,/).map((c) => c.trim());
    if (!cols.length) continue;
    const firstCol = (cols[0] || '').toUpperCase();
    if (firstCol === 'TOTAL' || firstCol === 'JANUARY' || firstCol === 'FEBRUARY' || firstCol === 'MARCH' || firstCol === 'APRIL') continue;

    // Expected: No, Date, Staff Name, Clinic Name, Total Amount, Claimed Amount, ...
    const dateRaw = cols[1] || cols[0] || '';
    const date = parseDateToISO(dateRaw);
    if (!date) continue;
    const employeeName = cols[2] || cols[1] || '';
    const clinicName = cols[3] || '';
    const totalAmount = toNumber(cols[4]);
    const claimedAmount = toNumber(cols[5] ?? cols[4] ?? '');
    if (!employeeName.trim() || !Number.isFinite(claimedAmount) || claimedAmount <= 0) continue;

    out.push({
      employeeName: employeeName.trim(),
      date,
      clinicName: clinicName.trim(),
      totalAmount: Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : undefined,
      claimedAmount,
      createdAt: Date.now(),
    });
  }

  return out;
}
