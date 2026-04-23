import type { StaffBenefitClaim } from '../types';

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
