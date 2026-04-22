import React, { useState } from 'react';
import { ClipboardList, Car, HeartHandshake } from 'lucide-react';
import ReimbursementView from './ReimbursementView';
import MileageClaimView from './MileageClaimView';
import StaffBenefitClaimView from './StaffBenefitClaimView';

type ClaimsTab = 'reimbursement' | 'mileage' | 'benefit';

const ClaimsHub: React.FC = () => {
  const [tab, setTab] = useState<ClaimsTab>('reimbursement');

  const tabs: Array<{ id: ClaimsTab; label: string; Icon: React.ComponentType<any> }> = [
    { id: 'reimbursement', label: 'Reimbursement', Icon: ClipboardList },
    { id: 'mileage', label: 'Mileage Claim', Icon: Car },
    { id: 'benefit', label: 'Staff Benefit', Icon: HeartHandshake },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-2 flex gap-2 no-print">
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
      </div>

      {tab === 'reimbursement' && <ReimbursementView />}
      {tab === 'mileage' && <MileageClaimView />}
      {tab === 'benefit' && <StaffBenefitClaimView />}
    </div>
  );
};

export default ClaimsHub;

