import React from 'react';
import { Expense } from '../types';
import { Check, Upload, AlertCircle, Building, User } from 'lucide-react';

interface ExpenseTableProps {
  expenses: Expense[];
  onUpdateExpense: (id: string, updates: Partial<Expense>) => void;
}

const ExpenseTable: React.FC<ExpenseTableProps> = ({ expenses, onUpdateExpense }) => {
  if (expenses.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">支出明细与审计状态</h3>
        <span className="text-xs text-gray-500">共 {expenses.length} 笔交易</span>
      </div>
      
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">日期</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">商户 / 描述</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">金额</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">分类 (AI)</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">单据状态</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses.map((expense) => {
              const isRisk = expense.category === 'COMPANY' && !expense.hasReceipt;
              
              return (
                <tr key={expense.id} className={`hover:bg-gray-50 transition-colors ${isRisk ? 'bg-red-50/30' : ''}`}>
                  <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">{expense.date}</td>
                  <td className="px-6 py-3">
                    <div className="text-sm font-medium text-gray-900">{expense.merchant}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{expense.reasoning}</div>
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {expense.amount.toFixed(2)} <span className="text-gray-400 text-xs">{expense.currency}</span>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => onUpdateExpense(expense.id, { 
                        category: expense.category === 'COMPANY' ? 'PERSONAL' : 'COMPANY' 
                      })}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        expense.category === 'COMPANY' 
                          ? 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' 
                          : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      {expense.category === 'COMPANY' ? <Building className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {expense.category === 'COMPANY' ? '企业公费' : '个人消费'}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                     {expense.category === 'PERSONAL' ? (
                        <span className="text-xs text-gray-400">-</span>
                     ) : expense.hasReceipt ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <Check className="w-3.5 h-3.5" />
                          已上传
                        </span>
                     ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          缺失单据
                        </span>
                     )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {expense.category === 'COMPANY' && !expense.hasReceipt && (
                      <button
                        onClick={() => onUpdateExpense(expense.id, { hasReceipt: true })}
                        className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md inline-flex items-center gap-1 transition-colors"
                      >
                        <Upload className="w-3 h-3" />
                        补交票据
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseTable;
