import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { ClaimItem, EmployeeInfo, ReimbursementClaim, StaffBenefitClaim } from '../types';
import { isFirebaseConfigured } from '../lib/firebase';
import * as firebaseDb from '../lib/firebase-db';
import { uploadReceiptImage } from '../lib/firebase-storage';

const CUSTOM_CATEGORIES_KEY = 'auditlink_custom_categories';
const CUSTOM_EMPLOYEES_KEY = 'auditlink_custom_employees';
const DEFAULT_CATEGORIES_KEY = 'auditlink_default_categories';
const DEFAULT_EMPLOYEES_KEY = 'auditlink_default_employees';
const CLAIMS_HISTORY_KEY = 'auditlink_claims_history';

const BUILTIN_PRESET_CATEGORIES = [
  'Staff Welfare',
  'Repair Maintenance - Office Equipment',
  'Retail Supplies',
  'Pantry',
  'Cleaning',
  'Purchase - Packaging',
  'Postage',
  'Other'
];
import { Upload, Plus, Trash2, Loader2, Save, History, PlusCircle, Pencil, FileSpreadsheet, X, PanelLeft, GripVertical, Printer, Settings2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

async function processReceiptViaApi(base64Image: string, mimeType: string): Promise<ClaimItem[]> {
  const res = await fetch('/api/process-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, mimeType }),
  });
  if (!res.ok) {
    if (res.status === 413) {
      throw new Error(FILE_TOO_LARGE_MESSAGE);
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.details || data.error || `Request failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}
import { EMPLOYEES_LIST } from '../constants';
import { compressImage, FILE_TOO_LARGE_MESSAGE } from '../utils/imageCompress';

const ADD_CUSTOM_VALUE = '__add_custom__';
const CURRENCIES_LIST = ['MYR', 'CNY', 'USD', 'SGD', 'EUR', 'GBP', 'AUD', 'JPY', 'THB', 'IDR'];
const PRESET_CATEGORIES_LIST = [
  'Staff Welfare',
  'Repair Maintenance - Office Equipment',
  'Retail Supplies',
  'Pantry',
  'Cleaning',
  'Purchase - Packaging',
  'Postage',
  'Other'
];

interface SortableRowProps {
  item: ClaimItem;
  onUpdate: (id: string, field: keyof ClaimItem, value: any) => void;
  onRemove: (id: string) => void;
  categories: string[];
  onAddCustomCategory: (value: string) => void;
  isEditingCustom: boolean;
  onStartEditCustom: (id: string) => void;
  onFinishEditCustom: () => void;
  currencies: string[];
}

const SortableRow = memo<SortableRowProps>(function SortableRow(
  { item, onUpdate, onRemove, categories, onAddCustomCategory, isEditingCustom, onStartEditCustom, onFinishEditCustom, currencies: CURRENCIES }
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group hover:bg-gray-50 ${isDragging ? 'bg-pink-50 opacity-90 shadow-md z-10' : ''}`}
    >
      <td className="py-3 align-top no-print w-10 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-gray-400" />
      </td>
      <td className="py-3 align-top">
        <input
          type="date"
          value={item.date}
          onChange={e => onUpdate(item.id, 'date', e.target.value)}
          className="w-full text-sm bg-transparent focus:outline-none"
        />
      </td>
      <td className="py-3 align-top">
        {isEditingCustom ? (
          <input
            autoFocus
            value={item.category}
            onChange={e => onUpdate(item.id, 'category', e.target.value)}
            onBlur={() => {
              const v = item.category.trim();
              if (v) onAddCustomCategory(v);
              onFinishEditCustom();
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = item.category.trim();
                if (v) onAddCustomCategory(v);
                onFinishEditCustom();
              }
            }}
            className="w-full text-xs font-medium bg-transparent focus:outline-none border-b border-pink-400"
            placeholder="Type custom category"
          />
        ) : (
          <select
            value={categories.includes(item.category) ? item.category : ''}
            onChange={e => {
              const v = e.target.value;
              if (v === ADD_CUSTOM_VALUE) {
                onUpdate(item.id, 'category', '');
                onStartEditCustom(item.id);
              } else {
                onUpdate(item.id, 'category', v);
              }
            }}
            className="w-full text-xs font-medium bg-transparent focus:outline-none"
          >
            <option value="" disabled>Select</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value={ADD_CUSTOM_VALUE}>+ Add custom</option>
          </select>
        )}
      </td>
      <td className="py-3 align-top">
        <input
          value={item.merchant}
          onChange={e => onUpdate(item.id, 'merchant', e.target.value)}
          className="w-full text-sm font-bold bg-transparent focus:outline-none block mb-1"
          placeholder="Merchant"
        />
        <input
          value={item.description}
          onChange={e => onUpdate(item.id, 'description', e.target.value)}
          className="w-full text-xs text-gray-500 bg-transparent focus:outline-none"
          placeholder="Description"
        />
      </td>
      <td className="py-3 align-top no-print">
        {item.receiptImage ? (
          <a
            href={item.receiptImage}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-14 h-14 rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-pink-500"
            title={item.receiptPage ? `View receipt (Page ${item.receiptPage})` : 'View receipt'}
          >
            {item.receiptImage.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(item.receiptImage) ? (
              <img src={item.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center text-xs text-gray-500">
                <span>PDF</span>
                {item.receiptPage != null && <span className="text-[10px] opacity-80">(P.{item.receiptPage})</span>}
              </div>
            )}
          </a>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="py-3 align-top text-right">
        <div className="flex items-center justify-end gap-1">
          <select
            value={item.currency || 'MYR'}
            onChange={e => onUpdate(item.id, 'currency', e.target.value)}
            className="text-xs text-gray-600 bg-transparent focus:outline-none border-b border-gray-200 focus:border-pink-600 pr-1"
          >
            {CURRENCIES.map(cur => (
              <option key={cur} value={cur}>{cur}</option>
            ))}
          </select>
          <input
            type="number"
            value={item.amount}
            onChange={e => onUpdate(item.id, 'amount', e.target.value)}
            className="w-20 text-right text-sm font-mono font-medium bg-transparent focus:outline-none"
          />
        </div>
      </td>
      <td className="py-3 text-center no-print">
        <button onClick={() => onRemove(item.id)} className="text-gray-300 hover:text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});

export interface ReimbursementViewProps {
  benefitHistory?: StaffBenefitClaim[];
  onOpenBenefitClaim?: (id: string) => void;
}

const ReimbursementView: React.FC<ReimbursementViewProps> = ({ benefitHistory = [], onOpenBenefitClaim }) => {
  // --- State ---
  const [history, setHistory] = useState<ReimbursementClaim[]>([]);
  
  // Current Form State
  const [currentId, setCurrentId] = useState<string | null>(null); // If null, it's a new unsaved claim
  const [claimNumber, setClaimNumber] = useState<string>('');
  
  const [employee, setEmployee] = useState<EmployeeInfo>({
    name: '',
    branch: '',
    bankAccount: '',
    bankName: '',
    chargeTo: 'GAIAS SDN BHD',
    claimDate: new Date().toISOString().split('T')[0]
  });
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const ADD_NEW_EMPLOYEE = '__ADD_NEW__';
  const [isManualEmployee, setIsManualEmployee] = useState(false);
  const [presetCategories, setPresetCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(DEFAULT_CATEGORIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : BUILTIN_PRESET_CATEGORIES;
      }
      return BUILTIN_PRESET_CATEGORIES;
    } catch {
      return BUILTIN_PRESET_CATEGORIES;
    }
  });
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  type CustomEmployee = { name: string; account: string; bank: string };
  const [defaultEmployees, setDefaultEmployees] = useState<CustomEmployee[]>(() => {
    try {
      const saved = localStorage.getItem(DEFAULT_EMPLOYEES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : EMPLOYEES_LIST.map(e => ({ name: e.name, account: e.account, bank: e.bank }));
      }
      return EMPLOYEES_LIST.map(e => ({ name: e.name, account: e.account, bank: e.bank }));
    } catch {
      return EMPLOYEES_LIST.map(e => ({ name: e.name, account: e.account, bank: e.bank }));
    }
  });
  const [customEmployees, setCustomEmployees] = useState<CustomEmployee[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_EMPLOYEES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingCustomCategoryId, setEditingCustomCategoryId] = useState<string | null>(null);
  const [editingPresetCategoryIdx, setEditingPresetCategoryIdx] = useState<number | null>(null);
  const [editingDefaultEmployeeIdx, setEditingDefaultEmployeeIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initialLoadDone = useRef(false);

  // --- Effects ---

  // Load history: Firebase Realtime DB (when configured) or LocalStorage
  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsub = firebaseDb.subscribeToClaims((claims) => {
        setHistory(claims);
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          generateNewClaim(claims);
        }
      });
      return () => unsub();
    } else {
      const saved = localStorage.getItem(CLAIMS_HISTORY_KEY);
      let loadedHistory: ReimbursementClaim[] = saved ? JSON.parse(saved) : [];
      setHistory(loadedHistory);
      generateNewClaim(loadedHistory);
    }
  }, []);

  // --- Logic ---

  const generateClaimNumber = (currentHistory: ReimbursementClaim[]) => {
    const now = new Date();
    // YYMM format (e.g., 2602 for Feb 2026)
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `R${yy}${mm}/`;
    
    // Find max sequence in history for this month
    let maxSeq = 0;
    currentHistory.forEach(h => {
        if (h.claimNumber && h.claimNumber.startsWith(prefix)) {
            const parts = h.claimNumber.split('/');
            if (parts.length === 2) {
                const seq = parseInt(parts[1], 10);
                if (!isNaN(seq) && seq > maxSeq) {
                    maxSeq = seq;
                }
            }
        }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
    return `${prefix}${nextSeq}`;
  };

  const generateNewClaim = (overrideHistory?: ReimbursementClaim[]) => {
    const hist = overrideHistory || history;
    setCurrentId(null);
    setClaimNumber(generateClaimNumber(hist));
    setEmployee({
      name: '',
      branch: '',
      bankAccount: '',
      bankName: '',
      chargeTo: 'GAIAS SDN BHD',
      claimDate: new Date().toISOString().split('T')[0]
    });
    setIsManualEmployee(false);
    setItems([]);
  };

  const saveClaim = async () => {
    const timestamp = Date.now();
    const savedId = currentId ?? crypto.randomUUID();

    let itemsToSave = [...items];
    if (isFirebaseConfigured()) {
      setIsSaving(true);
      try {
        for (let i = 0; i < itemsToSave.length; i++) {
          const item = itemsToSave[i];
          const img = item.receiptImage;
          if (img && img.startsWith('data:')) {
            const mimeMatch = img.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const url = await uploadReceiptImage(savedId, item.id, img, mimeType);
            itemsToSave[i] = { ...item, receiptImage: url };
          }
        }
      } catch (err) {
        console.error('Upload receipt failed', err);
        alert('Failed to upload receipts. Please try again.');
        setIsSaving(false);
        return;
      }
    }

    const claimToSave: ReimbursementClaim = {
      id: savedId,
      claimNumber,
      employee,
      items: itemsToSave,
      updatedAt: timestamp
    };

    if (isFirebaseConfigured()) {
      try {
        await firebaseDb.saveClaim(claimToSave);
        setCurrentId(savedId);
        alert('Claim Saved/Amended Successfully');
      } catch (err) {
        console.error('Save failed', err);
        alert('Failed to save. Please try again.');
      } finally {
        setIsSaving(false);
      }
    } else {
      let newHistory = currentId
        ? history.map(h => (h.id === currentId ? claimToSave : h))
        : [claimToSave, ...history];
      setHistory(newHistory);
      setCurrentId(savedId);
      localStorage.setItem(CLAIMS_HISTORY_KEY, JSON.stringify(newHistory));
      alert('Claim Saved/Amended Successfully');
    }
  };

  const loadClaim = (claim: ReimbursementClaim) => {
    if (currentId && currentId !== claim.id) {
       if (!confirm('Switching claims will lose unsaved changes. Continue?')) return;
    }
    setShowHistoryDrawer(false);
    setCurrentId(claim.id);
    setClaimNumber(claim.claimNumber);
    const emp: Partial<EmployeeInfo> = claim.employee || {};
    setEmployee({
      name: emp.name || '',
      branch: emp.branch || (emp as any).department || '',
      bankAccount: emp.bankAccount || '',
      bankName: emp.bankName || '',
      chargeTo: emp.chargeTo || 'GAIAS SDN BHD',
      claimDate: emp.claimDate || new Date().toISOString().split('T')[0],
    });
    setIsManualEmployee(
      !defaultEmployees.some(e => e.name === (emp.name || '')) &&
      !customEmployees.some(e => e.name === (emp.name || ''))
    );
    setItems(claim.items || []);
  };

  const deleteClaim = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this claim?')) return;
    if (isFirebaseConfigured()) {
      try {
        await firebaseDb.deleteClaim(id);
        if (currentId === id) generateNewClaim(history.filter(h => h.id !== id));
      } catch (err) {
        console.error('Delete failed', err);
        alert('Failed to delete. Please try again.');
      }
    } else {
      const newHistory = history.filter(h => h.id !== id);
      setHistory(newHistory);
      localStorage.setItem(CLAIMS_HISTORY_KEY, JSON.stringify(newHistory));
      if (currentId === id) generateNewClaim(newHistory);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newItems: ClaimItem[] = [];
    const failed: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type && file.name.toLowerCase().endsWith('.pdf')) {
        (file as File & { type?: string }).type = 'application/pdf';
      }
      try {
        const { base64, mimeType: compressedMime } = await compressImage(file);
        const items = await processReceiptViaApi(base64, compressedMime);
        newItems.push(...items);
      } catch (err) {
        console.error(`Error processing file ${file.name}`, err);
        const msg = err instanceof Error ? err.message : String(err);
        failed.push(`${file.name}: ${msg}`);
      }
    }

    setItems(prev => [...prev, ...newItems]);
    setIsProcessing(false);
    e.target.value = '';
    if (failed.length > 0) {
      alert(`Failed to process:\n${failed.join('\n')}`);
    }
  };

  const updateItem = useCallback((id: string, field: keyof ClaimItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }, []);

  const addCustomCategory = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const PRESET = ['Staff Welfare', 'Repair Maintenance - Office Equipment', 'Retail Supplies', 'Pantry', 'Cleaning', 'Purchase - Packaging', 'Postage', 'Other'];
    if (PRESET.includes(trimmed)) return;
    setCustomCategories(prev => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed].sort();
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeCustomCategory = useCallback((cat: string) => {
    setCustomCategories(prev => {
      const next = prev.filter(c => c !== cat);
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addCustomEmployee = useCallback((name: string, account?: string, bank?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = defaultEmployees.some(e => e.name === trimmed);
    if (exists) return;
    setCustomEmployees(prev => {
      if (prev.some(e => e.name === trimmed)) return prev;
      const entry = { name: trimmed, account: account || '', bank: bank || '' };
      const next = [...prev, entry].sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(next));
      return next;
    });
  }, [defaultEmployees]);

  const removeCustomEmployee = useCallback((name: string) => {
    setCustomEmployees(prev => {
      const next = prev.filter(e => e.name !== name);
      localStorage.setItem(CUSTOM_EMPLOYEES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const addEmptyRow = useCallback(() => {
    const newItem: ClaimItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      date: new Date().toISOString().split('T')[0],
      merchant: '',
      description: '',
      amount: 0,
      currency: 'MYR',
      category: 'Other',
    };
    setItems(prev => [...prev, newItem]);
  }, []);

  const moveItem = (oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    setItems(prev => arrayMove(prev, oldIndex, newIndex));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    if (oldIndex >= 0 && newIndex >= 0) moveItem(oldIndex, newIndex);
  };

  const allEmployees = React.useMemo(() => {
    const baseNames = new Set(defaultEmployees.map(e => e.name));
    const extras = customEmployees.filter(e => !baseNames.has(e.name));
    return [...defaultEmployees, ...extras];
  }, [defaultEmployees, customEmployees]);

  const handleNameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    if (selectedName === ADD_NEW_EMPLOYEE) {
      setIsManualEmployee(true);
      setEmployee(prev => ({ ...prev, name: '', bankAccount: '', bankName: '' }));
      return;
    }
    setIsManualEmployee(false);
    const found = allEmployees.find(emp => (emp as { name: string; account?: string; bank?: string }).name === selectedName);
    const emp = found as { name: string; account?: string; bank?: string } | undefined;
    if (emp) {
      setEmployee(prev => ({
        ...prev,
        name: emp.name,
        bankAccount: emp.account ?? '',
        bankName: emp.bank ?? ''
      }));
    } else {
      setEmployee(prev => ({ ...prev, name: selectedName }));
    }
  };

  const handleManualEmployeeBlur = () => {
    if (employee.name.trim()) {
      addCustomEmployee(employee.name, employee.bankAccount, employee.bankName);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Merchant', 'Description', 'Amount', 'Currency'];
    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        item.date,
        `"${item.category}"`,
        `"${item.merchant.replace(/"/g, '""')}"`,
        `"${item.description.replace(/"/g, '""')}"`,
        item.amount,
        item.currency
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${claimNumber || 'claim'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const startEditCustom = useCallback((id: string) => setEditingCustomCategoryId(id), []);
  const finishEditCustom = useCallback(() => setEditingCustomCategoryId(null), []);

  const categoriesFromItems = useMemo(
    () =>
      items
        .map(i => i.category)
        .filter((c): c is string => !!c && !presetCategories.includes(c) && !customCategories.includes(c)),
    [items, presetCategories, customCategories]
  );
  const allCategories = useMemo(
    () => [...new Set([...presetCategories, ...customCategories, ...categoriesFromItems])],
    [presetCategories, customCategories, categoriesFromItems]
  );

  const savePresetCategories = useCallback((next: string[]) => {
    setPresetCategories(next);
    localStorage.setItem(DEFAULT_CATEGORIES_KEY, JSON.stringify(next));
  }, []);
  const addPresetCategory = useCallback((name: string) => {
    const v = name.trim();
    if (!v || presetCategories.includes(v)) return;
    const next = [...presetCategories, v];
    savePresetCategories(next);
  }, [presetCategories, savePresetCategories]);
  const removePresetCategory = useCallback((cat: string) => {
    const next = presetCategories.filter(c => c !== cat);
    savePresetCategories(next);
  }, [presetCategories, savePresetCategories]);
  const updatePresetCategory = useCallback((idx: number, newName: string) => {
    const v = newName.trim();
    if (!v) return;
    const next = [...presetCategories];
    next[idx] = v;
    savePresetCategories(next);
    setEditingPresetCategoryIdx(null);
  }, [presetCategories, savePresetCategories]);
  const resetPresetCategories = useCallback(() => {
    if (confirm('Reset default categories to built-in list?')) {
      savePresetCategories(BUILTIN_PRESET_CATEGORIES);
      setEditingPresetCategoryIdx(null);
    }
  }, [savePresetCategories]);

  const saveDefaultEmployees = useCallback((next: CustomEmployee[]) => {
    setDefaultEmployees(next);
    localStorage.setItem(DEFAULT_EMPLOYEES_KEY, JSON.stringify(next));
  }, []);
  const addDefaultEmployee = useCallback((emp: CustomEmployee) => {
    const name = emp.name.trim();
    if (!name || defaultEmployees.some(e => e.name === name)) return;
    const next = [...defaultEmployees, { name, account: emp.account || '', bank: emp.bank || '' }].sort((a, b) => a.name.localeCompare(b.name));
    saveDefaultEmployees(next);
  }, [defaultEmployees, saveDefaultEmployees]);
  const removeDefaultEmployee = useCallback((name: string) => {
    const next = defaultEmployees.filter(e => e.name !== name);
    saveDefaultEmployees(next);
    setEditingDefaultEmployeeIdx(null);
  }, [defaultEmployees, saveDefaultEmployees]);
  const updateDefaultEmployee = useCallback((idx: number, emp: CustomEmployee) => {
    const name = emp.name.trim();
    if (!name) return;
    const next = [...defaultEmployees];
    next[idx] = { name, account: emp.account || '', bank: emp.bank || '' };
    saveDefaultEmployees(next);
    setEditingDefaultEmployeeIdx(null);
  }, [defaultEmployees, saveDefaultEmployees]);
  const resetDefaultEmployees = useCallback(() => {
    if (confirm('Reset default staff to built-in list?')) {
      saveDefaultEmployees(EMPLOYEES_LIST.map(e => ({ name: e.name, account: e.account, bank: e.bank })));
      setEditingDefaultEmployeeIdx(null);
    }
  }, [saveDefaultEmployees]);

  const HistorySidebar = () => (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <History className="w-4 h-4" />
            History
          </div>
          <button
            onClick={() => setShowHistoryDrawer(false)}
            className="md:hidden p-2 -m-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 border-b border-gray-200">
          <button 
            onClick={() => { generateNewClaim(); setShowHistoryDrawer(false); }}
            className="w-full flex items-center justify-center gap-2 bg-pink-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            New Claim
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {(!history || history.length === 0) && (
             <div className="p-6 text-center text-gray-400 text-sm">No History</div>
          )}
          {(history || []).map(claim => {
            const claimItems = claim.items || [];
            const employee = claim.employee || {};
            return (
            <div 
              key={claim.id}
              onClick={() => loadClaim(claim)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors group relative ${
                currentId === claim.id ? 'bg-pink-50 border-l-4 border-l-pink-600' : 'hover:bg-gray-50 border-l-4 border-l-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-gray-700">{claim.claimNumber}</span>
                <span className="text-[10px] text-gray-400">{claim.updatedAt ? new Date(claim.updatedAt).toLocaleDateString() : ''}</span>
              </div>
              <div className="text-sm font-medium text-gray-900 truncate mb-1">
                {employee.name || 'Unnamed'}
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs text-gray-500">{claimItems.length} items</span>
                <span className="text-xs font-bold text-pink-600">
                  {claimItems.reduce((s, i) => s + (Number(i?.amount)||0), 0).toFixed(2)}
                </span>
              </div>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); loadClaim(claim); }}
                  className="p-1 text-gray-400 hover:text-pink-500 bg-white rounded-md shadow-sm border border-gray-200"
                  title="Amend / Edit"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => deleteClaim(e, claim.id)}
                  className="p-1 text-gray-400 hover:text-red-500 bg-white rounded-md shadow-sm border border-gray-200"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
          })}

          {benefitHistory.length > 0 && (
            <div className="border-t border-gray-200">
              <div className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase bg-gray-50">
                Staff Benefit
              </div>
              {benefitHistory.map((claim) => {
                const claimItems = claim.items || [];
                const employee = claim.employee || ({} as any);
                const total = claimItems.reduce((s: number, i: any) => s + (Number(i?.amount) || 0), 0);
                return (
                  <div
                    key={claim.id}
                    onClick={() => onOpenBenefitClaim?.(claim.id)}
                    className="p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 border-l-4 border-l-transparent"
                    title={onOpenBenefitClaim ? 'Open Staff Benefit claim' : undefined}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-gray-700">{claim.claimNumber}</span>
                      <span className="text-[10px] text-gray-400">
                        {claim.updatedAt ? new Date(claim.updatedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate mb-1">
                      {employee.name || 'Unnamed'}
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs text-gray-500">{claimItems.length} items</span>
                      <span className="text-xs font-bold text-purple-600">{total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
      
      {/* MOBILE: History drawer overlay */}
      {showHistoryDrawer && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setShowHistoryDrawer(false)}
          aria-hidden="true"
        />
      )}
      {/* MOBILE: History drawer panel */}
      {showHistoryDrawer && (
        <div className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] z-50 md:hidden shadow-xl bg-white">
          <HistorySidebar />
        </div>
      )}
      
      {/* HISTORY SIDEBAR - Desktop only (Hidden on Print) */}
      <div className="hidden md:block w-64 shrink-0 no-print self-start sticky top-24">
        <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-h-[calc(100vh-7rem)] flex flex-col">
          <HistorySidebar />
        </div>
      </div>

      {/* MAIN FORM AREA */}
      <div className="flex-1 space-y-6 min-w-0">
        
        {/* Action Bar (No Print) */}
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
              <span className="text-xs text-gray-500 uppercase font-bold">Claim No.</span>
              <div className="text-xl font-mono font-bold text-gray-800">{claimNumber}</div>
            </div>
            {currentId ? (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Save className="w-3 h-3" /> Saved
              </span>
            ) : (
              <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full font-medium">Unsaved Draft</span>
            )}
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
              onClick={handleExportCSV}
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

        {/* Upload Area (No Print) */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-dashed border-pink-300 bg-pink-50 flex flex-col items-center justify-center text-center no-print">
          <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mb-3">
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Upload Receipt / Invoice</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md">
            AI will automatically extract merchant, date, and amount. Supports images and PDF.
          </p>
          <div className="relative">
            <input 
              type="file" 
              multiple 
              accept="image/*,.pdf,application/pdf"
              capture="environment"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button disabled={isProcessing} className="bg-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50">
              {isProcessing ? 'Processing...' : 'Select Files'}
            </button>
          </div>
        </div>

        {/* The Form Paper */}
        <div className="bg-white shadow-lg border border-gray-200 p-4 sm:p-6 lg:p-8 min-h-[600px] sm:min-h-[800px] print:shadow-none print:border-none print:p-0 print:min-h-0 print:block">
          
          {/* Form Header */}
          <div className="border-b-2 border-gray-800 pb-4 sm:pb-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 uppercase tracking-tight">REIMBURSEMENT FORM</h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Charge To:</span>
                  <select
                    value={employee.chargeTo}
                    onChange={e => setEmployee({...employee, chargeTo: e.target.value})}
                    className="text-sm font-semibold bg-transparent border-b border-gray-300 focus:outline-none focus:border-pink-600"
                  >
                    <option value="GAIAS SDN BHD">GAIAS SDN BHD</option>
                    <option value="GAIAS PREMIER SDN BHD">GAIAS PREMIER SDN BHD</option>
                  </select>
                </div>
              </div>
              <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-gray-400">{claimNumber}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-12 gap-y-4">
              {/* Name Dropdown */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                  <button
                    type="button"
                    onClick={() => setShowManageModal(true)}
                    className="p-1 text-gray-400 hover:text-pink-600 rounded"
                    title="Manage custom employees & categories"
                    aria-label="Manage"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative">
                  <select 
                    value={isManualEmployee ? ADD_NEW_EMPLOYEE : employee.name}
                    onChange={handleNameChange}
                    className="w-full border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent appearance-none"
                  >
                    <option value="" disabled>Select Employee</option>
                    {allEmployees.map(emp => (
                      <option key={emp.name} value={emp.name}>{emp.name}</option>
                    ))}
                    <option value={ADD_NEW_EMPLOYEE}>+ Add New Employee</option>
                  </select>
                </div>
                {isManualEmployee && (
                  <input
                    type="text"
                    value={employee.name}
                    onChange={e => setEmployee(prev => ({ ...prev, name: e.target.value }))}
                    onBlur={handleManualEmployeeBlur}
                    placeholder="Enter employee name"
                    className="mt-2 w-full border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent"
                    autoFocus
                  />
                )}
              </div>

              {/* Date Input */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                <input 
                  type="date"
                  value={employee.claimDate}
                  onChange={e => setEmployee({...employee, claimDate: e.target.value})}
                  className="border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent"
                />
              </div>

              {/* Bank Name */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Bank Name</label>
                <input 
                  value={employee.bankName}
                  onChange={e => setEmployee({...employee, bankName: e.target.value})}
                  className="border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-gray-50/50"
                  placeholder="Auto-filled"
                />
              </div>

              {/* Bank Account */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Bank Account</label>
                <input 
                  value={employee.bankAccount}
                  onChange={e => setEmployee({...employee, bankAccount: e.target.value})}
                  className="border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-gray-50/50"
                  placeholder="Auto-filled"
                />
              </div>

              {/* Branch Dropdown */}
               <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Branch</label>
                <div className="relative">
                  <select 
                    value={employee.branch}
                    onChange={e => setEmployee({...employee, branch: e.target.value})}
                    className="w-full border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent appearance-none"
                  >
                    <option value="" disabled>Select Branch</option>
                    <option value="HQ">HQ</option>
                    <option value="PBJ">PBJ</option>
                    <option value="MVJB">MVJB</option>
                    <option value="IOI">IOI</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Form Table */}
          <div className="mb-8 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="py-2 w-10 no-print"></th>
                    <th className="py-2 text-xs font-bold text-gray-500 uppercase w-28">Date</th>
                    <th className="py-2 text-xs font-bold text-gray-500 uppercase w-32">Category</th>
                    <th className="py-2 text-xs font-bold text-gray-500 uppercase">Merchant / Description</th>
                    <th className="py-2 text-xs font-bold text-gray-500 uppercase w-16 no-print">Receipt</th>
                    <th className="py-2 text-xs font-bold text-gray-500 uppercase w-32 text-right">Amount</th>
                    <th className="py-2 w-10 no-print"></th>
                  </tr>
                </thead>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                        categories={allCategories}
                        onAddCustomCategory={addCustomCategory}
                        isEditingCustom={editingCustomCategoryId === item.id}
                        onStartEditCustom={startEditCustom}
                        onFinishEditCustom={finishEditCustom}
                        currencies={CURRENCIES_LIST}
                      />
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400 italic text-sm">
                          No items. Please upload receipts.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
            <button
              type="button"
              onClick={addEmptyRow}
              className="mt-4 flex items-center gap-1 text-sm text-pink-600 font-medium hover:text-pink-700 no-print cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Empty Row
            </button>
          </div>

          {/* Footer / Total */}
          <div className="bg-gray-50 p-4 sm:p-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div className="flex gap-6 sm:gap-12 text-sm text-gray-500">
                <div className="border-t border-gray-300 pt-2 w-24 text-center">Signature</div>
                <div className="border-t border-gray-300 pt-2 w-24 text-center">Approved By</div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold">Total Amount</p>
                <div className="text-3xl font-bold text-gray-900">
                    {totalAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Manage Default & Custom Employees & Categories Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowManageModal(false); setEditingPresetCategoryIdx(null); setEditingDefaultEmployeeIdx(null); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Manage Categories & Staff</h3>
              <button onClick={() => { setShowManageModal(false); setEditingPresetCategoryIdx(null); setEditingDefaultEmployeeIdx(null); }} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Default Categories (editable) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Default Categories</h4>
                  <div className="flex gap-1">
                    <button type="button" onClick={resetPresetCategories} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-2 py-1 rounded">Reset</button>
                    <button type="button" onClick={() => { const v = prompt('New category name:'); if (v) addPresetCategory(v); }} className="text-xs text-pink-600 hover:text-pink-700 font-medium">+ Add</button>
                  </div>
                </div>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {presetCategories.map((cat, idx) => (
                    <li key={cat} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg gap-2">
                      {editingPresetCategoryIdx === idx ? (
                        <input
                          autoFocus
                          defaultValue={cat}
                          className="flex-1 text-sm border border-pink-300 rounded px-2 py-1"
                          onKeyDown={e => {
                            if (e.key === 'Enter') updatePresetCategory(idx, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingPresetCategoryIdx(null);
                          }}
                          onBlur={e => updatePresetCategory(idx, e.target.value)}
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-800 truncate flex-1">{cat}</span>
                      )}
                      <div className="flex gap-0.5 shrink-0">
                        {editingPresetCategoryIdx !== idx && (
                          <button type="button" onClick={() => setEditingPresetCategoryIdx(idx)} className="p-1.5 text-gray-400 hover:text-pink-600 rounded" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        )}
                        <button type="button" onClick={() => removePresetCategory(cat)} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Default Staff (editable) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Default Staff</h4>
                  <div className="flex gap-1">
                    <button type="button" onClick={resetDefaultEmployees} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-2 py-1 rounded">Reset</button>
                    <button type="button" onClick={() => { const name = prompt('Employee name:'); if (name) addDefaultEmployee({ name: name.trim(), account: '', bank: '' }); }} className="text-xs text-pink-600 hover:text-pink-700 font-medium">+ Add</button>
                  </div>
                </div>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {defaultEmployees.map((emp, idx) => (
                    <li key={emp.name} className="py-2 px-3 bg-gray-50 rounded-lg">
                      {editingDefaultEmployeeIdx === idx ? (
                        <div className="space-y-1.5">
                          <input placeholder="Name" defaultValue={emp.name} className="w-full text-sm border border-pink-300 rounded px-2 py-1" id={`de-name-${idx}`} />
                          <input placeholder="Account" defaultValue={emp.account} className="w-full text-sm border border-gray-200 rounded px-2 py-1" id={`de-acc-${idx}`} />
                          <input placeholder="Bank" defaultValue={emp.bank} className="w-full text-sm border border-gray-200 rounded px-2 py-1" id={`de-bank-${idx}`} />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => { const el = document.getElementById(`de-name-${idx}`) as HTMLInputElement; const acc = document.getElementById(`de-acc-${idx}`) as HTMLInputElement; const bank = document.getElementById(`de-bank-${idx}`) as HTMLInputElement; updateDefaultEmployee(idx, { name: el?.value ?? emp.name, account: acc?.value ?? '', bank: bank?.value ?? '' }); }} className="text-xs bg-pink-600 text-white px-2 py-1 rounded">Save</button>
                            <button type="button" onClick={() => setEditingDefaultEmployeeIdx(null)} className="text-xs border border-gray-300 px-2 py-1 rounded">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-800 truncate">{emp.name}</div>
                            <div className="text-xs text-gray-500 truncate">{emp.account} {emp.bank ? ` · ${emp.bank}` : ''}</div>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <button type="button" onClick={() => setEditingDefaultEmployeeIdx(idx)} className="p-1.5 text-gray-400 hover:text-pink-600 rounded" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => removeDefaultEmployee(emp.name)} className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Custom Employees (add-only from form; delete here) */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Custom Employees</h4>
                {customEmployees.length === 0 ? (
                  <p className="text-sm text-gray-500">No custom employees yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {customEmployees.map(emp => (
                      <li key={emp.name} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-800 truncate">{emp.name}</span>
                        <button
                          onClick={() => removeCustomEmployee(emp.name)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Delete"
                          aria-label={`Delete ${emp.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Custom Categories */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Custom Categories</h4>
                {customCategories.length === 0 ? (
                  <p className="text-sm text-gray-500">No custom categories yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {customCategories.map(cat => (
                      <li key={cat} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-800 truncate">{cat}</span>
                        <button
                          onClick={() => removeCustomCategory(cat)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Delete"
                          aria-label={`Delete ${cat}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReimbursementView;
