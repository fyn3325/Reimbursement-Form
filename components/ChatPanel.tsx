import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, ShieldCheck } from 'lucide-react';
import { Expense } from '../types';
import { chatWithAudit } from '../services/geminiService';

interface ChatPanelProps {
  expenses: Expense[];
}

interface Message {
  role: 'user' | 'ai';
  text: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ expenses }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: '我是审计助手。您可以问我关于这些支出的合规性问题，例如："有哪些大额企业支出？" 或 "总共有多少缺失发票？"' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const response = await chatWithAudit(expenses, userMsg);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: '分析时遇到错误，请重试。' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-slate-800 px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-green-400" />
        <h3 className="font-semibold text-white text-sm">AI 审计咨询</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
        {expenses.length === 0 && (
           <div className="text-center text-gray-400 mt-10">
             <Bot className="w-12 h-12 mx-auto mb-2 opacity-30" />
             <p className="text-sm">请先导入账单</p>
           </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-pink-600 text-white rounded-br-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-2 text-sm text-gray-500 animate-pulse">
              正在审计中...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={expenses.length > 0 ? "输入问题..." : "等待数据导入..."}
            disabled={expenses.length === 0 || loading}
            className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all"
          />
          <button
            onClick={handleSend}
            disabled={expenses.length === 0 || loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-pink-600 hover:bg-pink-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
