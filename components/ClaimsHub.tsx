import React, { useState } from 'react';
import { ClipboardList, Car, HeartHandshake, RefreshCcw } from 'lucide-react';
import ReimbursementView from './ReimbursementView';
import MileageClaimView from './MileageClaimView';
import StaffBenefitClaimView from './StaffBenefitClaimView';
import type { EmployeeInfo } from '../types';
import { resetEmployeeOverrides } from '../lib/employees';

type ClaimsTab = 'reimbursement' | 'mileage' | 'benefit';

const ClaimsHub: React.FC = () => {
  const [tab, setTab] = useState<ClaimsTab>('reimbursement');
  const [benefitPrefill, setBenefitPrefill] = useState<{
    employee: EmployeeInfo;
    amount: number;
    currency: string;
    sourceMileageClaimNumber: string;
  } | null>(null);

  const tabs: Array<{ id: ClaimsTab; label: string; Icon: React.ComponentType<any> }> = [
    { id: 'reimbursement', label: 'Reimbursement', Icon: ClipboardList },
    { id: 'benefit', label: 'Staff Benefit', Icon: HeartHandshake },
    { id: 'mileage', label: 'Mileage Claim', Icon: Car },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-2 flex gap-2 items-center no-print">
        {tabs.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                active ? 'bg-pink-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
        <button
          onClick={() => {
            if (!confirm('Re-import staff list? This will clear any custom employee edits saved in this browser.')) return;
            resetEmployeeOverrides();
            alert('Staff list reset. Refreshing…');
            window.location.reload();
          }}
          className="shrink-0 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200"
          title="Re-import staff list"
        >
          <RefreshCcw className="w-4 h-4" />
          Staff
        </button>
      </div>

      {tab === 'reimbursement' && <ReimbursementView />}
      {tab === 'benefit' && (
        <StaffBenefitClaimView
          prefillFromMileage={benefitPrefill}
          onPrefillApplied={() => setBenefitPrefill(null)}
          tabToReimbursement={() => setTab('reimbursement')}
        />
      )}
      {tab === 'mileage' && (
        <MileageClaimView
          onSendToBenefit={(payload) => {
            setBenefitPrefill(payload);
            setTab('benefit');
          }}
        />
      )}
    </div>
  );
};

export default ClaimsHub;
