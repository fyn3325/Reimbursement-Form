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
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<{
    date: string;
    employeeName: string;
    clinicName: string;
    claimedAmount: string;
  }>({ date: '', employeeName: '', clinicName: '', claimedAmount: '' });

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
        .filter((e) => (e.employeeName || '').trim().toLowerCase() === employeeName.trim().toLowerCase())
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

  const updateLegacyEntry = async (
    id: string,
    patch: Partial<Pick<MedicalLegacyEntry, 'date' | 'employeeName' | 'clinicName' | 'totalAmount' | 'claimedAmount'>>
  ) => {
    const existing = legacy.find((e) => e.id === id);
    if (!existing) return;
    const next: MedicalLegacyEntry = { ...existing, ...patch };

    if (isFirebaseConfigured()) {
      try {
        await firebaseDb.saveMedicalLegacyEntry(next);
      } catch (err) {
        console.error('Update medical legacy failed', err);
        alert('Failed to update. Please check RTDB rules for "medicalLegacy".');
      }
      return;
    }

    const updated = legacy.map((e) => (e.id === id ? next : e));
    setLegacy(updated);
    localStorage.setItem(LEGACY_KEY, JSON.stringify(updated));
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
    // Use UTC to avoid timezone off-by-one when Excel dates are parsed at midnight.
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
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
        let skipped = 0;
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
          else if (typeof dateCell === 'number' && Number.isFinite(dateCell)) {
            const code = XLSX.SSF?.parse_date_code?.(dateCell);
            if (code && code.y && code.m && code.d) {
              dateIso = `${String(code.y)}-${String(code.m).padStart(2, '0')}-${String(code.d).padStart(2, '0')}`;
            }
          } else dateIso = parseDateToISO(String(dateCell ?? ''));
          if (!dateIso) {
            skipped++;
            continue;
          }

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
        if (skipped) alert(`Imported ${parsed.length} rows. Skipped ${skipped} rows (invalid date).`);
        return;
      }

      alert('Please upload an Excel (.xlsx/.xls) or CSV/TSV file.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Import failed: ${msg}`);
    }
  };

  const legacyForYear = useMemo(
    () => legacy.filter((e) => String(e?.date || '').startsWith(String(year))),
    [legacy, year]
  );

  const clearLegacy = async (scope: 'year' | 'all') => {
    const list = scope === 'year' ? legacyForYear : legacy;
    if (!list.length) {
      alert('No imported records to delete.');
      return;
    }
    const ok = confirm(
      scope === 'year'
        ? `Delete ALL imported medical records for ${year}? This cannot be undone.`
        : 'Delete ALL imported medical records (all years)? This cannot be undone.'
    );
    if (!ok) return;

    if (isFirebaseConfigured()) {
      try {
        for (const e of list) await firebaseDb.deleteMedicalLegacyEntry(e.id);
      } catch (err) {
        console.error('Delete medical legacy failed', err);
        alert('Failed to delete from Firebase. Please check RTDB rules for "medicalLegacy".');
        return;
      }
      alert('Deleted successfully.');
      return;
    }

    const remaining = scope === 'year' ? legacy.filter((e) => !String(e?.date || '').startsWith(String(year))) : [];
    setLegacy(remaining);
    localStorage.setItem(LEGACY_KEY, JSON.stringify(remaining));
    alert('Deleted successfully (local).');
  };

  const saveManual = async () => {
    const dateIso = parseDateToISO(manual.date);
    if (!dateIso) {
      alert('Please enter a valid date (YYYY-MM-DD or DD/MM/YYYY).');
      return;
    }
    const employeeName = manual.employeeName.trim();
    if (!employeeName) {
      alert('Please enter staff name.');
      return;
    }
    const clinicName = manual.clinicName.trim();
    const claimedAmount = Number(manual.claimedAmount);
    if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) {
      alert('Please enter claimed amount.');
      return;
    }
    if (claimedAmount > MEDICAL_ITEM_MAX) {
      alert(`Claimed amount cannot exceed RM${MEDICAL_ITEM_MAX.toFixed(0)} per receipt.`);
      return;
    }

    const entry: MedicalLegacyEntry = {
      id: crypto.randomUUID(),
      employeeName,
      date: dateIso,
      clinicName,
      claimedAmount,
      createdAt: Date.now(),
    };

    if (isFirebaseConfigured()) {
      try {
        await firebaseDb.saveMedicalLegacyEntry(entry);
      } catch (err) {
        console.error('Save medical legacy failed', err);
        alert('Failed to save to Firebase. Please check RTDB rules for "medicalLegacy".');
        return;
      }
      setManualOpen(false);
      setManual({ date: '', employeeName: '', clinicName: '', claimedAmount: '' });
      alert('Saved.');
      return;
    }

    const next = [entry, ...legacy];
    setLegacy(next);
    localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
    setManualOpen(false);
    setManual({ date: '', employeeName: '', clinicName: '', claimedAmount: '' });
    alert('Saved (local).');
  };

  const totals = useMemo(() => {
    let used = 0;
    for (const r of rows) used += r.used;
    return { used, remaining: Math.max(0, rows.length * MEDICAL_YEARLY_QUOTA - used) };
  }, [rows]);

  return (
    <div className="space-y-4">
      {manualOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setManualOpen(false)} aria-hidden="true" />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl border border-[#e2d3a8] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-gray-900">Add medical record</div>
              <button className="text-sm font-semibold text-gray-600 hover:text-gray-900" onClick={() => setManualOpen(false)}>
                Close
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                <input
                  type="date"
                  value={manual.date}
                  onChange={(e) => setManual((p) => ({ ...p, date: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Staff Name</label>
                <select
                  value={manual.employeeName}
                  onChange={(e) => setManual((p) => ({ ...p, employeeName: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white"
                >
                  <option value="" disabled>
                    Select employee
                  </option>
                  {employees.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col sm:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Clinic Name</label>
                <input
                  value={manual.clinicName}
                  onChange={(e) => setManual((p) => ({ ...p, clinicName: e.target.value }))}
                  placeholder="e.g. AKASIA CLINIC"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Claimed Amount</label>
                <input
                  value={manual.claimedAmount}
                  onChange={(e) => setManual((p) => ({ ...p, claimedAmount: e.target.value }))}
                  placeholder="Required"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white"
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
                  onClick={() => setManualOpen(false)}
                >
                  Cancel
                </button>
                <button className="px-3 py-2 rounded-lg bg-pink-600 text-white font-semibold text-sm hover:bg-pink-700" onClick={saveManual}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--brand-accent-soft)] border border-[#e2d3a8] rounded-xl shadow-sm p-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-gray-900">Medical Quota</div>
            <div className="text-xs text-gray-500 mt-1">
              Yearly quota per employee: RM{MEDICAL_YEARLY_QUOTA.toFixed(0)} · Max per medical entry: RM{MEDICAL_ITEM_MAX.toFixed(0)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="text-sm font-semibold text-pink-700 hover:text-pink-800 px-2 py-2"
              title="Add record"
            >
              Add Row
            </button>
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void clearLegacy('year')}
                className="text-xs font-semibold text-gray-700 hover:text-gray-900 px-2 py-2"
                title="Delete imported records for this year"
              >
                Clear {year}
              </button>
              <button
                type="button"
                onClick={() => void clearLegacy('all')}
                className="text-xs font-semibold text-gray-700 hover:text-gray-900 px-2 py-2"
                title="Delete all imported records"
              >
                Clear All
              </button>
            </div>
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
                      <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">{formatMoney(g.total)}</td>
                      <td className="px-4 py-2" />
                    </tr>
                    {g.list
                      .filter((e) => (!query.trim() ? true : e.employeeName.toLowerCase().includes(query.trim().toLowerCase())))
                      .map((e, idx) => (
                        <tr key={e.id} className="hover:bg-[#fbf7ef]">
                          <td className="px-4 py-2 font-mono text-gray-800">{idx + 1}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {e.source === 'legacy' ? (
                              <input
                                type="date"
                                className="text-sm bg-transparent focus:outline-none border-b border-gray-200 focus:border-pink-600"
                                defaultValue={e.date}
                                onBlur={(ev) => {
                                  const iso = parseDateToISO(ev.target.value);
                                  if (!iso) return;
                                  void updateLegacyEntry(e.id, { date: iso });
                                  ev.target.value = iso;
                                }}
                              />
                            ) : (
                              e.date
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                            {e.source === 'legacy' ? (
                              <select
                                className="bg-transparent focus:outline-none border-b border-gray-200 focus:border-pink-600 text-sm font-semibold"
                                defaultValue={e.employeeName}
                                onChange={(ev) => void updateLegacyEntry(e.id, { employeeName: ev.target.value })}
                              >
                                {employees.map((emp) => (
                                  <option key={emp.name} value={emp.name}>
                                    {emp.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              e.employeeName
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {e.source === 'legacy' ? (
                              <input
                                className="w-full text-sm bg-transparent focus:outline-none border-b border-gray-200 focus:border-pink-600"
                                defaultValue={e.clinicName}
                                onBlur={(ev) => void updateLegacyEntry(e.id, { clinicName: ev.target.value })}
                              />
                            ) : (
                              <>
                                {e.clinicName}
                                {e.source === 'benefit' && e.claimNumber ? (
                                  <span className="ml-2 text-[11px] font-mono text-gray-500">({e.claimNumber})</span>
                                ) : null}
                              </>
                            )}
                          </td>
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
