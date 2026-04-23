import {
  ref,
  set,
  get,
  remove,
  onValue,
  Unsubscribe,
  DataSnapshot,
} from 'firebase/database';
import { getFirebaseDatabase } from './firebase';
import type { MedicalLegacyEntry, MileageClaim, ReimbursementClaim, StaffBenefitClaim } from '../types';

const CLAIMS_PATH = 'claims';
const MILEAGE_CLAIMS_PATH = 'mileageClaims';
const BENEFIT_CLAIMS_PATH = 'benefitClaims';
const MEDICAL_LEGACY_PATH = 'medicalLegacy';

function claimsRef() {
  return ref(getFirebaseDatabase(), CLAIMS_PATH);
}

function claimRef(id: string) {
  return ref(getFirebaseDatabase(), `${CLAIMS_PATH}/${id}`);
}

function parseClaimFromSnapshot(snapshot: DataSnapshot): ReimbursementClaim | null {
  const val = snapshot.val();
  if (!val) return null;
  return { ...val, id: snapshot.key } as ReimbursementClaim;
}

export async function saveClaim(claim: ReimbursementClaim): Promise<void> {
  const { id, ...rest } = claim;
  await set(claimRef(id), rest);
}

export async function getClaim(id: string): Promise<ReimbursementClaim | null> {
  const snapshot = await get(claimRef(id));
  if (!snapshot.exists()) return null;
  return parseClaimFromSnapshot(snapshot);
}

export async function getAllClaims(): Promise<ReimbursementClaim[]> {
  const snapshot = await get(claimsRef());
  if (!snapshot.exists()) return [];
  const list: ReimbursementClaim[] = [];
  snapshot.forEach((child) => {
    const c = parseClaimFromSnapshot(child);
    if (c) list.push(c);
  });
  return list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function deleteClaim(id: string): Promise<void> {
  await remove(claimRef(id));
}

export function subscribeToClaims(callback: (claims: ReimbursementClaim[]) => void): Unsubscribe {
  return onValue(claimsRef(), (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const list: ReimbursementClaim[] = [];
    snapshot.forEach((child) => {
      const c = parseClaimFromSnapshot(child);
      if (c) list.push(c);
    });
    callback(list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
  });
}

function mileageClaimsRef() {
  return ref(getFirebaseDatabase(), MILEAGE_CLAIMS_PATH);
}

function mileageClaimRef(id: string) {
  return ref(getFirebaseDatabase(), `${MILEAGE_CLAIMS_PATH}/${id}`);
}

function parseMileageClaimFromSnapshot(snapshot: DataSnapshot): MileageClaim | null {
  const val = snapshot.val();
  if (!val) return null;
  return { ...val, id: snapshot.key } as MileageClaim;
}

export async function saveMileageClaim(claim: MileageClaim): Promise<void> {
  const { id, ...rest } = claim;
  await set(mileageClaimRef(id), rest);
}

export async function deleteMileageClaim(id: string): Promise<void> {
  await remove(mileageClaimRef(id));
}

export function subscribeToMileageClaims(callback: (claims: MileageClaim[]) => void): Unsubscribe {
  return onValue(mileageClaimsRef(), (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const list: MileageClaim[] = [];
    snapshot.forEach((child) => {
      const c = parseMileageClaimFromSnapshot(child);
      if (c) list.push(c);
    });
    callback(list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
  });
}

function benefitClaimsRef() {
  return ref(getFirebaseDatabase(), BENEFIT_CLAIMS_PATH);
}

function benefitClaimRef(id: string) {
  return ref(getFirebaseDatabase(), `${BENEFIT_CLAIMS_PATH}/${id}`);
}

function parseBenefitClaimFromSnapshot(snapshot: DataSnapshot): StaffBenefitClaim | null {
  const val = snapshot.val();
  if (!val) return null;
  return { ...val, id: snapshot.key } as StaffBenefitClaim;
}

export async function saveBenefitClaim(claim: StaffBenefitClaim): Promise<void> {
  const { id, ...rest } = claim;
  await set(benefitClaimRef(id), rest);
}

export async function deleteBenefitClaim(id: string): Promise<void> {
  await remove(benefitClaimRef(id));
}

export function subscribeToBenefitClaims(callback: (claims: StaffBenefitClaim[]) => void): Unsubscribe {
  return onValue(benefitClaimsRef(), (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const list: StaffBenefitClaim[] = [];
    snapshot.forEach((child) => {
      const c = parseBenefitClaimFromSnapshot(child);
      if (c) list.push(c);
    });
    callback(list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
  });
}

function medicalLegacyRef() {
  return ref(getFirebaseDatabase(), MEDICAL_LEGACY_PATH);
}

function medicalLegacyEntryRef(id: string) {
  return ref(getFirebaseDatabase(), `${MEDICAL_LEGACY_PATH}/${id}`);
}

function parseMedicalLegacyEntryFromSnapshot(snapshot: DataSnapshot): MedicalLegacyEntry | null {
  const val = snapshot.val();
  if (!val) return null;
  return { ...val, id: snapshot.key } as MedicalLegacyEntry;
}

export async function saveMedicalLegacyEntry(entry: MedicalLegacyEntry): Promise<void> {
  const { id, ...rest } = entry;
  await set(medicalLegacyEntryRef(id), rest);
}

export async function deleteMedicalLegacyEntry(id: string): Promise<void> {
  await remove(medicalLegacyEntryRef(id));
}

export function subscribeToMedicalLegacy(callback: (entries: MedicalLegacyEntry[]) => void): Unsubscribe {
  return onValue(medicalLegacyRef(), (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const list: MedicalLegacyEntry[] = [];
    snapshot.forEach((child) => {
      const e = parseMedicalLegacyEntryFromSnapshot(child);
      if (e) list.push(e);
    });
    callback(list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
  });
}
