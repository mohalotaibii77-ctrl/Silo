'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Upload, 
  Loader2, 
  Save, 
  Image as ImageIcon,
  Languages,
  FileText,
  Settings2,
  X,
  Check
} from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

interface ReceiptSettings {
  id?: number;
  business_id: number;
  receipt_logo_url: string | null;
  print_languages: string[];
  main_language: string;
  receipt_header: string;
  receipt_footer: string;
  show_order_number: boolean;
  show_subtotal: boolean;
  show_closer_username: boolean;
  show_creator_username: boolean;
}

const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', nameAr: 'الإنجليزية' },
  { code: 'ar', name: 'Arabic', nameAr: 'العربية' },
];

export default function PrintersDevicesPage() {
  const router = useRouter();
  const { isRTL, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState<'logo' | 'languages' | 'content' | 'options'>('logo');
  
  const [settings, setSettings] = useState<ReceiptSettings>({
    business_id: 0,
    receipt_logo_url: null,
    print_languages: ['en'],
    main_language: 'en',
    receipt_header: '',
    receipt_footer: '',
    show_order_number: true,
    show_subtotal: true,
    show_closer_username: false,
    show_creator_username: false,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/business-settings/receipt');
      if (response.data.success && response.data.data) {
        setSettings(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch receipt settings:', err);
      setMessage({ 
        type: 'error', 
        text: t('Failed to load settings', 'فشل في تحميل الإعدادات') 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;

    setUploadingLogo(true);
    setMessage({ type: '', text: '' });

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(logoFile);
      });

      const response = await api.post('/business-settings/receipt/logo', {
        file_data: base64Data,
        file_name: logoFile.name,
      });

      if (response.data.success) {
        setSettings(prev => ({ ...prev, receipt_logo_url: base64Data }));
        setLogoFile(null);
        setLogoPreview(null);
        setMessage({ 
          type: 'success', 
          text: t('Logo uploaded successfully', 'تم رفع الشعار بنجاح') 
        });
      }
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error || t('Failed to upload logo', 'فشل في رفع الشعار') 
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setSaving(true);
    try {
      await api.put('/business-settings/receipt', {
        receipt_logo_url: null,
      });
      setSettings(prev => ({ ...prev, receipt_logo_url: null }));
      setMessage({ 
        type: 'success', 
        text: t('Logo removed', 'تم إزالة الشعار') 
      });
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: t('Failed to remove logo', 'فشل في إزالة الشعار') 
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleLanguage = (langCode: string) => {
    setSettings(prev => {
      const languages = prev.print_languages.includes(langCode)
        ? prev.print_languages.filter(l => l !== langCode)
        : [...prev.print_languages, langCode];
      
      // Ensure at least one language is selected
      if (languages.length === 0) return prev;
      
      // If main language was removed, set it to first available
      let mainLang = prev.main_language;
      if (!languages.includes(mainLang)) {
        mainLang = languages[0];
      }
      
      return { ...prev, print_languages: languages, main_language: mainLang };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.put('/business-settings/receipt', {
        print_languages: settings.print_languages,
        main_language: settings.main_language,
        receipt_header: settings.receipt_header,
        receipt_footer: settings.receipt_footer,
        show_order_number: settings.show_order_number,
        show_subtotal: settings.show_subtotal,
        show_closer_username: settings.show_closer_username,
        show_creator_username: settings.show_creator_username,
      });

      if (response.data.success) {
        setMessage({ 
          type: 'success', 
          text: t('Settings saved successfully', 'تم حفظ الإعدادات بنجاح') 
        });
      }
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error || t('Failed to save settings', 'فشل في حفظ الإعدادات') 
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'logo', label: t('Receipt Logo', 'شعار الإيصال'), icon: ImageIcon },
    { id: 'languages', label: t('Languages', 'اللغات'), icon: Languages },
    { id: 'content', label: t('Header & Footer', 'الرأس والتذييل'), icon: FileText },
    { id: 'options', label: t('Display Options', 'خيارات العرض'), icon: Settings2 },
  ];

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/settings')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
          >
            <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Printers & Devices', 'الطابعات والأجهزة')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Configure receipt printing settings', 'إعداد إعدادات طباعة الإيصال')}
            </p>
          </div>
        </div>

        {/* Message Alert */}
        <AnimatePresence>
          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-xl flex items-center justify-between ${
                message.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}
            >
              <span>{message.text}</span>
              <button onClick={() => setMessage({ type: '', text: '' })}>
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Logo Tab */}
          {activeTab === 'logo' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-6"
            >
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                  {t('Receipt Logo', 'شعار الإيصال')}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('Select an image to upload the logo that is printed on the receipt.', 'اختر صورة لرفع الشعار الذي يُطبع على الإيصال.')}
                </p>
              </div>

              <div className="flex items-start gap-6">
                {/* Current/Preview Logo */}
                <div className="w-32 h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-zinc-300 dark:border-zinc-700">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                  ) : settings.receipt_logo_url ? (
                    <img src={settings.receipt_logo_url} alt="Receipt logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-zinc-400" />
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      {t('Select Image', 'اختر صورة')}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoSelect} 
                      />
                    </label>
                    
                    {settings.receipt_logo_url && !logoFile && (
                      <button
                        onClick={handleRemoveLogo}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        {t('Remove', 'إزالة')}
                      </button>
                    )}
                  </div>

                  {logoFile && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400 flex-1 truncate">
                        {logoFile.name}
                      </span>
                      <button
                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {t('Upload', 'رفع')}
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('Recommended: Square image, PNG or JPG format, max 1MB', 'موصى به: صورة مربعة، بصيغة PNG أو JPG، بحد أقصى 1 ميجابايت')}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Languages Tab */}
          {activeTab === 'languages' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Print Languages */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                    {t('Print Languages', 'لغات الطباعة')}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('Select one or multiple languages for the receipt printer.', 'اختر لغة واحدة أو عدة لغات لطابعة الإيصال.')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {AVAILABLE_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                        settings.print_languages.includes(lang.code)
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {settings.print_languages.includes(lang.code) && (
                        <Check className="w-4 h-4" />
                      )}
                      {isRTL ? lang.nameAr : lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Language */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                    {t('Main Language', 'اللغة الرئيسية')}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('Select the main language to be used when the receipt is printed.', 'اختر اللغة الرئيسية المستخدمة عند طباعة الإيصال.')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {AVAILABLE_LANGUAGES.filter(l => settings.print_languages.includes(l.code)).map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setSettings(prev => ({ ...prev, main_language: lang.code }))}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                        settings.main_language === lang.code
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {settings.main_language === lang.code && (
                        <Check className="w-4 h-4" />
                      )}
                      {isRTL ? lang.nameAr : lang.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Header & Footer Tab */}
          {activeTab === 'content' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Receipt Header */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                    {t('Receipt Header', 'رأس الإيصال')}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('Enter text here to show at the header of the receipt.', 'أدخل النص هنا لعرضه في رأس الإيصال.')}
                  </p>
                </div>

                <textarea
                  value={settings.receipt_header}
                  onChange={(e) => setSettings(prev => ({ ...prev, receipt_header: e.target.value }))}
                  placeholder={t('e.g., Welcome to our restaurant!', 'مثال: مرحباً بكم في مطعمنا!')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-zinc-500/20 outline-none resize-none"
                />
              </div>

              {/* Receipt Footer */}
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                    {t('Receipt Footer', 'تذييل الإيصال')}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('Enter text here to show at the footer of the receipt.', 'أدخل النص هنا لعرضه في تذييل الإيصال.')}
                  </p>
                </div>

                <textarea
                  value={settings.receipt_footer}
                  onChange={(e) => setSettings(prev => ({ ...prev, receipt_footer: e.target.value }))}
                  placeholder={t('e.g., Thank you for your visit! See you again soon.', 'مثال: شكراً لزيارتكم! نراكم قريباً.')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-zinc-500/20 outline-none resize-none"
                />
              </div>
            </motion.div>
          )}

          {/* Display Options Tab */}
          {activeTab === 'options' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1"
            >
              <div className="mb-4">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                  {t('Display Options', 'خيارات العرض')}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('Configure what information appears on the receipt.', 'إعداد المعلومات التي تظهر على الإيصال.')}
                </p>
              </div>

              {/* Toggle Options */}
              {[
                { 
                  key: 'show_order_number', 
                  label: t('Show Order Number', 'إظهار رقم الطلب'),
                  desc: t('Display the order number on the receipt', 'عرض رقم الطلب على الإيصال')
                },
                { 
                  key: 'show_subtotal', 
                  label: t('Show Subtotal', 'إظهار المجموع الفرعي'),
                  desc: t('Display the subtotal (before taxes) with the final price', 'عرض المجموع الفرعي (قبل الضرائب) مع السعر النهائي')
                },
                { 
                  key: 'show_creator_username', 
                  label: t('Show Creator Username', 'إظهار اسم منشئ الطلب'),
                  desc: t('Display the username of who created the order', 'عرض اسم المستخدم الذي أنشأ الطلب')
                },
                { 
                  key: 'show_closer_username', 
                  label: t('Show Closer Username', 'إظهار اسم مغلق الطلب'),
                  desc: t('Display the username of who closed/completed the order', 'عرض اسم المستخدم الذي أغلق/أكمل الطلب')
                },
              ].map((option) => (
                <div 
                  key={option.key}
                  className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {option.label}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {option.desc}
                    </p>
                  </div>
                  <button
                    onClick={() => setSettings(prev => ({ 
                      ...prev, 
                      [option.key]: !prev[option.key as keyof ReceiptSettings] 
                    }))}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      settings[option.key as keyof ReceiptSettings]
                        ? 'bg-emerald-500'
                        : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        settings[option.key as keyof ReceiptSettings]
                          ? isRTL ? 'left-1' : 'right-1'
                          : isRTL ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Save Button */}
        {(activeTab === 'languages' || activeTab === 'content' || activeTab === 'options') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end"
          >
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('Save Settings', 'حفظ الإعدادات')}
            </button>
          </motion.div>
        )}

        {/* Receipt Preview (optional visual) */}
        <div className="p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
            {t('Receipt Preview', 'معاينة الإيصال')}
          </h3>
          
          {/* Helper to show bilingual text based on selected languages */}
          {(() => {
            const isBilingual = settings.print_languages.includes('en') && settings.print_languages.includes('ar');
            const isMainArabic = settings.main_language === 'ar';
            
            // Bilingual text helper - shows both languages when both selected
            const biText = (en: string, ar: string) => {
              if (isBilingual) {
                return isMainArabic ? `${ar} / ${en}` : `${en} / ${ar}`;
              }
              return settings.print_languages.includes('ar') ? ar : en;
            };

            // Bilingual item - for receipt items with name in both languages
            const biItem = (enName: string, arName: string) => {
              if (isBilingual) {
                return isMainArabic ? (
                  <div className="text-right">
                    <div>{arName}</div>
                    <div className="text-gray-400 text-[10px]">{enName}</div>
                  </div>
                ) : (
                  <div>
                    <div>{enName}</div>
                    <div className="text-gray-400 text-[10px]">{arName}</div>
                  </div>
                );
              }
              return settings.print_languages.includes('ar') ? arName : enName;
            };

            return (
              <div className={`bg-white rounded-xl p-6 max-w-xs mx-auto shadow-lg font-mono text-sm ${isMainArabic && isBilingual ? 'text-right' : ''}`} dir={isMainArabic ? 'rtl' : 'ltr'}>
                {/* Logo */}
                {settings.receipt_logo_url && (
                  <div className="flex justify-center mb-4">
                    <img 
                      src={settings.receipt_logo_url} 
                      alt="Receipt Logo" 
                      className="h-16 w-auto object-contain"
                    />
                  </div>
                )}
                
                {/* Header */}
                {settings.receipt_header && (
                  <div className="text-center text-gray-600 mb-4 whitespace-pre-line text-xs">
                    {settings.receipt_header}
                  </div>
                )}
                
                <div className="border-t border-dashed border-gray-300 my-3"></div>
                
                {/* Order Info */}
                {settings.show_order_number && (
                  <div className="text-center font-bold mb-2">
                    {biText('Order #42', 'طلب #42')}
                  </div>
                )}
                
                <div className="text-xs text-gray-500 text-center mb-3">
                  {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                
                <div className="border-t border-dashed border-gray-300 my-3"></div>
                
                {/* Sample Items */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <span>{biItem('2x Burger', '2x برجر')}</span>
                    <span className="flex-shrink-0">12.00</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span>{biItem('1x Fries', '1x بطاطس')}</span>
                    <span className="flex-shrink-0">3.50</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span>{biItem('2x Soda', '2x مشروب غازي')}</span>
                    <span className="flex-shrink-0">4.00</span>
                  </div>
                </div>
                
                <div className="border-t border-dashed border-gray-300 my-3"></div>
                
                {/* Totals */}
                <div className="space-y-1 text-xs">
                  {settings.show_subtotal && (
                    <div className="flex justify-between text-gray-600">
                      <span>{biText('Subtotal', 'المجموع الفرعي')}</span>
                      <span>19.50</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>{biText('Tax (15%)', 'الضريبة (15%)')}</span>
                    <span>2.93</span>
                  </div>
                  <div className="flex justify-between font-bold text-base mt-2">
                    <span>{biText('Total', 'الإجمالي')}</span>
                    <span>22.43</span>
                  </div>
                </div>
                
                <div className="border-t border-dashed border-gray-300 my-3"></div>
                
                {/* Staff Info */}
                <div className="text-xs text-gray-500 text-center space-y-1">
                  {settings.show_creator_username && (
                    <div>{biText('Created by: John', 'أنشأه: جون')}</div>
                  )}
                  {settings.show_closer_username && (
                    <div>{biText('Closed by: Sarah', 'أغلقه: سارة')}</div>
                  )}
                </div>
                
                <div className="border-t border-dashed border-gray-300 my-3"></div>
                
                {/* QR Code - Order Number for scanning */}
                <div className="flex flex-col items-center gap-2 py-2">
                  <svg 
                    width="120" 
                    height="120" 
                    viewBox="0 0 29 29"
                    className="border-2 border-gray-300 rounded p-1 bg-white"
                  >
                    {/* Simple QR code pattern representation */}
                    <rect width="29" height="29" fill="white"/>
                    <path d="M0,0 h7 v7 h-7z M0,22 h7 v7 h-7z M22,0 h7 v7 h-7z" fill="black"/>
                    <path d="M2,2 h3 v3 h-3z M2,24 h3 v3 h-3z M24,2 h3 v3 h-3z" fill="white"/>
                    <path d="M8,0 h2 v2 h-2z M12,0 h2 v2 h-2z M16,0 h2 v2 h-2z" fill="black"/>
                    <path d="M8,4 h2 v2 h-2z M12,4 h2 v2 h-2z M16,4 h2 v2 h-2z" fill="black"/>
                    <path d="M0,8 h2 v2 h-2z M4,8 h2 v2 h-2z M8,8 h14 v2 h-14z M27,8 h2 v2 h-2z" fill="black"/>
                    <path d="M0,12 h2 v2 h-2z M8,12 h6 v2 h-6z M16,12 h6 v2 h-6z M27,12 h2 v2 h-2z" fill="black"/>
                    <path d="M0,16 h2 v2 h-2z M4,16 h2 v2 h-2z M12,16 h2 v2 h-2z M16,16 h6 v2 h-6z M27,16 h2 v2 h-2z" fill="black"/>
                    <path d="M8,20 h6 v2 h-6z M16,20 h2 v2 h-2z M22,20 h7 v2 h-7z" fill="black"/>
                    <path d="M8,24 h2 v2 h-2z M12,24 h2 v2 h-2z M16,24 h2 v2 h-2z M22,24 h7 v2 h-7z" fill="black"/>
                    <path d="M8,27 h2 v2 h-2z M12,27 h2 v2 h-2z M16,27 h6 v2 h-6z" fill="black"/>
                  </svg>
                  <span className="text-[10px] text-gray-400">
                    {biText('Scan to complete order', 'امسح لإكمال الطلب')}
                  </span>
                </div>
                
                {/* Footer */}
                {settings.receipt_footer && (
                  <>
                    <div className="border-t border-dashed border-gray-300 my-3"></div>
                    <div className="text-center text-gray-600 whitespace-pre-line text-xs">
                      {settings.receipt_footer}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </motion.div>
    </PageLayout>
  );
}

