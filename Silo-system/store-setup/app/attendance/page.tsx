'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, XCircle, AlertCircle, User, Filter } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getEmployeesAttendance, type AttendanceRecord, type AttendanceSummary } from '@/lib/attendance-api';
import { getBranches, type Branch } from '@/lib/branches-api';

export default function AttendancePage() {
  const { t, isRTL } = useLanguage();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [startDate, endDate, selectedBranch]);

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const loadAttendance = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getEmployeesAttendance({
        start_date: startDate,
        end_date: endDate,
        branch_id: selectedBranch || undefined,
      });
      setRecords(result.records);
      setSummary(result.summary);
    } catch (err: any) {
      console.error('Failed to load attendance:', err);
      setError(err.response?.data?.error || t('Failed to load attendance records', 'فشل في تحميل سجلات الحضور'));
    } finally {
      setIsLoading(false);
    }
  };

  // Filter records by search query
  const filteredRecords = records.filter((record) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      record.employee_name.toLowerCase().includes(query) ||
      record.employee_role.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_time':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            {t('On Time', 'في الوقت')}
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-3 h-3" />
            {t('Late', 'متأخر')}
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            <XCircle className="w-3 h-3" />
            {t('Absent', 'غائب')}
          </span>
        );
      case 'checked_in':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            <Clock className="w-3 h-3" />
            {t('Checked In', 'مسجل دخول')}
          </span>
        );
      case 'checked_out':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400">
            <CheckCircle2 className="w-3 h-3" />
            {t('Checked Out', 'مسجل خروج')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'manager':
        return 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300';
      case 'operations_manager':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    }
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search employees...', ar: 'البحث في الموظفين...' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Attendance Records', 'سجلات الحضور')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('View employee attendance and time tracking', 'عرض حضور الموظفين وتتبع الوقت')}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.on_time}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('On Time', 'في الوقت')}</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.late}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Late', 'متأخر')}</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.absent}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Absent', 'غائب')}</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{summary.checked_in}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Currently In', 'حاليا في العمل')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('Filters', 'الفلاتر')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-500 dark:text-zinc-400">{t('From', 'من')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-500 dark:text-zinc-400">{t('To', 'الى')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
            {branches.length > 1 && (
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                <option value="">{t('All Branches', 'كل الفروع')}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              placeholder={t('Search employee...', 'البحث عن موظف...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 min-w-[200px]"
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <Clock className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400">
              {t('No attendance records found for the selected period.', 'لم يتم العثور على سجلات حضور للفترة المحددة.')}
            </p>
          </div>
        ) : (
          /* Records Table */
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Employee', 'الموظف')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Date', 'التاريخ')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Check In', 'تسجيل الدخول')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Check Out', 'تسجيل الخروج')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Hours', 'الساعات')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Status', 'الحالة')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              {record.employee_name}
                            </p>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadge(record.employee_role)}`}>
                              {t(
                                record.employee_role === 'manager' ? 'Manager' :
                                record.employee_role === 'operations_manager' ? 'Ops Manager' : 'Employee',
                                record.employee_role === 'manager' ? 'مدير' :
                                record.employee_role === 'operations_manager' ? 'مدير عمليات' : 'موظف'
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-zinc-900 dark:text-white">{record.date}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{record.day_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-900 dark:text-white">
                          {record.checkin_time || '-'}
                        </span>
                        {record.late_minutes > 0 && (
                          <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                            (+{record.late_minutes}m)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-900 dark:text-white">
                          {record.checkout_time || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-900 dark:text-white">
                          {record.total_hours ? `${record.total_hours.toFixed(1)}h` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(record.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </PageLayout>
  );
}
