import type { MedicalLegacyEntry, MileageClaim, ReimbursementClaim, StaffBenefitClaim } from '../types';
import {
  removePaidClaim,
  saveBenefitClaim,
  saveClaim,
  saveMedicalLegacyEntry,
  saveMileageClaim,
  setPaidClaim,
} from './supabase-db';
import { uploadBenefitReceiptFile, uploadReceiptImage } from './supabase-storage';

const MIGRATION_MARKER_KEY = 'auditlink_supabase_local_migration_v1';
const CLAIMS_HISTORY_KEY = 'auditlink_claims_history';
const BENEFIT_HISTORY_KEY = 'auditlink_benefit_claims_history';
const MILEAGE_HISTORY_KEY = 'auditlink_mileage_claims_history';
const MEDICAL_LEGACY_KEY = 'auditlink_medical_legacy_entries';
const PAID_CLAIMS_KEY = 'auditlink_paid_claims';
const PENDING_BENEFIT_RECEIPTS_KEY = 'auditlink_pending_benefit_receipts_v1';
const LOCAL_BENEFIT_RECEIPT_PREFIX = 'local-benefit-receipt:';

type MigrationSummary = {
  reimbursement: number;
  benefit: number;
  mileage: number;
  medicalLegacy: number;
  paidClaims: number;
  errors: number;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function mimeFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;]+);/i.exec(dataUrl);
  return match?.[1] || 'application/octet-stream';
}

function pendingBenefitReceiptData(ref: unknown): string {
  if (typeof ref !== 'string' || !ref.startsWith(LOCAL_BENEFIT_RECEIPT_PREFIX)) return '';
  const rest = ref.slice(LOCAL_BENEFIT_RECEIPT_PREFIX.length);
  const [claimId, itemId] = rest.split(':');
  if (!claimId || !itemId) return '';
  const pending = readJson<Record<string, Record<string, { dataUrl?: string }>>>(PENDING_BENEFIT_RECEIPTS_KEY, {});
  return pending?.[claimId]?.[itemId]?.dataUrl || '';
}

async function migrateReimbursementClaim(claim: ReimbursementClaim): Promise<void> {
  const items = await Promise.all(
    (claim.items || []).map(async (item) => {
      if (!isDataUrl(item.receiptImage)) return item;
      const receiptImage = await uploadReceiptImage(claim.id, item.id, item.receiptImage, mimeFromDataUrl(item.receiptImage));
      return { ...item, receiptImage };
    })
  );
  await saveClaim({ ...claim, items });
}

async function migrateBenefitClaim(claim: StaffBenefitClaim): Promise<void> {
  const items = await Promise.all(
    (claim.items || []).map(async (item) => {
      const localReceipt = isDataUrl(item.receiptFileUrl) ? item.receiptFileUrl : pendingBenefitReceiptData(item.receiptRef);
      if (!localReceipt) return item;
      const receiptFileUrl = await uploadBenefitReceiptFile(claim.id, item.id, localReceipt);
      return { ...item, receiptFileUrl, receiptRef: '', receiptFileName: item.receiptFileName };
    })
  );
  await saveBenefitClaim({ ...claim, items });
}

async function migratePaidClaims(): Promise<number> {
  const paidClaims = readJson<Record<string, { paidAt?: string }>>(PAID_CLAIMS_KEY, {});
  let count = 0;
  for (const [key, value] of Object.entries(paidClaims || {})) {
    const separatorIndex = key.indexOf(':');
    if (separatorIndex === -1) continue;
    const kind = key.slice(0, separatorIndex);
    const id = key.slice(separatorIndex + 1);
    if (!kind || !id) continue;
    if (value?.paidAt) {
      await setPaidClaim(kind, id, value.paidAt);
    } else {
      await removePaidClaim(kind, id);
    }
    count++;
  }
  return count;
}

export async function migrateLocalHistoryToSupabase(): Promise<MigrationSummary | null> {
  if (localStorage.getItem(MIGRATION_MARKER_KEY)) return null;

  const summary: MigrationSummary = {
    reimbursement: 0,
    benefit: 0,
    mileage: 0,
    medicalLegacy: 0,
    paidClaims: 0,
    errors: 0,
  };

  const reimbursementClaims = readJson<ReimbursementClaim[]>(CLAIMS_HISTORY_KEY, []);
  const benefitClaims = readJson<StaffBenefitClaim[]>(BENEFIT_HISTORY_KEY, []);
  const mileageClaims = readJson<MileageClaim[]>(MILEAGE_HISTORY_KEY, []);
  const medicalLegacy = readJson<MedicalLegacyEntry[]>(MEDICAL_LEGACY_KEY, []);

  for (const claim of Array.isArray(reimbursementClaims) ? reimbursementClaims : []) {
    try {
      await migrateReimbursementClaim(claim);
      summary.reimbursement++;
    } catch (error) {
      summary.errors++;
      console.warn('Failed to migrate reimbursement claim', claim?.id, error);
    }
  }

  for (const claim of Array.isArray(benefitClaims) ? benefitClaims : []) {
    try {
      await migrateBenefitClaim(claim);
      summary.benefit++;
    } catch (error) {
      summary.errors++;
      console.warn('Failed to migrate benefit claim', claim?.id, error);
    }
  }

  for (const claim of Array.isArray(mileageClaims) ? mileageClaims : []) {
    try {
      await saveMileageClaim(claim);
      summary.mileage++;
    } catch (error) {
      summary.errors++;
      console.warn('Failed to migrate mileage claim', claim?.id, error);
    }
  }

  for (const entry of Array.isArray(medicalLegacy) ? medicalLegacy : []) {
    try {
      await saveMedicalLegacyEntry(entry);
      summary.medicalLegacy++;
    } catch (error) {
      summary.errors++;
      console.warn('Failed to migrate medical legacy entry', entry?.id, error);
    }
  }

  try {
    summary.paidClaims = await migratePaidClaims();
  } catch (error) {
    summary.errors++;
    console.warn('Failed to migrate paid claims', error);
  }

  localStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify({ migratedAt: new Date().toISOString(), summary }));
  return summary;
}
