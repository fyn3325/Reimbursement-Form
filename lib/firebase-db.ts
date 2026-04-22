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
import type { ReimbursementClaim } from '../types';

const CLAIMS_PATH = 'claims';

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
