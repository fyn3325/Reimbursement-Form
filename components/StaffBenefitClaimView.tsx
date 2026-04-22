import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Trash2, Plus, History, PanelLeft, Pencil, Printer, FileSpreadsheet } from 'lucide-react';
import type { BenefitClaimItem, EmployeeInfo, StaffBenefitClaim } from '../types';
import { isFirebaseConfigured } from '../lib/firebase';
import * as firebaseDb from '../lib/firebase-db';
import { loadEmployees } from '../lib/employees';
import { uploadBenefitReceiptFile } from '../lib/firebase-storage';

const BENEFIT_HISTORY_KEY = 'auditlink_benefit_claims_history';

const CURRENCIES_LIST = ['MYR', 'USD', 'SGD', 'CNY', 'EUR', 'GBP', 'AUD', 'JPY', 'THB', 'IDR'];
const DEFAULT_BENEFIT_TYPES = [
  'Traveling',
  'Incidentals',
  'Accommodation',
  'Subsistence',
  'Medical',
  'Entertainment',
  'Other',
];

const DESCRIPTION_TO_TYPE: Record<string, string> = {
  Petrol: 'Traveling',
  Mileage: 'Traveling',
  'Public Transport': 'Traveling',
  Parking: 'Incidentals',
  Toll: 'Incidentals',
  Hotel: 'Accommodation',
  Housing: 'Accommodation',
  Laundry: 'Accommodation',
  'Meals (Breakfast)': 'Subsistence',
  'Meals (Lunch)': 'Subsistence',
  'Meals (Dinner)': 'Subsistence',
  GP: 'Medical',
  Specialist: 'Medical',
  Dental: 'Medical',
  Meetings: 'Entertainment',
};

const DESCRIPTION_TO_DEFAULT_AMOUNT: Record<string, number> = {
  'Meals (Breakfast)': 10,
  'Meals (Lunch)': 15,
  'Meals (Dinner)': 15,
};

const DESCRIPTION_GROUPS: Array<{ type: string; items: string[] }> = [
  { type: 'Traveling', items: ['Petrol', 'Mileage', 'Public Transport'] },
  { type: 'Incidentals', items: ['Parking', 'Toll'] },
  { type: 'Accommodation', items: ['Hotel', 'Housing', 'Laundry'] },
  { type: 'Subsistence', items: ['Meals (Breakfast)', 'Meals (Lunch)', 'Meals (Dinner)'] },
  { type: 'Medical', items: ['GP', 'Specialist', 'Dental'] },
  { type: 'Entertainment', items: ['Meetings'] },
];

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function yymmFromDate(dateStr: string): { yy: string; mm: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) {
    const t = today();
    const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (!m2) return { yy: '00', mm: '00' };
    return { yy: m2[1].slice(-2), mm: m2[2] };
  }
  return { yy: m[1].slice(-2), mm: m[2] };
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

function createEmptyItem(): BenefitClaimItem {
  return {
    id: crypto.randomUUID(),
    date: today(),
    benefitType: 'Traveling',
    description: '',
    amount: '',
    currency: 'MYR',
    receiptRef: '',
    remarks: '',
  };
}

