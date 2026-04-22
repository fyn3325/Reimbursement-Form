import React from 'react';
import { SheetData } from '../types';
import { X, Table } from 'lucide-react';

interface DataPreviewProps {
  sheet: SheetData;
  onRemove?: (id: string) => void;
  isPrimary?: boolean;
}

const DataPreview: React.FC<DataPreviewProps> = ({ sheet, onRemove, isPrimary }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-[400px] ${isPrimary ? 'border-pink-200 ring-2 ring-pink-100' : 'border-gray-200'}`}>
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${isPrimary ? 'bg-pink-100 text-pink-600' : 'bg-gray-200 text-gray-600'}`}>
            <Table className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{sheet.name}</h3>
            <p className="text-xs text-gray-500">{sheet.rows.length} 行 • {sheet.headers.length} 列</p>
          </div>
        </div>
        {onRemove && (
          <button onClick={() => onRemove(sheet.id)} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="overflow-auto flex-1 p-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              {sheet.headers.map((header, idx) => (
                <th key={idx} className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sheet.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                {sheet.headers.map((header, colIdx) => (
                  <td key={`${rowIdx}-${colIdx}`} className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataPreview;
