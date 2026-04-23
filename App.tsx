import React from 'react';
import ClaimsHub from './components/ClaimsHub';
import { ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-pink-50 font-sans print:bg-white">
      {/* Navigation Header */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 sticky top-0 z-50 shadow-md no-print">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-8 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center overflow-hidden">
                  <img src="/gaias-logo.png" alt="GAIAS" className="w-8 h-8 object-contain" />
                </div>
                <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 border border-white/10">
                  <ShieldCheck className="w-5 h-5 text-white/90" />
                </div>
              </div>
              <div>
                <h1 className="font-bold text-white text-base sm:text-lg leading-tight tracking-wide">GAIAS REIMBURSEMENT</h1>
                <div className="text-[11px] text-slate-300/90 font-medium tracking-wide">Claims & Benefits</div>
              </div>
            </div>
            <span className="text-slate-200/90 text-xs sm:text-sm font-medium tracking-wide">
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Version V1.1
              </span>
            </span>
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