function numberOrZero(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(n) ? n : 0;
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

function extractMileageClaimNumber(text: string | undefined | null): string | null {
  const t = String(text || '');
  const m = /(\d{6}\/\d{3})/.exec(t);
  return m ? m[1] : null;
}

export interface StaffBenefitClaimViewProps {
  prefillFromMileage?: {
    employee: EmployeeInfo;
    amount: number;
    currency: string;
    sourceMileageClaimNumber: string;
  } | null;
  openClaimId?: string | null;
  onOpenClaimConsumed?: () => void;
  onSaved?: (claim: StaffBenefitClaim) => void;
  onOpenMileageClaimNumber?: (claimNumber: string) => void;
  onPrefillApplied?: () => void;
  tabToReimbursement?: () => void;
}

const StaffBenefitClaimView: React.FC<StaffBenefitClaimViewProps> = ({
  prefillFromMileage,
  openClaimId,
  onOpenClaimConsumed,
  onSaved,
  onOpenMileageClaimNumber,
  onPrefillApplied,
}) => {
  const [history, setHistory] = useState<StaffBenefitClaim[]>([]);
  const [reimbursementHistoryNumbers, setReimbursementHistoryNumbers] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [claimNumber, setClaimNumber] = useState<string>('');
  const [employee, setEmployee] = useState<EmployeeInfo>(() => createEmptyEmployee());
  const [items, setItems] = useState<BenefitClaimItem[]>(() => [createEmptyItem()]);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const ADD_NEW_EMPLOYEE = '__ADD_NEW__';
  const [isManualEmployee, setIsManualEmployee] = useState(false);
  const [benefitTypes, setBenefitTypes] = useState<string[]>(() => DEFAULT_BENEFIT_TYPES);

  const allEmployees = loadEmployees();

  const totalAmount = useMemo(() => items.reduce((s, i) => s + numberOrZero(i.amount), 0), [items]);

  const generateClaimNumber = useCallback((benefitClaims: StaffBenefitClaim[], reimbursementNumbers: string[], claimDate: string) => {
    const { yy, mm } = yymmFromDate(claimDate);
    const prefix = `R${yy}${mm}/`;
    let maxSeq = 0;
    const allNumbers = [
      ...reimbursementNumbers,
      ...benefitClaims.map((c) => c?.claimNumber || ''),
    ];
    for (const n of allNumbers) {
      if (!n.startsWith(prefix)) continue;
      const parts = n.split('/');
      if (parts.length !== 2) continue;
      const seq = parseInt(parts[1], 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }, []);

  const generateNewClaim = useCallback((overrideHistory?: StaffBenefitClaim[]) => {
    const hist = overrideHistory ?? history;
    setCurrentId(null);
    const emp = createEmptyEmployee();
    setEmployee(emp);
    setItems([createEmptyItem()]);
    setIsManualEmployee(false);
    setClaimNumber(generateClaimNumber(hist, reimbursementHistoryNumbers, emp.claimDate));
  }, [generateClaimNumber, history, reimbursementHistoryNumbers]);

  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsubBenefit = firebaseDb.subscribeToBenefitClaims((claims) => {
        setHistory(claims);
      });
      const unsubReimb = firebaseDb.subscribeToClaims((claims) => {
        const nums = (claims || []).map((c) => c?.claimNumber || '').filter(Boolean);
        setReimbursementHistoryNumbers(nums);
      });
      return () => {
        unsubBenefit();
        unsubReimb();
      };
    }
    try {
      const saved = localStorage.getItem(BENEFIT_HISTORY_KEY);
      const loaded: StaffBenefitClaim[] = saved ? JSON.parse(saved) : [];
      setHistory(Array.isArray(loaded) ? loaded : []);
      const reimbSaved = localStorage.getItem('auditlink_claims_history');
      const reimbLoaded = reimbSaved ? JSON.parse(reimbSaved) : [];
      const reimbNums = Array.isArray(reimbLoaded) ? reimbLoaded.map((c: any) => c?.claimNumber || '').filter(Boolean) : [];
      setReimbursementHistoryNumbers(reimbNums);
    } catch {
      setHistory([]);
      setReimbursementHistoryNumbers([]);
    }
  }, []);

  useEffect(() => {
    if (currentId) return;
    setClaimNumber(generateClaimNumber(history, reimbursementHistoryNumbers, employee.claimDate));
  }, [currentId, employee.claimDate, generateClaimNumber, history, reimbursementHistoryNumbers]);

  useEffect(() => {
    if (!prefillFromMileage) return;
    const apply = () => {
      setEmployee(prefillFromMileage.employee);
      setItems((prev) => {
        const next = [...prev];
        const first = next[0];
        const firstEmpty = first && !String(first.description || '').trim() && !String(first.amount || '').trim();
        const payload: BenefitClaimItem = {
          id: crypto.randomUUID(),
          date: prefillFromMileage.employee.claimDate || today(),
          benefitType: 'Traveling',
          description: 'Mileage',
          amount: Number(prefillFromMileage.amount).toFixed(2),
          currency: prefillFromMileage.currency,
          receiptRef: prefillFromMileage.sourceMileageClaimNumber,
          remarks: '',
          sourceMileageClaimNumber: prefillFromMileage.sourceMileageClaimNumber,
        };
        if (firstEmpty) {
          next[0] = { ...first, ...payload, id: first.id };
          return next;
        }
        return [...next, payload];
      });
      onPrefillApplied?.();
    };

    const dirty =
      (employee.name && employee.name !== prefillFromMileage.employee.name) ||
      items.some((i) => String(i.description || '').trim() || String(i.amount || '').trim());
    if (dirty) {
      if (!confirm('Apply mileage total to this Staff Benefit claim? This will set employee info and add an item.')) return;
    }
    apply();
  }, [employee.name, items, onPrefillApplied, prefillFromMileage]);

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

  const addItem = () => setItems((prev) => [...prev, createEmptyItem()]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const updateItem = (id: string, field: keyof BenefitClaimItem, value: any) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const updateRemarks = (id: string, remarks: string) => {
    const mileageClaimNumber = extractMileageClaimNumber(remarks);
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return {
          ...i,
          remarks,
          sourceMileageClaimNumber: mileageClaimNumber || i.sourceMileageClaimNumber,
        };
      })
    );
  };

  const setDescriptionAndAutoType = (id: string, description: string) => {
    const inferred = DESCRIPTION_TO_TYPE[description];
    const defaultAmount = DESCRIPTION_TO_DEFAULT_AMOUNT[description];
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const next: BenefitClaimItem = { ...i, description, benefitType: inferred || i.benefitType };
        if (defaultAmount != null) {
          next.amount = defaultAmount;
          next.currency = 'MYR';
        }
        return next;
      })
    );
  };

  const saveClaim = async () => {
    const timestamp = Date.now();
    const savedId = currentId ?? crypto.randomUUID();
    setIsSaving(true);

    let itemsToSave = [...items];
    if (isFirebaseConfigured()) {
      try {
        for (let i = 0; i < itemsToSave.length; i++) {
          const item = itemsToSave[i];
          const dataUrl = item.receiptFileUrl;
          if (dataUrl && dataUrl.startsWith('data:')) {
            const url = await uploadBenefitReceiptFile(savedId, item.id, dataUrl);
            itemsToSave[i] = { ...item, receiptFileUrl: url };
          }
        }
      } catch (err) {
        console.error('Upload benefit receipt failed', err);
        alert('Failed to upload receipt files. Please try again.');
        setIsSaving(false);
        return;
      }
    }

    const claimToSave: StaffBenefitClaim = {
      id: savedId,
      claimNumber,
      employee,
      items: itemsToSave,
      updatedAt: timestamp,
    };

    if (isFirebaseConfigured()) {
      try {
        await firebaseDb.saveBenefitClaim(claimToSave);
        setCurrentId(savedId);
        onSaved?.(claimToSave);
        alert('Staff Benefit Claim Saved/Amended Successfully');
      } catch (err) {
        console.error('Save benefit claim failed', err);
        alert('Failed to save. Please try again.');
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
    localStorage.setItem(BENEFIT_HISTORY_KEY, JSON.stringify(newHistory));
    setIsSaving(false);
    onSaved?.(claimToSave);
    alert('Staff Benefit Claim Saved/Amended Successfully');
  };

  const loadClaim = (claim: StaffBenefitClaim) => {
    if (currentId && currentId !== claim.id) {
      if (!confirm('Switching claims will lose unsaved changes. Continue?')) return;
    }
    setShowHistoryDrawer(false);
    setCurrentId(claim.id);
    setClaimNumber(claim.claimNumber);
    setEmployee(claim.employee || createEmptyEmployee());
    setItems(claim.items?.length ? claim.items : [createEmptyItem()]);
  };

  useEffect(() => {
    if (!openClaimId) return;
    const target = history.find((h) => h.id === openClaimId);
    if (!target) return;
    loadClaim(target);
    onOpenClaimConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, openClaimId]);

  const deleteClaim = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this staff benefit claim?')) return;
    if (isFirebaseConfigured()) {
      try {
        await firebaseDb.deleteBenefitClaim(id);
        if (currentId === id) generateNewClaim(history.filter((h) => h.id !== id));
      } catch (err) {
        console.error('Delete benefit claim failed', err);
        alert('Failed to delete. Please try again.');
      }
      return;
    }
    const newHistory = history.filter((h) => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem(BENEFIT_HISTORY_KEY, JSON.stringify(newHistory));
    if (currentId === id) generateNewClaim(newHistory);
  };

  const exportCSV = () => {
    const header = ['Date', 'TypeOfClaim', 'Description', 'Amount', 'Currency', 'Receipt', 'Remarks'];
    const lines = items.map((i) => [
      i.date,
      `"${(i.benefitType || '').replaceAll('"', '""')}"`,
      `"${(i.description || '').replaceAll('"', '""')}"`,
      numberOrZero(i.amount).toFixed(2),
      i.currency || 'MYR',
      `"${(i.receiptFileUrl || i.receiptRef || '').replaceAll('"', '""')}"`,
      `"${(i.remarks || '').replaceAll('"', '""')}"`,
    ].join(','));
    const meta = [
      `ClaimNumber,${claimNumber}`,
      `Employee,${employee.name}`,
      `ClaimDate,${employee.claimDate}`,
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
          Benefit History
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
          <div className="text-xs text-gray-500">No staff benefit claims yet.</div>
        ) : (
          history.map((c) => {
            const claimItems = c.items || [];
            const total = claimItems.reduce((s, i) => s + numberOrZero(i.amount), 0);
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
                    <div className="text-[10px] text-gray-400">{claimItems.length} items</div>
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
              <span className="text-xs text-gray-500 uppercase font-bold">Staff Benefit Claim No.</span>
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
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 uppercase tracking-tight">Staff Benefit Claim</h1>
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
            <div className="text-sm font-semibold text-gray-800">Benefit Items</div>
            <div className="flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={() => {
                  const v = prompt('New benefit type name:');
                  if (!v) return;
                  const val = v.trim();
                  if (!val) return;
                  setBenefitTypes((prev) => (prev.includes(val) ? prev : [...prev, val]));
                }}
                className="text-sm px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                + Benefit Type
              </button>
              <button onClick={addItem} className="inline-flex items-center gap-2 px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium">
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead className="bg-gray-50">
                <tr className="text-xs font-bold text-gray-500 uppercase">
                  <th className="px-3 py-2 w-28">Date</th>
                  <th className="px-3 py-2 w-44">Type of Claim</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 w-28 text-right">Amount</th>
                  <th className="px-3 py-2 w-24">Currency</th>
                  <th className="px-3 py-2 w-40">Receipt</th>
                  <th className="px-3 py-2 w-64">Remarks</th>
                  <th className="px-3 py-2 w-12 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input type="date" value={i.date} onChange={(e) => updateItem(i.id, 'date', e.target.value)} className="w-full text-sm bg-transparent focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={i.benefitType}
                        onChange={(e) => updateItem(i.id, 'benefitType', e.target.value)}
                        className="w-full text-sm bg-transparent focus:outline-none border-b border-gray-200 focus:border-pink-600"
                      >
                        {benefitTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={Object.prototype.hasOwnProperty.call(DESCRIPTION_TO_TYPE, i.description) ? i.description : ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            setDescriptionAndAutoType(i.id, v);
                          }}
                          className="min-w-52 text-sm bg-transparent focus:outline-none border-b border-gray-200 focus:border-pink-600"
                        >
                          <option value="">Select…</option>
                          {DESCRIPTION_GROUPS.map((g) => (
                            <optgroup key={g.type} label={g.type}>
                              {g.items.map((it) => (
                                <option key={it} value={it}>
                                  {it}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <input
                          value={i.description}
                          onChange={(e) => updateItem(i.id, 'description', e.target.value)}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            const inferred = DESCRIPTION_TO_TYPE[v];
                            if (inferred) updateItem(i.id, 'benefitType', inferred);
                          }}
                          className="flex-1 text-sm bg-transparent focus:outline-none"
                          placeholder="Custom description (optional)"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={i.amount}
                        onChange={(e) => updateItem(i.id, 'amount', e.target.value)}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v == null || v === '') return;
                          const n = Number(v);
                          if (!Number.isFinite(n)) return;
                          updateItem(i.id, 'amount', n.toFixed(2));
                        }}
                        className="w-24 text-right text-sm font-mono font-medium bg-transparent focus:outline-none"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={i.currency || 'MYR'}
                        onChange={(e) => updateItem(i.id, 'currency', e.target.value)}
                        className="w-full text-sm bg-transparent focus:outline-none border-b border-gray-200 focus:border-pink-600"
                      >
                        {CURRENCIES_LIST.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="hidden print:block text-xs text-gray-700">
                        {i.receiptFileName || i.receiptRef || ''}
                      </div>
                      <div className="flex items-center gap-2 no-print">
                        {(() => {
                          const url =
                            i.receiptFileUrl ||
                            (typeof i.receiptRef === 'string' && i.receiptRef.startsWith('http') ? i.receiptRef : '');
                          if (!url) return <span className="text-xs text-gray-400">—</span>;
                          const isImage = url.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-14 h-14 rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-pink-500"
                              title={i.receiptFileName || 'View receipt'}
                            >
                              {isImage ? (
                                <img src={url} alt="Receipt" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                                  PDF
                                </div>
                              )}
                            </a>
                          );
                        })()}
                        <label className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 rounded-md inline-flex items-center gap-1 cursor-pointer">
                          Upload
                          <input
                            type="file"
                            accept="image/*,.pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                const dataUrl = String(reader.result || '');
                                if (!dataUrl.startsWith('data:')) return;
                                updateItem(i.id, 'receiptFileUrl', dataUrl);
                                updateItem(i.id, 'receiptFileName', file.name);
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {/* Print-friendly remarks */}
                      <div className="hidden print:block text-xs text-gray-700">
                        {String(i.sourceMileageClaimNumber || '').trim()
                          ? `Mileage ${i.sourceMileageClaimNumber}`
                          : (i.remarks || '')}
                      </div>

                      <div className="flex items-center gap-2 no-print">
                        {(() => {
                          const n =
                            String(i.sourceMileageClaimNumber || '').trim() ||
                            extractMileageClaimNumber(i.remarks) ||
                            extractMileageClaimNumber(i.receiptRef);
                          if (!n) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenMileageClaimNumber?.(String(n))}
                              className="text-xs text-pink-700 hover:text-pink-800 underline whitespace-nowrap shrink-0"
                              title="Open mileage claim"
                            >
                              Mileage {n}
                            </button>
                          );
                        })()}
                        <input
                          value={i.remarks || ''}
                          onChange={(e) => updateRemarks(i.id, e.target.value)}
                          className="flex-1 w-full text-sm bg-transparent focus:outline-none"
                          placeholder="—"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center no-print">
                      <button onClick={() => removeItem(i.id)} className="text-gray-300 hover:text-red-500" title="Remove item">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-right text-sm font-semibold text-gray-700">
                    Total
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="text-base font-mono font-extrabold text-gray-900">{totalAmount.toFixed(2)}</div>
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffBenefitClaimView;
