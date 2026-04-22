import React, { useState } from 'react';
import { Upload, FileText, Plus } from 'lucide-react';
import { SheetData } from '../types';
import { parseCSV } from '../utils/csv';
import { SAMPLE_SHEET_A, SAMPLE_SHEET_B } from '../constants';

interface DataIngestProps {
  onImport: (data: SheetData) => void;
}

const DataIngest: React.FC<DataIngestProps> = ({ onImport }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteName, setPasteName] = useState('New Sheet');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const data = parseCSV(text, file.name.replace('.csv', ''));
        onImport(data);
      } catch (err) {
        alert('解析 CSV 失败，请检查格式');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteImport = () => {
    try {
      const data = parseCSV(pasteContent, pasteName);
      onImport(data);
      setPasteContent('');
      setPasteName('New Sheet');
    } catch (err) {
      alert('解析文本内容失败');
    }
  };

  const loadSample = () => {
      onImport(parseCSV(SAMPLE_SHEET_A, "Employees"));
      onImport(parseCSV(SAMPLE_SHEET_B, "WorkLogs"));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5 text-pink-600" />
        导入数据
      </h2>

      <div className="flex gap-4 mb-4 border-b border-gray-100 pb-2">
        <button
          onClick={() => setActiveTab('upload')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'upload' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          文件上传 (CSV)
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'paste' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          粘贴文本
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">点击选择或拖入 CSV 文件</p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
          />
           <div className="mt-6 pt-4 border-t border-gray-100">
             <button onClick={loadSample} className="text-sm text-pink-600 hover:underline">加载示例数据 (HR & Logs)</button>
           </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder="表格名称"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-pink-500 outline-none"
          />
          <textarea
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder="粘贴 CSV 格式内容..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-pink-500 outline-none resize-none"
          />
          <button
            onClick={handlePasteImport}
            disabled={!pasteContent.trim()}
            className="w-full bg-pink-600 text-white py-2 rounded-md hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            导入文本数据
          </button>
        </div>
      )}
    </div>
  );
};

export default DataIngest;
