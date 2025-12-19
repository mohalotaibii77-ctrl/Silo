'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Store, LogOut, User, Command, ArrowLeft, Upload, Send, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

interface Business {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string | null;
  certificate_url?: string | null;
}

interface ChangeRequest {
  id: number;
  request_type: string;
  status: 'pending' | 'approved' | 'rejected';
  new_name?: string;
  new_email?: string;
  new_phone?: string;
  new_address?: string;
  admin_notes?: string;
  created_at: string;
}

export default function StoreProfilePage() {
  const router = useRouter();
  const { isRTL, t } = useLanguage();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'logo' | 'certificate'>('info');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');

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
      // Fetch fresh business data from server
      fetchBusinessData();
    } catch {
      router.push('/login');
      return;
    }

    fetchRequests();
  }, [router]);

  const fetchBusinessData = async () => {
    try {
      const response = await api.get('/business-settings');
      const biz = response.data.data;
      if (biz) {
        setBusiness(biz);
        setFormData({
          name: biz.name || '',
          email: biz.email || '',
          phone: biz.phone || '',
          address: biz.address || '',
        });
        // Update localStorage with fresh data
        localStorage.setItem('setup_business', JSON.stringify(biz));
      }
    } catch (err) {
      console.error('Failed to fetch business data:', err);
      // Fallback to localStorage if server fails
      const storedBusiness = localStorage.getItem('setup_business');
      if (storedBusiness) {
        const biz = JSON.parse(storedBusiness);
        setBusiness(biz);
        setFormData({
          name: biz.name || '',
          email: biz.email || '',
          phone: biz.phone || '',
          address: biz.address || '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmitProfileChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post('/business-settings/change-requests', {
        request_type: 'profile',
        new_name: formData.name !== business?.name ? formData.name : undefined,
        new_email: formData.email !== business?.email ? formData.email : undefined,
        new_phone: formData.phone !== business?.phone ? formData.phone : undefined,
        new_address: formData.address !== business?.address ? formData.address : undefined,
      });
      setMessage({ type: 'success', text: t('Change request submitted! Waiting for admin approval.', 'تم إرسال طلب التغيير! في انتظار موافقة المسؤول.') });
      fetchRequests();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('Failed to submit request', 'فشل في إرسال الطلب') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (type: 'logo' | 'certificate') => {
    const file = type === 'logo' ? logoFile : certificateFile;
    if (!file) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await api.post('/business-settings/upload-request', {
        request_type: type,
        file_data: base64Data,
        file_name: file.name,
      });

      const successMsg = type === 'logo' 
        ? t('Logo upload request submitted!', 'تم إرسال طلب رفع الشعار!')
        : t('Certificate upload request submitted!', 'تم إرسال طلب رفع الشهادة!');
      setMessage({ type: 'success', text: successMsg });
      if (type === 'logo') setLogoFile(null);
      else setCertificateFile(null);
      fetchRequests();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('Failed to upload', 'فشل في الرفع') });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'rejected': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default: return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    }
  };

  const tabs = [
    { id: 'info', label: t('Business Info', 'معلومات العمل') },
    { id: 'logo', label: t('Logo', 'الشعار') },
    { id: 'certificate', label: t('Certificate', 'الشهادة') },
  ];

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
            <button
              onClick={() => router.push('/settings')}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <h1 className="font-semibold text-zinc-900 dark:text-white">{t('Store Profile', 'ملف المتجر')}</h1>
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
            className="max-w-3xl mx-auto space-y-6"
          >
            {message.text && (
              <div className={`p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                {message.text}
              </div>
            )}

            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <p className="text-sm text-zinc-700 dark:text-zinc-400">
                {t('Changes to your store profile require admin approval. Submit a request and we\'ll review it shortly.', 'تتطلب التغييرات على ملف متجرك موافقة المسؤول. أرسل طلبًا وسنراجعه قريبًا.')}
              </p>
            </div>

            <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'info' && (
              <form onSubmit={handleSubmitProfileChange} className="space-y-5">
                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t('Business Name', 'اسم العمل')}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t('Email', 'البريد الإلكتروني')}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t('Phone', 'الهاتف')}</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t('Address', 'العنوان')}</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t('Submit Change Request', 'إرسال طلب التغيير')}
                </button>
              </form>
            )}

            {activeTab === 'logo' && (
              <div className="space-y-5">
                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-start gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                      {business?.logo_url ? (
                        <img src={business.logo_url} alt="Current logo" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-10 h-10 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-zinc-900 dark:text-white mb-1">{t('Current Logo', 'الشعار الحالي')}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                        {business?.logo_url ? t('Logo is set', 'الشعار محدد') : t('No logo uploaded yet', 'لم يتم رفع شعار بعد')}
                      </p>
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                        <Upload className="w-4 h-4" />
                        {t('Select New Logo', 'اختيار شعار جديد')}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </div>

                  {logoFile && (
                    <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{logoFile.name}</span>
                      <button
                        onClick={() => handleFileUpload('logo')}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {t('Submit for Approval', 'إرسال للموافقة')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'certificate' && (
              <div className="space-y-5">
                <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-medium text-zinc-900 dark:text-white mb-1">{t('Business Certificate', 'شهادة العمل')}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {t('Upload your business registration certificate or trade license.', 'قم برفع شهادة تسجيل العمل أو الرخصة التجارية.')}
                  </p>
                  
                  {business?.certificate_url && (
                    <div className="mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
                      {t('Certificate on file', 'الشهادة موجودة')} ✓
                    </div>
                  )}

                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    {t('Select Certificate', 'اختيار الشهادة')}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setCertificateFile(e.target.files?.[0] || null)} />
                  </label>

                  {certificateFile && (
                    <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{certificateFile.name}</span>
                      <button
                        onClick={() => handleFileUpload('certificate')}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {t('Submit for Approval', 'إرسال للموافقة')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {requests.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-zinc-900 dark:text-white">{t('Your Requests', 'طلباتك')}</h3>
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(req.status)}
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white capitalize">
                            {req.request_type} {t('Change', 'تغيير')}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                        {req.status === 'pending' ? t('Pending', 'قيد الانتظار') : req.status === 'approved' ? t('Approved', 'موافق عليه') : t('Rejected', 'مرفوض')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
