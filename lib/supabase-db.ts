import { getSupabaseClient } from './supabase';
import type { MedicalLegacyEntry, MileageClaim, ReimbursementClaim, StaffBenefitClaim } from '../types';

export type PaidClaimsMap = Record<string, { paidAt: string }>;
type Unsubscribe = () => void;

// ── Reimbursement Claims ───────────────────────────────────────

function mapClaim(row: any): ReimbursementClaim {
  return {
    id: row.id,
    claimNumber: row.claim_number,
    employee: row.employee,
    items: row.items ?? [],
    updatedAt: row.updated_at,
  };
}

export async function saveClaim(claim: ReimbursementClaim): Promise<void> {
  const { id, claimNumber, employee, items, updatedAt } = claim;
  const { error } = await getSupabaseClient()
    .from('reimbursement_claims')
    .upsert({ id, claim_number: claimNumber, employee, items, updated_at: updatedAt });
  if (error) throw error;
}

export async function getClaim(id: string): Promise<ReimbursementClaim | null> {
  const { data, error } = await getSupabaseClient()
    .from('reimbursement_claims')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapClaim(data);
}

export async function getAllClaims(): Promise<ReimbursementClaim[]> {
  const { data, error } = await getSupabaseClient()
    .from('reimbursement_claims')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapClaim);
}

export async function deleteClaim(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('reimbursement_claims').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToClaims(callback: (claims: ReimbursementClaim[]) => void): Unsubscribe {
  const supabase = getSupabaseClient();
  const refetch = async () => {
    const { data } = await supabase.from('reimbursement_claims').select('*').order('updated_at', { ascending: false });
    callback((data ?? []).map(mapClaim));
  };
  refetch();
  const channel = supabase
    .channel('reimbursement_claims')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reimbursement_claims' }, refetch)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Mileage Claims ─────────────────────────────────────────────

function mapMileageClaim(row: any): MileageClaim {
  return {
    id: row.id,
    claimNumber: row.claim_number,
    employee: row.employee,
    rows: row.rows ?? [],
    currency: row.currency,
    updatedAt: row.updated_at,
  };
}

export async function saveMileageClaim(claim: MileageClaim): Promise<void> {
  const { id, claimNumber, employee, rows, currency, updatedAt } = claim;
  const { error } = await getSupabaseClient()
    .from('mileage_claims')
    .upsert({ id, claim_number: claimNumber, employee, rows, currency, updated_at: updatedAt });
  if (error) throw error;
}

export async function deleteMileageClaim(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('mileage_claims').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToMileageClaims(callback: (claims: MileageClaim[]) => void): Unsubscribe {
  const supabase = getSupabaseClient();
  const refetch = async () => {
    const { data } = await supabase.from('mileage_claims').select('*').order('updated_at', { ascending: false });
    callback((data ?? []).map(mapMileageClaim));
  };
  refetch();
  const channel = supabase
    .channel('mileage_claims')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mileage_claims' }, refetch)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Benefit Claims ─────────────────────────────────────────────

function mapBenefitClaim(row: any): StaffBenefitClaim {
  return {
    id: row.id,
    claimNumber: row.claim_number,
    employee: row.employee,
    items: row.items ?? [],
    updatedAt: row.updated_at,
  };
}

export async function saveBenefitClaim(claim: StaffBenefitClaim): Promise<void> {
  const { id, claimNumber, employee, items, updatedAt } = claim;
  const { error } = await getSupabaseClient()
    .from('benefit_claims')
    .upsert({ id, claim_number: claimNumber, employee, items, updated_at: updatedAt });
  if (error) throw error;
}

export async function deleteBenefitClaim(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('benefit_claims').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToBenefitClaims(callback: (claims: StaffBenefitClaim[]) => void): Unsubscribe {
  const supabase = getSupabaseClient();
  const refetch = async () => {
    const { data } = await supabase.from('benefit_claims').select('*').order('updated_at', { ascending: false });
    callback((data ?? []).map(mapBenefitClaim));
  };
  refetch();
  const channel = supabase
    .channel('benefit_claims')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'benefit_claims' }, refetch)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Medical Legacy ─────────────────────────────────────────────

function mapMedicalLegacy(row: any): MedicalLegacyEntry {
  return {
    id: row.id,
    employeeName: row.employee_name,
    date: row.date,
    clinicName: row.clinic_name,
    totalAmount: row.total_amount,
    claimedAmount: row.claimed_amount,
    createdAt: row.created_at,
  };
}

export async function saveMedicalLegacyEntry(entry: MedicalLegacyEntry): Promise<void> {
  const { id, employeeName, date, clinicName, totalAmount, claimedAmount, createdAt } = entry;
  const { error } = await getSupabaseClient()
    .from('medical_legacy')
    .upsert({ id, employee_name: employeeName, date, clinic_name: clinicName, total_amount: totalAmount, claimed_amount: claimedAmount, created_at: createdAt });
  if (error) throw error;
}

export async function deleteMedicalLegacyEntry(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('medical_legacy').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToMedicalLegacy(callback: (entries: MedicalLegacyEntry[]) => void): Unsubscribe {
  const supabase = getSupabaseClient();
  const refetch = async () => {
    const { data } = await supabase.from('medical_legacy').select('*').order('created_at', { ascending: false });
    callback((data ?? []).map(mapMedicalLegacy));
  };
  refetch();
  const channel = supabase
    .channel('medical_legacy')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_legacy' }, refetch)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Paid Claims ────────────────────────────────────────────────

export async function setPaidClaim(kind: string, id: string, paidAt: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('paid_claims')
    .upsert({ kind, claim_id: id, paid_at: paidAt, updated_at: Date.now() });
  if (error) throw error;
}

export async function removePaidClaim(kind: string, id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('paid_claims')
    .delete()
    .eq('kind', kind)
    .eq('claim_id', id);
  if (error) throw error;
}

export function subscribeToPaidClaims(callback: (paidClaims: PaidClaimsMap) => void): Unsubscribe {
  const supabase = getSupabaseClient();
  const refetch = async () => {
    const { data } = await supabase.from('paid_claims').select('*');
    const out: PaidClaimsMap = {};
    for (const row of data ?? []) {
      out[`${row.kind}:${row.claim_id}`] = { paidAt: row.paid_at };
    }
    callback(out);
  };
  refetch();
  const channel = supabase
    .channel('paid_claims')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'paid_claims' }, refetch)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
