import React, { useEffect, useMemo, useState } from 'react';
import type { MedicalLegacyEntry, StaffBenefitClaim } from '../types';
import {
  createEmptyMedicalUsageSummary,
  computeMedicalUsage,
  extractMedicalLedgerEntries,
  listBenefitClaimYears,
  MEDICAL_ITEM_MAX,
  MEDICAL_YEARLY_QUOTA,
  parseDateToISO,
  parseLegacyMedicalEntriesFromText,
} from '../lib/quota';
import { loadEmployees } from '../lib/employees';
import { isFirebaseConfigured } from '../lib/firebase';
import * as firebaseDb from '../lib/firebase-db';

type MedicalQuotaViewProps = {
  benefitHistory: StaffBenefitClaim[];
};

function formatMoney(n: number): string {
  return `RM${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

const LEGACY_KEY = 'auditlink_medical_legacy_entries';

const MedicalQuotaView: React.FC<MedicalQuotaViewProps> = ({ benefitHistory }) => {
  const years = useMemo(() => listBenefitClaimYears(benefitHistory), [benefitHistory]);
  const [year, setYear] = useState<number>(() => years[0] ?? new Date().getFullYear());
  const [query, setQuery] = useState('');
  const [openEmployee, setOpenEmployee] = useState<string | null>(null);
  const [mode, setMode] = useState<'summary' | 'ledger'>('summary');
  const [legacy, setLegacy] = useState<MedicalLegacyEntry[]>([]);

  const medicalUsageMap = useMemo(() => computeMedicalUsage(benefitHistory, { year }), [benefitHistory, year]);
  const employees = loadEmployees();

  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsub = firebaseDb.subscribeToMedicalLegacy((entries) => setLegacy(entries));
      return () => unsub();
    }
    try {
      const saved = localStorage.getItem(LEGACY_KEY);
      const loaded = saved ? JSON.parse(saved) : [];
      setLegacy(Array.isArray(loaded) ? loaded : []);
    } catch {
      setLegacy([]);
    }
  }, []);

  const rows = useMemo(() => {
    const names = new Set<string>();
    for (const e of employees) {
      const n = (e?.name || '').trim();
      if (n) names.add(n);
    }
    for (const v of medicalUsageMap.values()) {
      const n = (v?.employeeName || '').trim();
      if (n) names.add(n);
    }

    const q = query.trim().toLowerCase();
    const list = Array.from(names)
      .filter((n) => (!q ? true : n.toLowerCase().includes(q)))
      .sort((a, b) => a.localeCompare(b));

    return list.map((employeeName) => {
      const key = `${employeeName}::${year}`;
      const base = medicalUsageMap.get(key) || createEmptyMedicalUsageSummary(employeeName, year);
      const extra = legacy
        .filter((e) => (e.employeeName || '').trim() === employeeName)
        .filter((e) => String(e.date || '').startsWith(String(year)));
      if (!extra.length) return base;
      const add = extra.reduce((s, e) => s + (Number.isFinite(e.claimedAmount) ? e.claimedAmount : 0), 0);
      const used = base.used + add;
      const legacyLast = extra
        .map((e) => String(e.date || '').trim())
        .filter(Boolean)
        .sort()
        .at(-1);
      return {
        ...base,
        used,
        remaining: Math.max(0, MEDICAL_YEARLY_QUOTA - used),
        lastUsedDate: legacyLast && (!base.lastUsedDate || legacyLast > base.lastUsedDate) ? legacyLast : base.lastUsedDate,
      };
    });
  }, [employees, legacy, medicalUsageMap, query, year]);

  const ledgerEntries = useMemo(() => extractMedicalLedgerEntries(benefitHistory, legacy, { year }), [benefitHistory, legacy, year]);
  const ledgerSections = useMemo(() => {
    const usedByEmployee = new Map<string, number>();
    const computed = ledgerEntries.map((e) => {
      const prev = usedByEmployee.get(e.employeeName) || 0;
      const nextUsed = prev + e.claimedAmount;
      usedByEmployee.set(e.employeeName, nextUsed);
      const balance = Math.max(0, MEDICAL_YEARLY_QUOTA - nextUsed);
      return { ...e, balance };
    });

    const groups = new Map<string, Array<(typeof computed)[number]>>();
    for (const e of computed) {
      const m = (e.date || '').slice(0, 7); // YYYY-MM
      if (!m) continue;
      const arr = groups.get(m) || [];
      arr.push(e);
      groups.set(m, arr);
    }
    const months = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
    return months.map((month) => {
      const list = groups.get(month) || [];
      const total = list.reduce((s, e) => s + e.claimedAmount, 0);
      return { month, total, list };
    });
  }, [ledgerEntries]);

  const monthLabel = (yyyymm: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(yyyymm);
    if (!m) return yyyymm;
    const idx = Number(m[2]);
    const names = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const name = names[idx - 1] || m[2];
    return `${name} ${m[1]}`;
  };

  const addLegacyEntries = async (parsed: Array<Omit<MedicalLegacyEntry, 'id'>>) => {
    if (!parsed.length) {
      alert('No valid rows found. Please upload a valid file (Excel/CSV).');
      return;
    }
    const existingKey = new Set(legacy.map((e) => `${e.employeeName}::${e.date}::${e.claimedAmount}::${e.clinicName || ''}`));
    const toAdd: MedicalLegacyEntry[] = [];
    for (const p of parsed) {
      const k = `${p.employeeName}::${p.date}::${p.claimedAmount}::${p.clinicName || ''}`;
      if (existingKey.has(k)) continue;
      toAdd.push({ id: crypto.randomUUID(), ...p });
    }
    if (!toAdd.length) {
      alert('All pasted rows already exist.');
      return;
    }

    if (isFirebaseConfigured()) {
      try {
        for (const e of toAdd) await firebaseDb.saveMedicalLegacyEntry(e);
      } catch (err) {
        console.error('Save medical legacy failed', err);
        alert('Failed to save to Firebase. Please check RTDB rules for "medicalLegacy".');
        return;
      }
    } else {
      const next = [...toAdd, ...legacy];
      setLegacy(next);
      localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
    }
    alert(`Imported ${toAdd.length} rows.`);
  };

  function formatDateObj(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const importFromFile = async (file: File) => {
    const name = (file.name || '').toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    const isCsv = name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt');

    try {
      if (isCsv) {
        const text = await file.text();
        const parsed = parseLegacyMedicalEntriesFromText(text);
        await addLegacyEntries(parsed);
        return;
      }

      if (isExcel) {
        // Use ESM CDN import to avoid bundling dependency.
        const XLSX: any = await import('https://esm.sh/xlsx@0.18.5');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames?.[0];
        if (!sheetName) throw new Error('No worksheet found.');
        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        if (!Array.isArray(rows) || !rows.length) throw new Error('Empty worksheet.');

        // Find header row
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const line = rows[i].map((c) => String(c || '').toLowerCase()).join(' | ');
          if (line.includes('staff') && line.includes('clinic') && (line.includes('claimed') || line.includes('claim'))) {
            headerRowIdx = i;
            break;
          }
        }
        const header = rows[headerRowIdx].map((c) => String(c || '').trim().toLowerCase());
        const colIndex = (needle: string) => header.findIndex((h) => h.replace(/\s+/g, ' ').includes(needle));
        const idxDate = colIndex('date');
        const idxStaff = colIndex('staff');
        const idxClinic = colIndex('clinic');
        const idxTotal = colIndex('total');
        const idxClaimed = colIndex('claimed');
        if (idxDate < 0 || idxStaff < 0 || idxClinic < 0 || idxClaimed < 0) {
          throw new Error('Could not detect required columns (Date/Staff Name/Clinic Name/Claimed Amount).');
        }

        const parsed: Array<Omit<MedicalLegacyEntry, 'id'>> = [];
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r.length) continue;
          const staffName = String(r[idxStaff] ?? '').trim();
          if (!staffName) continue;
          const firstCol = String(r[0] ?? '').trim().toUpperCase();
          if (firstCol === 'TOTAL') continue;

          const dateCell = r[idxDate];
          let dateIso: string | null = null;
          if (dateCell instanceof Date) dateIso = formatDateObj(dateCell);
          else dateIso = parseDateToISO(String(dateCell ?? ''));
          if (!dateIso) continue;

          const clinicName = String(r[idxClinic] ?? '').trim();
          const claimedAmount = Number(r[idxClaimed] ?? 0);
          const totalAmount = idxTotal >= 0 ? Number(r[idxTotal] ?? 0) : NaN;
          if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) continue;

          parsed.push({
            employeeName: staffName,
            date: dateIso,
            clinicName,
            totalAmount: Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : undefined,
            claimedAmount,
            createdAt: Date.now(),
          });
        }

        await addLegacyEntries(parsed);
        return;
      }

      alert('Please upload an Excel (.xlsx/.xls) or CSV/TSV file.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Import failed: ${msg}`);
    }
  };

  const totals = useMemo(() => {
    let used = 0;
    for (const r of rows) used += r.used;
    return { used, remaining: Math.max(0, rows.length * MEDICAL_YEARLY_QUOTA - used) };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="bg-[var(--brand-accent-soft)] border border-[#e2d3a8] rounded-xl shadow-sm p-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-gray-900">Medical Quota</div>
            <div className="text-xs text-gray-500 mt-1">
              Yearly quota per employee: RM{MEDICAL_YEARLY_QUOTA.toFixed(0)} · Max per medical entry: RM{MEDICAL_ITEM_MAX.toFixed(0)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-pink-700 hover:text-pink-800 px-2 py-2 cursor-pointer">
              Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  void importFromFile(file);
                }}
              />
            </label>
            <div className="flex items-center rounded-lg border border-[#e2d3a8] bg-white/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setMode('summary')}
                className={`px-3 py-2 text-sm font-semibold ${mode === 'summary' ? 'bg-[#f3ead6]' : 'hover:bg-[#fbf7ef]'}`}
              >
                Summary
              </button>
              <button
                type="button"
                onClick={() => setMode('ledger')}
                className={`px-3 py-2 text-sm font-semibold ${mode === 'ledger' ? 'bg-[#f3ead6]' : 'hover:bg-[#fbf7ef]'}`}
              >
                Listing
              </button>
            </div>
            <label className="text-xs font-bold text-gray-500 uppercase">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-[#e2d3a8] rounded-lg px-3 py-2 text-sm font-medium bg-white/70"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee…"
              className="border border-[#e2d3a8] rounded-lg px-3 py-2 text-sm font-medium bg-white/70"
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600">
          Employees: <span className="font-mono font-semibold">{rows.length}</span> · Total used: <span className="font-mono font-semibold">{formatMoney(totals.used)}</span>
        </div>
      </div>

      {mode === 'ledger' && (
        <div className="bg-white border border-[#e2d3a8] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead className="bg-[#f3ead6]">
                <tr className="text-xs font-bold text-gray-600 uppercase">
                  <th className="px-4 py-3 w-16">No</th>
                  <th className="px-4 py-3 w-32">Date</th>
                  <th className="px-4 py-3 w-56">Staff Name</th>
                  <th className="px-4 py-3">Clinic Name</th>
                  <th className="px-4 py-3 w-36 text-right">Total Amount</th>
                  <th className="px-4 py-3 w-40 text-right">Claimed Amount</th>
                  <th className="px-4 py-3 w-40 text-right">Quota Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerSections.map((g) => (
                  <React.Fragment key={g.month}>
                    <tr className="bg-[#f7f0df]">
                      <td className="px-4 py-2 font-bold text-gray-800" colSpan={4}>
                        TOTAL {monthLabel(g.month)}
                      </td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">{formatMoney(g.total)}</td>
                      <td className="px-4 py-2" />
                    </tr>
                    {g.list
                      .filter((e) => (!query.trim() ? true : e.employeeName.toLowerCase().includes(query.trim().toLowerCase())))
                      .map((e, idx) => (
                        <tr key={e.id} className="hover:bg-[#fbf7ef]">
                          <td className="px-4 py-2 font-mono text-gray-800">{idx + 1}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{e.date}</td>
                          <td className="px-4 py-2 text-sm font-semibold text-gray-900">{e.employeeName}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {e.clinicName}
                            {e.source === 'benefit' && e.claimNumber ? (
                              <span className="ml-2 text-[11px] font-mono text-gray-500">({e.claimNumber})</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-800">{e.totalAmount != null ? formatMoney(e.totalAmount) : '—'}</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">{formatMoney(e.claimedAmount)}</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">{formatMoney(e.balance)}</td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-gray-600 border-t border-gray-100">
            Annual quota: <span className="font-mono font-semibold">RM{MEDICAL_YEARLY_QUOTA.toFixed(0)}</span> · Max per receipt: <span className="font-mono font-semibold">RM{MEDICAL_ITEM_MAX.toFixed(0)}</span>
          </div>
        </div>
      )}

      {mode !== 'ledger' && (
      <div className="bg-white border border-[#e2d3a8] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead className="bg-[#f3ead6]">
              <tr className="text-xs font-bold text-gray-500 uppercase">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 w-40 text-right">Used</th>
                <th className="px-4 py-3 w-40 text-right">Remaining</th>
                <th className="px-4 py-3 w-40">Last used</th>
                <th className="px-4 py-3 w-28 text-right">Entries</th>
                <th className="px-4 py-3 w-28 no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const isOpen = openEmployee === r.employeeName;
                return (
                  <React.Fragment key={r.employeeName}>
                    <tr className="hover:bg-[#fbf7ef]">
                      <td className="px-4 py-3 font-semibold text-gray-900">{r.employeeName}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatMoney(r.used)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatMoney(r.remaining)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.lastUsedDate || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.entries.length}</td>
                      <td className="px-4 py-3 text-right no-print">
                        {r.entries.length ? (
                          <button
                            type="button"
                            onClick={() => setOpenEmployee(isOpen ? null : r.employeeName)}
                            className="text-sm font-semibold text-pink-700 hover:text-pink-800"
                          >
                            {isOpen ? 'Hide' : 'Details'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-[#fffaf0]">
                        <td colSpan={6} className="px-4 pb-4">
                          <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-[#f7f0df]">
                                <tr className="text-xs font-bold text-gray-500 uppercase">
                                  <th className="px-3 py-2 w-28">Date</th>
                                  <th className="px-3 py-2 w-44">Claim No.</th>
                                  <th className="px-3 py-2">Description</th>
                                  <th className="px-3 py-2 w-32 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {r.entries.map((e, idx) => (
                                  <tr key={`${e.claimId}:${idx}`} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-sm text-gray-700">{e.date || '—'}</td>
                                    <td className="px-3 py-2 text-sm font-mono font-semibold text-gray-800">{e.claimNumber}</td>
                                    <td className="px-3 py-2 text-sm text-gray-700">{e.description || 'Medical'}</td>
                                    <td className="px-3 py-2 text-right text-sm font-mono font-semibold text-gray-800">{formatMoney(e.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};

export default MedicalQuotaView;
