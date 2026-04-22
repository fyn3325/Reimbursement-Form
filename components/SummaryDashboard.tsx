import React from 'react';
import { AuditStats } from '../types';
import { DollarSign, Briefcase, User, AlertTriangle } from 'lucide-react';

interface SummaryDashboardProps {
  stats: AuditStats;
}

const StatCard = ({ label, value, subValue, icon: Icon, colorClass, bgClass }: any) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      {subValue && <p className="text-xs mt-1 text-gray-400">{subValue}</p>}
    </div>
    <div className={`p-2.5 rounded-lg ${bgClass}`}>
      <Icon className={`w-5 h-5 ${colorClass}`} />
    </div>
  </div>
);

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="总支出"
        value={`$${stats.totalSpend.toFixed(2)}`}
        icon={DollarSign}
        colorClass="text-gray-600"
        bgClass="bg-gray-100"
      />
      <StatCard
        label="企业支出"
        value={`$${stats.companySpend.toFixed(2)}`}
        subValue={`${((stats.companySpend / (stats.totalSpend || 1)) * 100).toFixed(0)}% 的总额`}
        icon={Briefcase}
        colorClass="text-pink-600"
        bgClass="bg-pink-50"
      />
      <StatCard
        label="个人消费"
        value={`$${stats.personalSpend.toFixed(2)}`}
        icon={User}
        colorClass="text-purple-600"
        bgClass="bg-purple-50"
      />
      <StatCard
        label="缺失单据 (审计风险)"
        value={`${stats.missingReceiptsCount} 笔`}
        subValue={stats.missingReceiptsCount > 0 ? "需尽快补充发票" : "合规完美"}
        icon={AlertTriangle}
        colorClass={stats.missingReceiptsCount > 0 ? "text-red-600" : "text-green-600"}
        bgClass={stats.missingReceiptsCount > 0 ? "bg-red-50" : "bg-green-50"}
      />
    </div>
  );
};

export default SummaryDashboard;
