import React, { useState } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { processStatementImage, processStatementText } from '../services/geminiService';
import { compressImage } from '../utils/imageCompress';
import { Expense } from '../types';
import { SAMPLE_STATEMENT_TEXT } from '../constants';

interface StatementUploaderProps {
  onExpensesLoaded: (expenses: Expense[], fileName: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const StatementUploader: React.FC<StatementUploaderProps> = ({ onExpensesLoaded, isLoading, setIsLoading }) => {
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');
  const [textInput, setTextInput] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    e.target.value = '';
    try {
      const { base64, mimeType } = await compressImage(file);
      const expenses = await processStatementImage(base64, mimeType);
      onExpensesLoaded(expenses, file.name);
    } catch (err) {
      console.error(err);
      alert('AI processing failed. Ensure the file is a clear image or PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextProcess = async () => {
    if (!textInput.trim()) return;
    setIsLoading(true);
    try {
      const expenses = await processStatementText(textInput);
      onExpensesLoaded(expenses, "Text Import");
      setTextInput('');
    } catch (err) {
      console.error(err);
      alert("AI 解析失败");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSample = () => {
    setTextInput(SAMPLE_STATEMENT_TEXT);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5 text-pink-600" />
        导入账单
      </h2>

      <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'image' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          图片/截图
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'text' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          粘贴文本
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        {activeTab === 'image' ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl flex-1 flex flex-col items-center justify-center p-6 text-center hover:bg-gray-50 transition-colors relative">
            {isLoading ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 text-pink-600 animate-spin mx-auto" />
                <p className="text-sm text-gray-500 font-medium">AI 正在分析账单...</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-pink-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">上传 PDF 截图或照片</h3>
                <p className="text-xs text-gray-500 mb-4">JPG, PNG, PDF supported (AI will classify)</p>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  选择文件
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-4">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="请粘贴信用卡账单文本..."
              className="flex-1 w-full p-4 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-pink-500 outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={loadSample} className="text-xs text-gray-400 hover:text-pink-600 px-2">
                加载示例
              </button>
              <button
                onClick={handleTextProcess}
                disabled={isLoading || !textInput.trim()}
                className="flex-1 bg-pink-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '开始分析'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementUploader;
