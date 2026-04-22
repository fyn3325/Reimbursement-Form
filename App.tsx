import React from 'react';
import ClaimsHub from './components/ClaimsHub';
import { ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-pink-50 font-sans print:bg-white">
      {/* Navigation Header */}
      <header className="bg-rose-900 border-b border-rose-800 sticky top-0 z-50 shadow-md no-print">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-8 flex-1">
            <div className="flex items-center gap-3">
              <div className="bg-pink-600 p-2 rounded-lg shadow-lg shadow-pink-900/50">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white text-base sm:text-lg leading-tight tracking-wide">REIMBURSEMENT FORM</h1>
              </div>
            </div>
            <span className="text-rose-200/90 text-xs sm:text-sm font-medium tracking-wide">Version V1.1</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 sm:p-6 print:p-0 print:max-w-none">
          <ClaimsHub />
      </main>
    </div>
  );
};

export default App;
