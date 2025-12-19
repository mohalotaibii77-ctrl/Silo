'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Command, 
  LogOut, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronDown,
  Calendar,
  Store,
  Mail,
  Phone,
  MapPin,
  ImageIcon,
  MessageSquare,
  StickyNote,
  Building2,
  Globe,
  Percent
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

interface Business {
  id: number;
  name: string;
  slug: string;
}

interface ChangeRequest {
  id: number;
  request_type: string;
  status: 'pending' | 'approved' | 'rejected';
  new_name?: string;
  new_email?: string;
  new_phone?: string;
  new_address?: string;
  new_logo_url?: string;
  new_certificate_url?: string;
  // Localization fields
  new_currency?: string;
  new_language?: string;
  new_timezone?: string;
  // Tax fields
  new_vat_enabled?: boolean;
  new_vat_rate?: number;
  requester_notes?: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
  reviewed_at?: string;
}

export default function RequestsPage() {
  const router = useRouter();
  const { isRTL, t } = useLanguage();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');
    const storedBusiness = localStorage.getItem('setup_business');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'owner' && parsedUser.role !== 'manager') {
        router.push('/login');
        return;
      }
      if (storedBusiness) {
        setBusiness(JSON.parse(storedBusiness));
      }
    } catch {
      router.push('/login');
      return;
    }

    setLoading(false);
    fetchRequests();
  }, [router]);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/business-settings/change-requests');
      setRequests(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('setup_token');
    localStorage.removeItem('setup_user');
    localStorage.removeItem('setup_business');
    router.push('/login');
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('Just now', 'الآن');
    if (diffMins < 60) return `${diffMins}${t('m ago', 'د مضت')}`;
    if (diffHours < 24) return `${diffHours}${t('h ago', 'س مضت')}`;
    if (diffDays < 7) return `${diffDays}${t('d ago', 'ي مضت')}`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <CheckCircle className="w-3 h-3" />
            {t('Approved', 'موافق عليه')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            <XCircle className="w-3 h-3" />
            {t('Rejected', 'مرفوض')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            {t('Pending', 'قيد الانتظار')}
          </span>
        );
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'logo': return t('Logo Update', 'تحديث الشعار');
      case 'certificate': return t('Certificate Upload', 'رفع الشهادة');
      case 'profile':
      case 'info': return t('Profile Update', 'تحديث الملف الشخصي');
      case 'localization': return t('Localization Settings', 'إعدادات التوطين');
      case 'tax': return t('Tax/VAT Settings', 'إعدادات الضريبة');
      default: return t('Change Request', 'طلب تغيير');
    }
  };

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'logo': return <ImageIcon className="w-5 h-5" />;
      case 'certificate': return <FileText className="w-5 h-5" />;
      case 'localization': return <Globe className="w-5 h-5" />;
      case 'tax': return <Percent className="w-5 h-5" />;
      default: return <Store className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Command className="w-8 h-8 animate-spin text-zinc-900 dark:text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <Suspense fallback={<div className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hidden md:block" />}>
        <Sidebar business={business} />
      </Suspense>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-semibold text-zinc-900 dark:text-white">{t('My Requests', 'طلباتي')}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <ModeToggle />
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <User size={16} className="text-zinc-600 dark:text-zinc-400" />
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-500 hover:text-red-600">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                  {t('Change Requests', 'طلبات التغيير')}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  {t('Track the status of your submitted requests', 'تتبع حالة طلباتك المقدمة')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">
                  {requests.length} {t('total requests', 'إجمالي الطلبات')}
                </span>
              </div>
            </div>

            {/* Requests List */}
            {requests.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                  {t('No requests yet', 'لا توجد طلبات بعد')}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  {t('Submit a change request from your store profile settings', 'قدم طلب تغيير من إعدادات ملف متجرك')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => {
                  const isExpanded = expandedId === req.id;
                  const dateInfo = formatDateTime(req.created_at);
                  const reviewedDateInfo = req.reviewed_at ? formatDateTime(req.reviewed_at) : null;
                  
                  return (
                    <motion.div
                      key={req.id}
                      layout
                      className={`bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden transition-all ${
                        isExpanded 
                          ? 'border-zinc-300 dark:border-zinc-700 shadow-lg' 
                          : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Collapsed Header */}
                      <div 
                        className="p-5 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            req.status === 'approved' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              : req.status === 'rejected'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}>
                            {getRequestIcon(req.request_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-zinc-900 dark:text-white">
                                  {getRequestTypeLabel(req.request_type)}
                                </span>
                                {getStatusBadge(req.status)}
                              </div>
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              >
                                <ChevronDown className="w-5 h-5 text-zinc-400" />
                              </motion.div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                {t('Submitted', 'مقدم')}: {dateInfo.relative}
                              </span>
                              {req.status !== 'pending' && reviewedDateInfo && (
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle className="w-4 h-4" />
                                  {t('Reviewed', 'تمت المراجعة')}: {reviewedDateInfo.relative}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-5">
                              {/* Timeline */}
                              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                  {t('Timeline', 'الجدول الزمني')}
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                      <FileText className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        {t('Request Submitted', 'تم تقديم الطلب')}
                                      </p>
                                      <p className="text-xs text-zinc-500">
                                        {dateInfo.date} {t('at', 'في')} {dateInfo.time}
                                      </p>
                                    </div>
                                  </div>
                                  {req.status !== 'pending' && reviewedDateInfo && (
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        req.status === 'approved'
                                          ? 'bg-green-100 dark:bg-green-900/30'
                                          : 'bg-red-100 dark:bg-red-900/30'
                                      }`}>
                                        {req.status === 'approved' 
                                          ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                          : <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                        }
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                          {req.status === 'approved' 
                                            ? t('Request Approved', 'تم الموافقة على الطلب')
                                            : t('Request Rejected', 'تم رفض الطلب')
                                          }
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                          {reviewedDateInfo.date} {t('at', 'في')} {reviewedDateInfo.time}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Requested Changes */}
                              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                  {t('Requested Changes', 'التغييرات المطلوبة')}
                                </h4>
                                <div className="space-y-2">
                                  {req.new_name && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Store className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Name', 'الاسم الجديد')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_name}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_email && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Mail className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Email', 'البريد الجديد')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_email}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_phone && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Phone className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Phone', 'الهاتف الجديد')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_phone}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_address && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <MapPin className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Address', 'العنوان الجديد')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_address}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_logo_url && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                                        <ImageIcon className="w-4 h-4" />
                                        {t('New Logo', 'الشعار الجديد')}
                                      </div>
                                      <div className="w-20 h-20 rounded-xl bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
                                        <img src={req.new_logo_url} alt="New logo" className="w-full h-full object-cover" />
                                      </div>
                                    </div>
                                  )}
                                  {req.new_certificate_url && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <FileText className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Certificate', 'الشهادة الجديدة')}: </span>
                                        <a 
                                          href={req.new_certificate_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline"
                                        >
                                          {t('View Certificate', 'عرض الشهادة')}
                                        </a>
                                      </div>
                                    </div>
                                  )}
                                  {/* Localization Fields */}
                                  {req.new_currency && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Globe className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Currency', 'العملة الجديدة')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_currency}</span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_language && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Globe className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Language', 'اللغة الجديدة')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">
                                          {req.new_language === 'en' ? t('English', 'الإنجليزية') : req.new_language === 'ar' ? t('Arabic', 'العربية') : req.new_language}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_timezone && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Globe className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New Timezone', 'المنطقة الزمنية الجديدة')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_timezone}</span>
                                      </div>
                                    </div>
                                  )}
                                  {/* Tax/VAT Fields */}
                                  {req.new_vat_enabled !== undefined && req.new_vat_enabled !== null && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Percent className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('VAT Enabled', 'تفعيل الضريبة')}: </span>
                                        <span className={`font-medium ${req.new_vat_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                          {req.new_vat_enabled ? t('Yes', 'نعم') : t('No', 'لا')}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {req.new_vat_rate !== undefined && (
                                    <div className="flex items-start gap-2 text-sm">
                                      <Percent className="w-4 h-4 text-zinc-400 mt-0.5" />
                                      <div>
                                        <span className="text-zinc-500">{t('New VAT Rate', 'نسبة الضريبة الجديدة')}: </span>
                                        <span className="font-medium text-zinc-900 dark:text-white">{req.new_vat_rate}%</span>
                                      </div>
                                    </div>
                                  )}
                                  {!req.new_name && !req.new_email && !req.new_phone && !req.new_address && !req.new_logo_url && !req.new_certificate_url && 
                                   !req.new_currency && !req.new_language && !req.new_timezone && req.new_vat_enabled === undefined && req.new_vat_rate === undefined && (
                                    <p className="text-sm text-zinc-500 italic">
                                      {t('No specific changes detailed', 'لم يتم تفصيل تغييرات محددة')}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Your Note (if any) */}
                              {req.requester_notes && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-2 mb-2">
                                    <StickyNote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                      {t('Your Note', 'ملاحظتك')}
                                    </h4>
                                  </div>
                                  <p className="text-sm text-blue-800 dark:text-blue-200">
                                    {req.requester_notes}
                                  </p>
                                </div>
                              )}

                              {/* Admin Response (if any) */}
                              {req.admin_notes && (
                                <div className={`rounded-xl p-4 border ${
                                  req.status === 'approved'
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : req.status === 'rejected'
                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className={`w-4 h-4 ${
                                      req.status === 'approved'
                                        ? 'text-green-600 dark:text-green-400'
                                        : req.status === 'rejected'
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-zinc-600 dark:text-zinc-400'
                                    }`} />
                                    <h4 className={`text-xs font-semibold uppercase tracking-wider ${
                                      req.status === 'approved'
                                        ? 'text-green-700 dark:text-green-300'
                                        : req.status === 'rejected'
                                        ? 'text-red-700 dark:text-red-300'
                                        : 'text-zinc-600 dark:text-zinc-400'
                                    }`}>
                                      {t('Admin Response', 'رد المسؤول')}
                                    </h4>
                                  </div>
                                  <p className={`text-sm ${
                                    req.status === 'approved'
                                      ? 'text-green-800 dark:text-green-200'
                                      : req.status === 'rejected'
                                      ? 'text-red-800 dark:text-red-200'
                                      : 'text-zinc-700 dark:text-zinc-300'
                                  }`}>
                                    {req.admin_notes}
                                  </p>
                                </div>
                              )}

                              {/* Status Message */}
                              {req.status === 'approved' && (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                  <p className="text-sm font-medium">
                                    {t('This request has been approved and the changes have been applied.', 'تمت الموافقة على هذا الطلب وتم تطبيق التغييرات.')}
                                  </p>
                                </div>
                              )}
                              {req.status === 'rejected' && (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                  <XCircle className="w-5 h-5 flex-shrink-0" />
                                  <p className="text-sm font-medium">
                                    {t('This request has been rejected. Please review the admin response for more details.', 'تم رفض هذا الطلب. يرجى مراجعة رد المسؤول لمزيد من التفاصيل.')}
                                  </p>
                                </div>
                              )}
                              {req.status === 'pending' && (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                  <Clock className="w-5 h-5 flex-shrink-0" />
                                  <p className="text-sm font-medium">
                                    {t('This request is pending review by an administrator.', 'هذا الطلب قيد المراجعة من قبل المسؤول.')}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

