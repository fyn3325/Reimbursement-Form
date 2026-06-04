import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from './supabase';
import * as firebaseDb from './supabase-db';
import type { PaidClaimsMap } from './supabase-db';

const PAID_CLAIMS_KEY = 'paidClaims:v1';
const PAID_CLAIMS_UPDATED_EVENT = 'auditlink:paid-claims-updated';

function loadLocalPaidClaims(): PaidClaimsMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const saved = localStorage.getItem(PAID_CLAIMS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveLocalPaidClaims(paidClaims: PaidClaimsMap): void {
  try {
    localStorage.setItem(PAID_CLAIMS_KEY, JSON.stringify(paidClaims));
    window.dispatchEvent(new Event(PAID_CLAIMS_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function usePaidClaims() {
  const [paidClaims, setPaidClaims] = useState<PaidClaimsMap>(() => loadLocalPaidClaims());
  const seededRef = useRef(false);
  const localSeedRef = useRef<PaidClaimsMap>(paidClaims);

  useEffect(() => {
    const refreshLocalPaidClaims = () => setPaidClaims(loadLocalPaidClaims());
    window.addEventListener('storage', refreshLocalPaidClaims);
    window.addEventListener(PAID_CLAIMS_UPDATED_EVENT, refreshLocalPaidClaims);

    return () => {
      window.removeEventListener('storage', refreshLocalPaidClaims);
      window.removeEventListener(PAID_CLAIMS_UPDATED_EVENT, refreshLocalPaidClaims);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const unsub = firebaseDb.subscribeToPaidClaims((remote) => {
      if (!seededRef.current) {
        seededRef.current = true;
        const local = localSeedRef.current || {};
        if (Object.keys(remote).length === 0 && Object.keys(local).length > 0) {
          Object.entries(local).forEach(([paidKey, val]) => {
            const [kind, id] = paidKey.split(':');
            const paidAt = val?.paidAt;
            if (!kind || !id || !paidAt) return;
            firebaseDb.setPaidClaim(kind, id, paidAt).catch(() => {
              // ignore
            });
          });
          return;
        }
      }

      setPaidClaims(remote);
      saveLocalPaidClaims(remote);
    });

    return () => unsub();
  }, []);

  const togglePaid = (paidKey: string) => {
    const [kind, id] = paidKey.split(':');
    setPaidClaims((prev) => {
      const next = { ...prev };
      if (next[paidKey]) {
        delete next[paidKey];
        if (isSupabaseConfigured() && kind && id) {
          firebaseDb.removePaidClaim(kind, id).catch(() => {
            // ignore
          });
        }
      } else {
        const paidAt = new Date().toISOString().slice(0, 10);
        next[paidKey] = { paidAt };
        if (isSupabaseConfigured() && kind && id) {
          firebaseDb.setPaidClaim(kind, id, paidAt).catch(() => {
            // ignore
          });
        }
      }

      saveLocalPaidClaims(next);
      return next;
    });
  };

  const setPaidDate = (paidKey: string, paidAt: string) => {
    const [kind, id] = paidKey.split(':');
    setPaidClaims((prev) => {
      const next = { ...prev, [paidKey]: { paidAt } };
      if (isSupabaseConfigured() && kind && id) {
        firebaseDb.setPaidClaim(kind, id, paidAt).catch(() => {
          // ignore
        });
      }

      saveLocalPaidClaims(next);
      return next;
    });
  };

  return { paidClaims, togglePaid, setPaidDate };
}
