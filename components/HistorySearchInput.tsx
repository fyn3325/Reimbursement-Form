import React from 'react';
import { Search, X } from 'lucide-react';

interface HistorySearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HistorySearchInput: React.FC<HistorySearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search employee',
}) => (
  <div className="relative">
    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-8 text-sm text-gray-800 placeholder:text-gray-400 focus:border-pink-500 focus:outline-none"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Clear search"
        title="Clear search"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

export default HistorySearchInput;
