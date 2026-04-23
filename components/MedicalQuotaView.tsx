import React, { useMemo, useState } from 'react';
import type { StaffBenefitClaim } from '../types';
import { createEmptyMedicalUsageSummary, computeMedicalUsage, listBenefitClaimYears, MEDICAL_ITEM_MAX, MEDICAL_YEARLY_QUOTA } from '../lib/quota';
import { loadEmployees } from '../lib/employees';

type MedicalQuotaViewProps = {
  benefitHistory: StaffBenefitClaim[];
};

function formatMoney(n: number): string {
  return `RM${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

const MedicalQuotaView: React.FC<MedicalQuotaViewProps> = ({ benefitHistory }) => {
  const years = useMemo(() => listBenefitClaimYears(benefitHistory), [benefitHistory]);
  const [year, setYear] = useState<number>(() => years[0] ?? new Date().getFullYear());
  const [query, setQuery] = useState('');
  const [openEmployee, setOpenEmployee] = useState<string | null>(null);

  const medicalUsageMap = useMemo(() => computeMedicalUsage(benefitHistory, { year }), [benefitHistory, year]);
  const employees = loadEmployees();

  const rows = useMemo(() => {
    const names = new Set<string>();
    for (const e of employees) {
      const n = (e?.name || '').trim();
      if (n) names.add(n);
    }
    for (const v of medicalUsageMap.values()) {
      const n = (v?.employeeName || '').trim();
      if (n) names.add(n);
    }

    const q = query.trim().toLowerCase();
    const list = Array.from(names)
      .filter((n) => (!q ? true : n.toLowerCase().includes(q)))
      .sort((a, b) => a.localeCompare(b));

    return list.map((employeeName) => {
      const key = `${employeeName}::${year}`;
      return medicalUsageMap.get(key) || createEmptyMedicalUsageSummary(employeeName, year);
    });
  }, [employees, medicalUsageMap, query, year]);

  const totals = useMemo(() => {
    let used = 0;
    for (const r of rows) used += r.used;
    return { used, remaining: Math.max(0, rows.length * MEDICAL_YEARLY_QUOTA - used) };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-gray-900">Medical Quota</div>
            <div className="text-xs text-gray-500 mt-1">
              Yearly quota per employee: RM{MEDICAL_YEARLY_QUOTA.toFixed(0)} · Max per medical entry: RM{MEDICAL_ITEM_MAX.toFixed(0)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employee…"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-white"
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600">
          Employees: <span className="font-mono font-semibold">{rows.length}</span> · Total used: <span className="font-mono font-semibold">{formatMoney(totals.used)}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead className="bg-gray-50">
              <tr className="text-xs font-bold text-gray-500 uppercase">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 w-40 text-right">Used</th>
                <th className="px-4 py-3 w-40 text-right">Remaining</th>
                <th className="px-4 py-3 w-40">Last used</th>
                <th className="px-4 py-3 w-28 text-right">Entries</th>
                <th className="px-4 py-3 w-28 no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const isOpen = openEmployee === r.employeeName;
                return (
                  <React.Fragment key={r.employeeName}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{r.employeeName}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatMoney(r.used)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatMoney(r.remaining)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.lastUsedDate || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{r.entries.length}</td>
                      <td className="px-4 py-3 text-right no-print">
                        {r.entries.length ? (
                          <button
                            type="button"
                            onClick={() => setOpenEmployee(isOpen ? null : r.employeeName)}
                            className="text-sm font-semibold text-pink-700 hover:text-pink-800"
                          >
                            {isOpen ? 'Hide' : 'Details'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-white">
                        <td colSpan={6} className="px-4 pb-4">
                          <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-gray-50">
                                <tr className="text-xs font-bold text-gray-500 uppercase">
                                  <th className="px-3 py-2 w-28">Date</th>
                                  <th className="px-3 py-2 w-44">Claim No.</th>
                                  <th className="px-3 py-2">Description</th>
                                  <th className="px-3 py-2 w-32 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {r.entries.map((e, idx) => (
                                  <tr key={`${e.claimId}:${idx}`} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-sm text-gray-700">{e.date || '—'}</td>
                                    <td className="px-3 py-2 text-sm font-mono font-semibold text-gray-800">{e.claimNumber}</td>
                                    <td className="px-3 py-2 text-sm text-gray-700">{e.description || 'Medical'}</td>
                                    <td className="px-3 py-2 text-right text-sm font-mono font-semibold text-gray-800">{formatMoney(e.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MedicalQuotaView;

