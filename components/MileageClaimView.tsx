import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Trash2, Plus, History, PanelLeft, Pencil, Printer, FileSpreadsheet } from 'lucide-react';
import type { EmployeeInfo, MileageClaim, MileageClaimRow } from '../types';
import { isFirebaseConfigured } from '../lib/firebase';
import * as firebaseDb from '../lib/firebase-db';
import { loadEmployees } from '../lib/employees';

const MILEAGE_HISTORY_KEY = 'auditlink_mileage_claims_history';

const CURRENCIES_LIST = ['MYR', 'USD', 'SGD', 'CNY', 'EUR', 'GBP', 'AUD', 'JPY', 'THB', 'IDR'];

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function yymmddPrefix(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) {
    const t = today();
    const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (!m2) return '000000';
    return `${m2[1].slice(-2)}${m2[2]}${m2[3]}/`;
  }
  return `${m[1].slice(-2)}${m[2]}${m[3]}/`;
}

function createEmptyEmployee(): EmployeeInfo {
  return {
    name: '',
    branch: '',
    bankAccount: '',
    bankName: '',
    chargeTo: 'GAIAS SDN BHD',
    claimDate: today(),
  };
}

function createEmptyRow(): MileageClaimRow {
  return {
    id: crypto.randomUUID(),
    date: today(),
    from: '',
    to: '',
    purpose: '',
    distanceKm: '',
    rate: 0.6,
  };
}

function numberOrZero(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(n) ? n : 0;
}

