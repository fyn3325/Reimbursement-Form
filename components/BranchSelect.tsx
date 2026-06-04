import React, { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { addCustomBranch, loadBranches } from '../lib/branches';

const ADD_BRANCH_VALUE = '__ADD_BRANCH__';

interface BranchSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const BranchSelect: React.FC<BranchSelectProps> = ({ value, onChange }) => {
  const [branches, setBranches] = useState<string[]>(() => loadBranches(value));
  const [isAdding, setIsAdding] = useState(false);
  const [newBranch, setNewBranch] = useState('');

  useEffect(() => {
    const refreshBranches = () => setBranches(loadBranches(value));
    refreshBranches();
    window.addEventListener('storage', refreshBranches);
    window.addEventListener('auditlink:branches-updated', refreshBranches);

    return () => {
      window.removeEventListener('storage', refreshBranches);
      window.removeEventListener('auditlink:branches-updated', refreshBranches);
    };
  }, [value]);

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    if (selectedValue === ADD_BRANCH_VALUE) {
      setIsAdding(true);
      setNewBranch('');
      return;
    }

    onChange(selectedValue);
  };

  const saveBranch = () => {
    const savedBranch = addCustomBranch(newBranch);
    if (!savedBranch) return;

    setBranches(loadBranches(savedBranch));
    onChange(savedBranch);
    setIsAdding(false);
    setNewBranch('');
  };

  return (
    <div>
      <select
        value={value}
        onChange={handleSelect}
        className="w-full border-b border-gray-300 py-1 focus:outline-none focus:border-pink-600 font-medium bg-transparent appearance-none"
      >
        <option value="" disabled>
          Select Branch
        </option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
        <option value={ADD_BRANCH_VALUE}>+ Add Branch</option>
      </select>

      {isAdding && (
        <div className="mt-2 flex items-center gap-2 no-print">
          <input
            autoFocus
            value={newBranch}
            onChange={(event) => setNewBranch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveBranch();
              if (event.key === 'Escape') setIsAdding(false);
            }}
            placeholder="New branch"
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-medium focus:outline-none focus:border-pink-600"
          />
          <button
            type="button"
            onClick={saveBranch}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-pink-200 text-pink-700 hover:bg-pink-50"
            title="Save branch"
            aria-label="Save branch"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewBranch('');
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-pink-700 hover:text-pink-800 no-print"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Branch
        </button>
      )}
    </div>
  );
};

export default BranchSelect;