function calcRowAmount(row: MileageClaimRow): number {
  const distance = numberOrZero(row.distanceKm);
  const rate = numberOrZero(row.rate);
  return distance * rate;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatFirebaseError(err: unknown): string {
  const anyErr = err as any;
  const code = typeof anyErr?.code === 'string' ? anyErr.code : '';
  const message = typeof anyErr?.message === 'string' ? anyErr.message : String(err);

  if (code.toLowerCase().includes('permission') || message.toLowerCase().includes('permission')) {
    return 'Firebase permission denied. Please update Realtime Database Rules to allow read/write for `mileageClaims`.';
  }
  if (code.toLowerCase().includes('network') || message.toLowerCase().includes('network')) {
    return 'Network error while saving to Firebase. Please retry.';
  }
  if (message.toLowerCase().includes('unsupported type') || message.toLowerCase().includes('undefined')) {
    return 'Invalid data (undefined) detected while saving. Please retry; if it persists, tell me what you entered.';
  }
  return message;
}

export interface MileageClaimViewProps {
  onSendToBenefit?: (payload: {
    employee: EmployeeInfo;
    amount: number;
    currency: string;
    sourceMileageClaimNumber: string;
  }) => void;
  openClaimNumber?: string | null;
  onOpenClaimConsumed?: () => void;
}

const MileageClaimView: React.FC<MileageClaimViewProps> = ({
  onSendToBenefit,
  openClaimNumber,
  onOpenClaimConsumed,
}) => {
  const [history, setHistory] = useState<MileageClaim[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [claimNumber, setClaimNumber] = useState<string>('');
  const [employee, setEmployee] = useState<EmployeeInfo>(() => createEmptyEmployee());
  const [rows, setRows] = useState<MileageClaimRow[]>(() => [createEmptyRow()]);
  const [currency, setCurrency] = useState<string>('MYR');
  const [isSaving, setIsSaving] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const ADD_NEW_EMPLOYEE = '__ADD_NEW__';
  const [isManualEmployee, setIsManualEmployee] = useState(false);

  const allEmployees = loadEmployees();

  const totalAmount = useMemo(() => rows.reduce((s, r) => s + calcRowAmount(r), 0), [rows]);

  const generateClaimNumber = useCallback((claims: MileageClaim[], claimDate: string) => {
    const prefix = yymmddPrefix(claimDate);
    let maxSeq = 0;
    for (const c of claims) {
      const n = c?.claimNumber || '';
      if (!n.startsWith(prefix)) continue;
      const parts = n.split('/');
      if (parts.length !== 2) continue;
      const seq = parseInt(parts[1], 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }, []);

  const generateNewClaim = useCallback((overrideHistory?: MileageClaim[]) => {
    const hist = overrideHistory ?? history;
    setCurrentId(null);
    const emp = createEmptyEmployee();
    setEmployee(emp);
    setRows([createEmptyRow()]);
    setCurrency('MYR');
    setIsManualEmployee(false);
    setClaimNumber(generateClaimNumber(hist, emp.claimDate));
  }, [generateClaimNumber, history]);

  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsub = firebaseDb.subscribeToMileageClaims((claims) => {
        setHistory(claims);
        if (!claimNumber) setClaimNumber(generateClaimNumber(claims, employee.claimDate));
      });
      return () => unsub();
    }
    try {
      const saved = localStorage.getItem(MILEAGE_HISTORY_KEY);
      const loaded: MileageClaim[] = saved ? JSON.parse(saved) : [];
      setHistory(Array.isArray(loaded) ? loaded : []);
      if (!claimNumber) setClaimNumber(generateClaimNumber(Array.isArray(loaded) ? loaded : [], employee.claimDate));
    } catch {
      setHistory([]);
      if (!claimNumber) setClaimNumber(generateClaimNumber([], employee.claimDate));
    }
  }, [claimNumber, employee.claimDate, generateClaimNumber]);

  useEffect(() => {
    if (currentId) return;
    setClaimNumber(generateClaimNumber(history, employee.claimDate));
  }, [currentId, employee.claimDate, generateClaimNumber, history]);

  const handleEmployeeChange = (value: string) => {
    if (value === ADD_NEW_EMPLOYEE) {
      setIsManualEmployee(true);
      setEmployee((prev) => ({ ...prev, name: '' }));
      return;
    }
    setIsManualEmployee(false);
    const match = allEmployees.find((e) => e.name === value);
    setEmployee((prev) => ({
      ...prev,
      name: value,
      bankAccount: match?.account || prev.bankAccount,
      bankName: match?.bank || prev.bankName,
    }));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const updateRow = (id: string, field: keyof MileageClaimRow, value: any) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const saveClaim = async () => {
    const timestamp = Date.now();
    const savedId = currentId ?? crypto.randomUUID();
    setIsSaving(true);
    const claimToSave: MileageClaim = {
      id: savedId,
      claimNumber,
      employee,
      rows,
      currency,
      updatedAt: timestamp,
    };

    if (isFirebaseConfigured()) {
      try {
        // Strip undefined values (RTDB rejects them).
        const cleaned = JSON.parse(JSON.stringify(claimToSave)) as MileageClaim;
        await firebaseDb.saveMileageClaim(cleaned);
        setCurrentId(savedId);
        alert('Mileage Claim Saved/Amended Successfully');
      } catch (err) {
        console.error('Save mileage claim failed', err);
        // Fallback to local save so user doesn't lose work.
        try {
          const newHistory = currentId
            ? history.map((h) => (h.id === currentId ? claimToSave : h))
            : [claimToSave, ...history];
          setHistory(newHistory);
          localStorage.setItem(MILEAGE_HISTORY_KEY, JSON.stringify(newHistory));
        } catch {}
        alert(`Failed to save to Firebase. Saved locally in this browser.\n\n${formatFirebaseError(err)}`);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const newHistory = currentId
      ? history.map((h) => (h.id === currentId ? claimToSave : h))
      : [claimToSave, ...history];
    setHistory(newHistory);
    setCurrentId(savedId);
    localStorage.setItem(MILEAGE_HISTORY_KEY, JSON.stringify(newHistory));
    setIsSaving(false);
    alert('Mileage Claim Saved/Amended Successfully');
  };

  const loadClaim = (claim: MileageClaim) => {
    if (currentId && currentId !== claim.id) {
      if (!confirm('Switching claims will lose unsaved changes. Continue?')) return;
    }
    setShowHistoryDrawer(false);
    setCurrentId(claim.id);
    setClaimNumber(claim.claimNumber);
    setEmployee(claim.employee || createEmptyEmployee());
    setRows(claim.rows?.length ? claim.rows : [createEmptyRow()]);
    setCurrency(claim.currency || 'MYR');
  };

  useEffect(() => {
    if (!openClaimNumber) return;
    const target = history.find((h) => h.claimNumber === openClaimNumber);
    if (!target) return;
    loadClaim(target);
    onOpenClaimConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, openClaimNumber]);

  const deleteClaim = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this mileage claim?')) return;
    if (isFirebaseConfigured()) {
      try {
        await firebaseDb.deleteMileageClaim(id);
        if (currentId === id) generateNewClaim(history.filter((h) => h.id !== id));
      } catch (err) {
        console.error('Delete mileage claim failed', err);
        alert('Failed to delete. Please try again.');
      }
      return;
    }
    const newHistory = history.filter((h) => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem(MILEAGE_HISTORY_KEY, JSON.stringify(newHistory));
    if (currentId === id) generateNewClaim(newHistory);
  };

  const exportCSV = () => {
    const header = ['Date', 'From', 'To', 'Purpose', 'DistanceKm', 'Rate', 'Amount'];
    const lines = rows.map((r) => [
      r.date,
      `"${(r.from || '').replaceAll('"', '""')}"`,
      `"${(r.to || '').replaceAll('"', '""')}"`,
      `"${(r.purpose || '').replaceAll('"', '""')}"`,
      r.distanceKm ?? '',
      r.rate ?? '',
      calcRowAmount(r).toFixed(2),
    ].join(','));
    const meta = [
      `ClaimNumber,${claimNumber}`,
      `Employee,${employee.name}`,
      `ClaimDate,${employee.claimDate}`,
      `Currency,${currency}`,
      `Total,${totalAmount.toFixed(2)}`,
      '',
    ].join('\n');
    downloadTextFile(`${claimNumber}.csv`, [meta, header.join(','), ...lines].join('\n'));
  };

  const HistorySidebar = () => (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <History className="w-4 h-4 text-pink-600" />
          Mileage History
        </div>
        <button
          onClick={() => {
            generateNewClaim();
            setShowHistoryDrawer(false);
          }}
          className="text-xs px-2 py-1 rounded-md bg-pink-600 text-white hover:bg-pink-700"
        >
          New
        </button>
      </div>
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="text-xs text-gray-500">No mileage claims yet.</div>
        ) : (
          history.map((c) => {
            const claimRows = c.rows || [];
            const total = claimRows.reduce((s, r) => s + calcRowAmount(r), 0);
            return (
              <div
                key={c.id}
                onClick={() => loadClaim(c)}
                className={`relative cursor-pointer border rounded-lg p-3 hover:bg-gray-50 ${
                  currentId === c.id ? 'border-pink-400 bg-pink-50/40' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{c.claimNumber}</div>
                    <div className="text-[11px] text-gray-500 truncate">{c.employee?.name || '—'}</div>
                    <div className="text-[11px] text-gray-400">{c.employee?.claimDate || ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-gray-700">{total.toFixed(2)}</div>
                    <div className="text-[10px] text-gray-400">{claimRows.length} rows</div>
                  </div>
                </div>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadClaim(c);
                    }}
                    className="p-1 text-gray-400 hover:text-pink-500 bg-white rounded-md shadow-sm border border-gray-200"
                    title="Amend / Edit"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => deleteClaim(e, c.id)}
                    className="p-1 text-gray-400 hover:text-red-500 bg-white rounded-md shadow-sm border border-gray-200"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
      {showHistoryDrawer && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowHistoryDrawer(false)} aria-hidden="true" />
      )}
      {showHistoryDrawer && (
        <div className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] z-50 md:hidden shadow-xl bg-white">
          <HistorySidebar />
        </div>
      )}

      <div className="hidden md:block w-64 shrink-0 no-print self-start sticky top-24">
        <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-h-[calc(100vh-7rem)] flex flex-col">
          <HistorySidebar />
        </div>
      </div>

      <div className="flex-1 space-y-6 min-w-0">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <button
              onClick={() => setShowHistoryDrawer(true)}
              className="md:hidden flex items-center gap-2 px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 font-medium transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
              History
            </button>
            <div>
              <span className="text-xs text-gray-500 uppercase font-bold">Mileage Claim No.</span>
              <div className="text-xl font-mono font-bold text-gray-800">{claimNumber}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveClaim}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                if (!onSendToBenefit) return;
                if (totalAmount <= 0) {
                  alert('Total amount is 0. Please enter KM first.');
                  return;
                }
                onSendToBenefit({
                  employee,
                  amount: totalAmount,
                  currency,
                  sourceMileageClaimNumber: claimNumber,
                });
              }}
              disabled={!onSendToBenefit}
              className="flex items-center gap-2 px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send total to Staff Benefit form"
            >
              To Benefit
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        <div className="bg-white shadow-lg border border-gray-200 p-4 sm:p-6 lg:p-8 print:shadow-none print:border-none print:p-0">
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 uppercase tracking-tight">Mileage Claim</h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Charge To:</span>
                  <select
                    value={employee.chargeTo}
                    onChange={(e) => setEmployee({ ...employee, chargeTo: e.target.value })}
                    className="text-sm font-semibold bg-transparent border-b border-gray-300 focus:outline-none focus:border-pink-600"
                  >
                    <option value="GAIAS SDN BHD">GAIAS SDN BHD</option>
                    <option value="GAIAS PREMIER SDN BHD">GAIAS PREMIER SDN BHD</option>
                  </select>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-bold text-gray-400">{claimNumber}</div>
                <div className="text-xs text-gray-500 mt-1">{employee.claimDate}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase">Employee</label>
              <select
                value={isManualEmployee ? ADD_NEW_EMPLOYEE : employee.name}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="w-full border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent appearance-none"
              >
                <option value="" disabled>
                  Select Employee
                </option>
                {allEmployees.map((emp) => (
                  <option key={emp.name} value={emp.name}>
                    {emp.name}
                  </option>
                ))}
                <option value={ADD_NEW_EMPLOYEE}>+ Add New Employee</option>
              </select>
              {isManualEmployee && (
                <input
                  type="text"
                  value={employee.name}
                  onChange={(e) => setEmployee((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter employee name"
                  className="mt-2 w-full border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent"
                  autoFocus
                />
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase">Claim Date</label>
              <input
                type="date"
                value={employee.claimDate}
                onChange={(e) => setEmployee({ ...employee, claimDate: e.target.value })}
                className="border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase">Bank Name</label>
              <input
                value={employee.bankName}
                onChange={(e) => setEmployee({ ...employee, bankName: e.target.value })}
                className="border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-gray-50/50"
                placeholder="Auto-filled"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase">Bank Account</label>
              <input
                value={employee.bankAccount}
                onChange={(e) => setEmployee({ ...employee, bankAccount: e.target.value })}
                className="border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-gray-50/50"
                placeholder="Auto-filled"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase">Branch</label>
              <div className="relative">
                <select
                  value={employee.branch}
                  onChange={(e) => setEmployee({ ...employee, branch: e.target.value })}
                  className="w-full border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent appearance-none"
                >
                  <option value="" disabled>
                    Select Branch
                  </option>
                  <option value="HQ">HQ</option>
                  <option value="PBJ">PBJ</option>
                  <option value="MVJB">MVJB</option>
                  <option value="IOI">IOI</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-sm font-semibold text-gray-800">Mileage Details</div>
            <div className="flex items-center gap-2 no-print">
              <label className="text-xs font-bold text-gray-500 uppercase">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="text-sm bg-white border border-gray-300 rounded-md px-2 py-1"
              >
                {CURRENCIES_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button onClick={addRow} className="inline-flex items-center gap-2 px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium">
                <Plus className="w-4 h-4" />
                Add Row
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead className="bg-gray-50">
                <tr className="text-xs font-bold text-gray-500 uppercase">
                  <th className="px-3 py-2 w-28">Date</th>
                  <th className="px-3 py-2 w-40">From</th>
                  <th className="px-3 py-2 w-40">To</th>
                  <th className="px-3 py-2 w-[420px]">Purpose</th>
                  <th className="px-3 py-2 w-28 text-right">KM</th>
                  <th className="px-3 py-2 w-24 text-right">Rate</th>
                  <th className="px-3 py-2 w-28 text-right">Amount</th>
                  <th className="px-3 py-2 w-12 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input type="date" value={r.date} onChange={(e) => updateRow(r.id, 'date', e.target.value)} className="w-full text-sm bg-transparent focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={r.from} onChange={(e) => updateRow(r.id, 'from', e.target.value)} className="w-full text-sm bg-transparent focus:outline-none" placeholder="Start" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={r.to} onChange={(e) => updateRow(r.id, 'to', e.target.value)} className="w-full text-sm bg-transparent focus:outline-none" placeholder="Destination" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={r.purpose} onChange={(e) => updateRow(r.id, 'purpose', e.target.value)} className="w-full text-sm bg-transparent focus:outline-none" placeholder="Meeting / Delivery / Site visit" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={r.distanceKm}
                        onChange={(e) => updateRow(r.id, 'distanceKm', e.target.value)}
                        className="w-24 text-right text-sm font-mono font-medium bg-transparent focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={r.rate}
                        onChange={(e) => updateRow(r.id, 'rate', e.target.value)}
                        className="w-20 text-right text-sm font-mono font-medium bg-transparent focus:outline-none"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-sm font-mono font-bold text-gray-800">
                        {calcRowAmount(r).toFixed(2)} <span className="text-xs text-gray-400">{currency}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center no-print">
                      <button onClick={() => removeRow(r.id)} className="text-gray-300 hover:text-red-500" title="Remove row">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                    Total
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="text-base font-mono font-extrabold text-gray-900">
                      {totalAmount.toFixed(2)} <span className="text-xs text-gray-400">{currency}</span>
                    </div>
                  </td>
                  <td colSpan={1} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            Tip: Enter distance (KM) and rate to calculate the amount automatically.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MileageClaimView;
