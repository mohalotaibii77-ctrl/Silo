'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Warehouse, Search, Package, Plus, 
  Truck, FileText, ArrowLeftRight, ClipboardList,
  Building2, Phone, Mail, MapPin, MoreHorizontal,
  Calendar, Hash, CheckCircle2, Clock, XCircle,
  ArrowRight, Edit2, Trash2, Eye, X, Loader2,
  AlertCircle, ChevronRight
} from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import {
  getVendors, createVendor, updateVendor, deleteVendor,
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, updatePurchaseOrderStatus, receivePurchaseOrder,
  getTransfers, createTransfer, startTransfer, completeTransfer,
  getInventoryCounts, createInventoryCount, completeInventoryCount,
  getPOTemplates, createPOTemplate, updatePOTemplate, deletePOTemplate,
  getPOActivity,
  type Vendor, type PurchaseOrder, type PurchaseOrderItem, type InventoryTransfer, type InventoryCount, type POTemplate, type POActivity
} from '@/lib/inventory-api';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { getItems, type Item } from '@/lib/items-api';

// Countries list for dropdown
const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF' },
  { name: 'Algeria', code: 'DZ' },
  { name: 'Bahrain', code: 'BH' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Canada', code: 'CA' },
  { name: 'China', code: 'CN' },
  { name: 'Egypt', code: 'EG' },
  { name: 'France', code: 'FR' },
  { name: 'Germany', code: 'DE' },
  { name: 'India', code: 'IN' },
  { name: 'Iraq', code: 'IQ' },
  { name: 'Japan', code: 'JP' },
  { name: 'Jordan', code: 'JO' },
  { name: 'Kuwait', code: 'KW' },
  { name: 'Lebanon', code: 'LB' },
  { name: 'Malaysia', code: 'MY' },
  { name: 'Morocco', code: 'MA' },
  { name: 'Oman', code: 'OM' },
  { name: 'Pakistan', code: 'PK' },
  { name: 'Qatar', code: 'QA' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'Singapore', code: 'SG' },
  { name: 'South Korea', code: 'KR' },
  { name: 'Spain', code: 'ES' },
  { name: 'Turkey', code: 'TR' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'United States', code: 'US' },
  { name: 'Yemen', code: 'YE' },
];

// Get default country from business localization settings
function getDefaultCountry(): string {
  if (typeof window !== 'undefined') {
    try {
      const storedBusiness = localStorage.getItem('setup_business');
      if (storedBusiness) {
        const business = JSON.parse(storedBusiness);
        return business.country || 'Saudi Arabia';
      }
    } catch {
      // ignore
    }
  }
  return 'Saudi Arabia';
}

// Get currency from business localization settings
function getBusinessCurrency(): string {
  if (typeof window !== 'undefined') {
    try {
      const storedBusiness = localStorage.getItem('setup_business');
      if (storedBusiness) {
        const business = JSON.parse(storedBusiness);
        return business.currency || 'SAR';
      }
    } catch {
      // ignore
    }
  }
  return 'SAR';
}

type TabType = 'vendors' | 'purchase-orders' | 'transfers' | 'counts';

const tabs: { key: TabType; label: string; labelAr: string; icon: React.ElementType }[] = [
  { key: 'vendors', label: 'Vendors', labelAr: 'الموردين', icon: Truck },
  { key: 'purchase-orders', label: 'Purchase Orders', labelAr: 'أوامر الشراء', icon: FileText },
  { key: 'transfers', label: 'Transfers', labelAr: 'التحويلات', icon: ArrowLeftRight },
  { key: 'counts', label: 'Inventory Counts', labelAr: 'جرد المخزون', icon: ClipboardList },
];

export default function InventoryPage() {
  const { t, isRTL } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('vendors');

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && tabs.some(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/inventory?tab=${tab}`);
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search inventory...', ar: 'البحث في المخزون...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Inventory', 'المخزون')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage vendors, orders, transfers, and stock counts', 'إدارة الموردين والطلبات والتحويلات وجرد المخزون')}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 overflow-x-auto pb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
                } ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {isRTL ? tab.labelAr : tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'vendors' && <VendorsTab />}
            {activeTab === 'purchase-orders' && <PurchaseOrdersTab />}
            {activeTab === 'transfers' && <TransfersTab />}
            {activeTab === 'counts' && <InventoryCountsTab />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </PageLayout>
  );
}

// ==================== VENDORS TAB ====================
function VendorsTab() {
  const { t, isRTL } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadVendors = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getVendors({ search: searchQuery || undefined });
      setVendors(data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleSaveVendor = async (data: any) => {
    try {
      setIsSaving(true);
      if (editingVendor) {
        await updateVendor(editingVendor.id, data);
      } else {
        await createVendor(data);
      }
      setShowModal(false);
      setEditingVendor(null);
      loadVendors();
    } catch (err) {
      console.error('Failed to save vendor:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVendor = async (id: number) => {
    if (!confirm(t('Are you sure you want to delete this vendor?', 'هل أنت متأكد من حذف هذا المورد؟'))) return;
    try {
      await deleteVendor(id);
      loadVendors();
    } catch (err) {
      console.error('Failed to delete vendor:', err);
    }
  };

  const filteredVendors = vendors.filter(v => 
    !searchQuery || 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative">
          <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search vendors...', 'البحث عن موردين...')}
            className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
          />
        </div>
        <button 
          onClick={() => { setEditingVendor(null); setShowModal(true); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <Plus className="w-4 h-4" />
          {t('Add Vendor', 'إضافة مورد')}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredVendors.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {searchQuery ? t('No vendors found', 'لم يتم العثور على موردين') : t('No vendors yet', 'لا يوجد موردين حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {searchQuery 
              ? t('Try a different search term', 'جرب مصطلح بحث مختلف')
              : t('Add your suppliers and vendors to track purchases and manage relationships.', 'أضف الموردين لتتبع المشتريات وإدارة العلاقات.')}
          </p>
          {!searchQuery && (
            <button 
              onClick={() => { setEditingVendor(null); setShowModal(true); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Plus className="w-4 h-4" />
              {t('Add Your First Vendor', 'أضف أول مورد')}
            </button>
          )}
        </div>
      )}

      {/* Vendors List */}
      {!isLoading && filteredVendors.length > 0 && (
        <div className="grid gap-4">
          {filteredVendors.map((vendor) => (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-zinc-500" />
                  </div>
                  <div className={isRTL ? 'text-right' : ''}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <h3 className="font-semibold text-zinc-900 dark:text-white">
                        {isRTL ? vendor.name_ar || vendor.name : vendor.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {vendor.code}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        vendor.status === 'active' 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                      }`}>
                        {vendor.status === 'active' ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                      </span>
                    </div>
                    <div className={`flex flex-wrap gap-4 mt-2 text-sm text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {vendor.contact_person && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <span>{vendor.contact_person}</span>
                        </span>
                      )}
                      {vendor.phone && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Phone className="w-3.5 h-3.5" />
                          <span dir="ltr">{vendor.phone}</span>
                        </span>
                      )}
                      {vendor.email && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Mail className="w-3.5 h-3.5" />
                          <span>{vendor.email}</span>
                        </span>
                      )}
                      {vendor.city && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{vendor.city}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => { setEditingVendor(vendor); setShowModal(true); }}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteVendor(vendor.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Vendor Modal */}
      <VendorModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingVendor(null); }}
        onSave={handleSaveVendor}
        vendor={editingVendor}
        isSaving={isSaving}
      />
    </div>
  );
}

// Vendor Modal Component
function VendorModal({ isOpen, onClose, onSave, vendor, isSaving }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  vendor: Vendor | null;
  isSaving: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const defaultCountry = getDefaultCountry();
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: defaultCountry,
    tax_number: '',
    payment_terms: 30,
    notes: '',
  });

  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        name_ar: vendor.name_ar || '',
        contact_person: vendor.contact_person || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        city: vendor.city || '',
        country: vendor.country || defaultCountry,
        tax_number: vendor.tax_number || '',
        payment_terms: vendor.payment_terms || 30,
        notes: vendor.notes || '',
      });
    } else {
      setFormData({
        name: '',
        name_ar: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: defaultCountry,
        tax_number: '',
        payment_terms: 30,
        notes: '',
      });
    }
  }, [vendor, isOpen, defaultCountry]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {vendor ? t('Edit Vendor', 'تعديل المورد') : t('Add Vendor', 'إضافة مورد')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Name (English)', 'الاسم (إنجليزي)')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Name (Arabic)', 'الاسم (عربي)')}
              </label>
              <input
                type="text"
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white text-right"
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
              {t('Contact Person', 'الشخص المسؤول')}
            </label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Email', 'البريد الإلكتروني')}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Phone', 'الهاتف')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
              {t('Address', 'العنوان')}
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('City', 'المدينة')}
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Country', 'الدولة')}
              </label>
              <select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('VAT Number', 'الرقم الضريبي')}
              </label>
              <input
                type="text"
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Payment Terms (days)', 'شروط الدفع (أيام)')}
              </label>
              <input
                type="number"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
              {t('Notes', 'ملاحظات')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !formData.name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {vendor ? t('Save Changes', 'حفظ التغييرات') : t('Add Vendor', 'إضافة المورد')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== PURCHASE ORDERS TAB ====================
interface POLineItem {
  item_id: number;
  item_name: string;
  item_name_ar?: string;
  storage_unit: string;
  quantity: number;
  total_price: number; // User enters total price, system calculates cost per unit
}

function PurchaseOrdersTab() {
  const { t, isRTL } = useLanguage();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [templates, setTemplates] = useState<POTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<POTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filters = [
    { key: 'all', label: t('All', 'الكل') },
    { key: 'templates', label: t('Templates', 'القوالب') },
    { key: 'pending', label: t('Pending', 'قيد الانتظار') },
    { key: 'received', label: t('Received', 'تم الاستلام') },
    { key: 'cancelled', label: t('Cancelled', 'ملغي') },
  ];

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      if (filter === 'templates') {
        const data = await getPOTemplates({ is_active: true });
        setTemplates(data);
        setOrders([]);
      } else {
        const data = await getPurchaseOrders({ status: filter !== 'all' ? filter : undefined });
        setOrders(data);
        setTemplates([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCreatePO = async (vendorId: number, items: POLineItem[], notes?: string) => {
    try {
      setIsSaving(true);
      await createPurchaseOrder({
        vendor_id: vendorId,
        items: items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: item.quantity > 0 ? item.total_price / item.quantity : 0, // Calculate cost per storage unit
        })),
        notes,
      });
      setShowModal(false);
      loadOrders();
    } catch (err) {
      console.error('Failed to create PO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTemplate = (template: POTemplate) => {
    setEditingTemplate(template);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm(t('Are you sure you want to delete this template?', 'هل أنت متأكد من حذف هذا القالب؟'))) return;
    try {
      await deletePOTemplate(templateId);
      loadOrders();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const handleSaveTemplate = async (data: {
    name: string;
    name_ar?: string;
    vendor_id: number;
    notes?: string;
    items: { item_id: number; quantity: number }[];
  }) => {
    try {
      setIsSaving(true);
      if (editingTemplate) {
        await updatePOTemplate(editingTemplate.id, {
          name: data.name,
          name_ar: data.name_ar,
          notes: data.notes,
          items: data.items,
        });
      } else {
        await createPOTemplate(data);
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
      loadOrders();
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
      case 'pending': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'approved': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'ordered': return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400';
      case 'partial': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
      case 'received': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'cancelled': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('Draft', 'مسودة');
      case 'pending': return t('Pending', 'قيد الانتظار');
      case 'approved': return t('Approved', 'موافق عليه');
      case 'ordered': return t('Ordered', 'تم الطلب');
      case 'partial': return t('Partial', 'جزئي');
      case 'received': return t('Received', 'تم الاستلام');
      case 'cancelled': return t('Cancelled', 'ملغي');
      default: return status;
    }
  };

  const handleOpenPODetail = async (order: PurchaseOrder) => {
    try {
      // Fetch full PO details including items
      const fullOrder = await getPurchaseOrder(order.id);
      setSelectedPO(fullOrder);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load PO details:', err);
    }
  };

  const handlePOUpdated = () => {
    loadOrders();
    setShowDetailModal(false);
    setSelectedPO(null);
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter === 'templates' ? (
          <button 
            onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('New Template', 'قالب جديد')}
          </button>
        ) : (
          <button 
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('New Purchase Order', 'طلب شراء جديد')}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State for Templates */}
      {!isLoading && filter === 'templates' && templates.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No templates yet', 'لا توجد قوالب حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Save frequent purchase orders as templates for quick reuse.', 'احفظ طلبات الشراء المتكررة كقوالب للاستخدام السريع.')}
          </p>
          <button 
            onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('Create First Template', 'أنشئ أول قالب')}
          </button>
        </div>
      )}

      {/* Empty State for Orders */}
      {!isLoading && filter !== 'templates' && orders.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No purchase orders yet', 'لا توجد أوامر شراء حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Create purchase orders to restock your inventory from vendors.', 'أنشئ أوامر شراء لإعادة تخزين المخزون من الموردين.')}
          </p>
          <button 
            onClick={() => setShowModal(true)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('Create First Purchase Order', 'أنشئ أول طلب شراء')}
          </button>
        </div>
      )}

      {/* Templates List */}
      {!isLoading && filter === 'templates' && templates.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Template Name', 'اسم القالب')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Vendor', 'المورد')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Items', 'الأصناف')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Created', 'تاريخ الإنشاء')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? (template.name_ar || template.name) : template.name}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? (template.vendor?.name_ar || template.vendor?.name) : template.vendor?.name || '-'}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {template.items?.length || 0} {t('items', 'صنف')}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(template.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button 
                        onClick={() => handleEditTemplate(template)}
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        title={t('Edit', 'تعديل')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title={t('Delete', 'حذف')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Orders List */}
      {!isLoading && filter !== 'templates' && orders.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Order #', 'رقم الطلب')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Vendor', 'المورد')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Date', 'التاريخ')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Total', 'الإجمالي')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Status', 'الحالة')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {orders.map((order) => (
                <tr 
                  key={order.id} 
                  onClick={() => handleOpenPODetail(order)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {order.order_number}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? (order.vendor?.name_ar || order.vendor?.name) : order.vendor?.name || '-'}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(order.order_date).toLocaleDateString()}
                  </td>
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {order.total_amount.toFixed(2)} {getBusinessCurrency()}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Modal */}
      <PurchaseOrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleCreatePO}
        isSaving={isSaving}
      />

      {/* Template Modal */}
      <TemplateEditModal
        isOpen={showTemplateModal}
        onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
        onSave={handleSaveTemplate}
        template={editingTemplate}
        isSaving={isSaving}
      />

      {/* PO Detail Modal */}
      <PODetailModal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedPO(null); }}
        order={selectedPO}
        onUpdate={handlePOUpdated}
        getStatusColor={getStatusColor}
        getStatusLabel={getStatusLabel}
      />
    </div>
  );
}

// Purchase Order Modal Component
function PurchaseOrderModal({ isOpen, onClose, onSave, isSaving }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vendorId: number, items: POLineItem[], notes?: string) => void;
  isSaving: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [templates, setTemplates] = useState<POTemplate[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Template states
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateNameAr, setTemplateNameAr] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Load vendors, items, and templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      // Reset form when modal closes
      setSelectedVendorId(null);
      setLineItems([]);
      setNotes('');
      setSearchQuery('');
      setSaveAsTemplate(false);
      setTemplateName('');
      setTemplateNameAr('');
      setSelectedTemplateId(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [vendorsData, itemsData, templatesData] = await Promise.all([
        getVendors(),
        getItems(),
        getPOTemplates({ is_active: true })
      ]);
      setVendors(vendorsData);
      setItems(itemsData);
      setTemplates(templatesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load template items when a template is selected
  const loadFromTemplate = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setSelectedVendorId(template.vendor_id);
    setSelectedTemplateId(templateId);
    setNotes(template.notes || '');

    // Convert template items to line items
    const newLineItems: POLineItem[] = (template.items || []).map(ti => {
      const itemData = ti.item;
      const unit = (itemData?.storage_unit && itemData.storage_unit.trim()) 
        ? itemData.storage_unit 
        : (itemData?.unit || 'unit');
      
      return {
        item_id: ti.item_id,
        item_name: itemData?.name || '',
        item_name_ar: itemData?.name_ar,
        storage_unit: unit,
        quantity: ti.quantity,
        total_price: 0, // User will enter prices
      };
    });
    
    setLineItems(newLineItems);
  };

  const addItem = (item: Item) => {
    // Check if item already added
    if (lineItems.some(li => li.item_id === item.id)) return;
    
    // Use storage unit if available, otherwise fall back to serving unit
    const unit = (item.storage_unit && item.storage_unit.trim()) ? item.storage_unit : (item.unit || 'unit');
    
    setLineItems([...lineItems, {
      item_id: item.id,
      item_name: item.name,
      item_name_ar: item.name_ar,
      storage_unit: unit,
      quantity: 1,
      total_price: 0, // User will enter total price
    }]);
    setSearchQuery('');
  };

  const updateLineItem = (index: number, field: 'quantity' | 'total_price', value: number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const total = lineItems.reduce((sum, item) => sum + item.total_price, 0);

  const filteredItems = searchQuery.trim() 
    ? items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.name_ar && item.name_ar.includes(searchQuery)) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleSubmit = async () => {
    if (!selectedVendorId || lineItems.length === 0) return;

    // Save as template if checkbox is checked
    if (saveAsTemplate && templateName.trim()) {
      setIsSavingTemplate(true);
      try {
        await createPOTemplate({
          vendor_id: selectedVendorId,
          name: templateName.trim(),
          name_ar: templateNameAr.trim() || undefined,
          notes: notes || undefined,
          items: lineItems.map(li => ({
            item_id: li.item_id,
            quantity: li.quantity,
          })),
        });
        console.log('Template saved successfully');
      } catch (err) {
        console.error('Failed to save template:', err);
      } finally {
        setIsSavingTemplate(false);
      }
    }

    onSave(selectedVendorId, lineItems, notes || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t('New Purchase Order', 'طلب شراء جديد')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
          ) : (
            <>
              {/* Load from Template */}
              {templates.length > 0 && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <SearchableSelect
                    label={t('Load from Saved Template', 'تحميل من قالب محفوظ')}
                    value={selectedTemplateId}
                    onChange={(id) => {
                      if (id) loadFromTemplate(id);
                      else {
                        setSelectedTemplateId(null);
                        setSelectedVendorId(null);
                        setLineItems([]);
                        setNotes('');
                      }
                    }}
                    options={templates.map(t => ({
                      id: t.id,
                      name: isRTL ? (t.name_ar || t.name) : t.name,
                      secondaryText: t.vendor ? (isRTL ? (t.vendor.name_ar || t.vendor.name) : t.vendor.name) : undefined
                    }))}
                    placeholder={t('Search templates...', 'ابحث عن القوالب...')}
                    className="w-full"
                  />
                </div>
              )}

              {/* Vendor Selection */}
              <div>
                {vendors.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className={`text-sm text-amber-700 dark:text-amber-400 ${isRTL ? 'text-right' : ''}`}>
                      {t('No vendors found. Please add a vendor first in the Vendors tab.', 'لم يتم العثور على موردين. يرجى إضافة مورد أولاً في تبويب الموردين.')}
                    </p>
                  </div>
                ) : (
                  <SearchableSelect
                    label={`${t('Select Vendor', 'اختر المورد')} *`}
                    value={selectedVendorId}
                    onChange={(id) => setSelectedVendorId(id ? Number(id) : null)}
                    options={vendors.map(v => ({
                      id: v.id,
                      name: isRTL ? (v.name_ar || v.name) : v.name,
                      secondaryText: v.contact_person || undefined
                    }))}
                    placeholder={t('Search vendors...', 'ابحث عن الموردين...')}
                  />
                )}
              </div>

              {/* Add Items */}
              <div>
                <SearchableSelect
                  label={`${t('Add Items', 'إضافة أصناف')} *`}
                  value={null}
                  onChange={(id) => {
                    const item = items.find(i => i.id === id);
                    if (item) addItem(item);
                  }}
                  options={items.map(item => ({
                    id: item.id,
                    name: isRTL ? (item.name_ar || item.name) : item.name,
                    secondaryText: `${item.sku ? `${item.sku} • ` : ''}${item.storage_unit || item.unit || 'unit'}`
                  }))}
                  placeholder={t('Search items by name or SKU...', 'ابحث عن الأصناف بالاسم أو الرمز...')}
                />
              </div>

              {/* Line Items Table */}
              {lineItems.length > 0 && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('Item', 'الصنف')}
                        </th>
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center`}>
                          {t('Qty', 'الكمية')}
                        </th>
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center`}>
                          {t('Total Price', 'السعر الإجمالي')}
                        </th>
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center`}>
                          {t('Cost/Unit', 'التكلفة/وحدة')}
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {lineItems.map((item, index) => {
                        const costPerUnit = item.quantity > 0 ? item.total_price / item.quantity : 0;
                        return (
                          <tr key={item.item_id}>
                            <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                {isRTL ? (item.item_name_ar || item.item_name) : item.item_name}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.storage_unit || 'unit'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) => updateLineItem(index, 'quantity', Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                                  className="w-20 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-center focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                                />
                                <span className="text-xs text-zinc-500">{item.storage_unit || 'unit'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.total_price}
                                onChange={(e) => updateLineItem(index, 'total_price', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-28 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-center focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                                placeholder="0.00"
                              />
                            </td>
                            <td className={`px-4 py-3 text-center`}>
                              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                {costPerUnit.toFixed(3)} <span className="text-xs">/{item.storage_unit || 'unit'}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => removeLineItem(index)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
                        <td colSpan={2} className={`px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white ${isRTL ? 'text-left' : 'text-right'}`}>
                          {t('Total', 'الإجمالي')}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white text-center`}>
                          {total.toFixed(2)} {getBusinessCurrency()}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {t('Notes (Optional)', 'ملاحظات (اختياري)')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t('Any special instructions or notes...', 'أي تعليمات أو ملاحظات خاصة...')}
                  className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                />
              </div>

              {/* Save as Template */}
              {lineItems.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {t('Save as frequent PO template for later use', 'حفظ كقالب طلب شراء متكرر للاستخدام لاحقاً')}
                    </span>
                  </label>

                  {saveAsTemplate && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1 ${isRTL ? 'text-right' : ''}`}>
                          {t('Template Name (English)', 'اسم القالب (إنجليزي)')} *
                        </label>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder={t('e.g., Weekly Vegetables', 'مثال: خضروات أسبوعية')}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-700 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none text-zinc-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1 ${isRTL ? 'text-right' : ''}`}>
                          {t('Template Name (Arabic)', 'اسم القالب (عربي)')}
                        </label>
                        <input
                          type="text"
                          value={templateNameAr}
                          onChange={(e) => setTemplateNameAr(e.target.value)}
                          placeholder={t('Optional', 'اختياري')}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-700 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none text-zinc-900 dark:text-white text-right"
                          dir="rtl"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || isSavingTemplate || !selectedVendorId || lineItems.length === 0 || (saveAsTemplate && !templateName.trim())}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(isSaving || isSavingTemplate) && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveAsTemplate 
              ? t('Create PO & Save Template', 'إنشاء الطلب وحفظ القالب')
              : t('Create Purchase Order', 'إنشاء طلب الشراء')
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== TEMPLATE EDIT MODAL ====================
interface TemplateLineItem {
  item_id: number;
  item_name: string;
  item_name_ar?: string;
  storage_unit: string;
  quantity: number;
}

function TemplateEditModal({ isOpen, onClose, onSave, template, isSaving }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    name_ar?: string;
    vendor_id: number;
    notes?: string;
    items: { item_id: number; quantity: number }[];
  }) => void;
  template: POTemplate | null;
  isSaving: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<TemplateLineItem[]>([]);

  // Load vendors and items
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Load template data when editing
  useEffect(() => {
    if (template && isOpen) {
      setName(template.name);
      setNameAr(template.name_ar || '');
      setSelectedVendorId(template.vendor_id);
      setNotes(template.notes || '');
      
      const templateLineItems: TemplateLineItem[] = (template.items || []).map(ti => {
        const itemData = ti.item;
        const unit = (itemData?.storage_unit && itemData.storage_unit.trim()) 
          ? itemData.storage_unit 
          : (itemData?.unit || 'unit');
        
        return {
          item_id: ti.item_id,
          item_name: itemData?.name || '',
          item_name_ar: itemData?.name_ar,
          storage_unit: unit,
          quantity: ti.quantity,
        };
      });
      setLineItems(templateLineItems);
    } else if (isOpen && !template) {
      // Reset form for new template
      setName('');
      setNameAr('');
      setSelectedVendorId(null);
      setNotes('');
      setLineItems([]);
    }
  }, [template, isOpen]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [vendorsData, itemsData] = await Promise.all([
        getVendors(),
        getItems(),
      ]);
      setVendors(vendorsData);
      setItems(itemsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const addItem = (item: Item) => {
    if (lineItems.some(li => li.item_id === item.id)) return;
    
    const unit = (item.storage_unit && item.storage_unit.trim()) ? item.storage_unit : (item.unit || 'unit');
    
    setLineItems([...lineItems, {
      item_id: item.id,
      item_name: item.name,
      item_name_ar: item.name_ar,
      storage_unit: unit,
      quantity: 1,
    }]);
  };

  const updateLineItem = (index: number, quantity: number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], quantity };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim() || !selectedVendorId || lineItems.length === 0) return;
    
    onSave({
      name: name.trim(),
      name_ar: nameAr.trim() || undefined,
      vendor_id: selectedVendorId,
      notes: notes.trim() || undefined,
      items: lineItems.map(li => ({
        item_id: li.item_id,
        quantity: li.quantity,
      })),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {template ? t('Edit Template', 'تعديل القالب') : t('New Template', 'قالب جديد')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
          ) : (
            <>
              {/* Template Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Template Name (English)', 'اسم القالب (إنجليزي)')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('e.g., Weekly Vegetables', 'مثال: خضروات أسبوعية')}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Template Name (Arabic)', 'اسم القالب (عربي)')}
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder={t('Optional', 'اختياري')}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Vendor Selection */}
              <div>
                <SearchableSelect
                  label={`${t('Select Vendor', 'اختر المورد')} *`}
                  value={selectedVendorId}
                  onChange={(id) => setSelectedVendorId(id ? Number(id) : null)}
                  options={vendors.map(v => ({
                    id: v.id,
                    name: isRTL ? (v.name_ar || v.name) : v.name,
                    secondaryText: v.contact_person || undefined
                  }))}
                  placeholder={t('Search vendors...', 'ابحث عن الموردين...')}
                />
              </div>

              {/* Add Items */}
              <div>
                <SearchableSelect
                  label={`${t('Add Items', 'إضافة أصناف')} *`}
                  value={null}
                  onChange={(id) => {
                    const item = items.find(i => i.id === id);
                    if (item) addItem(item);
                  }}
                  options={items.map(item => ({
                    id: item.id,
                    name: isRTL ? (item.name_ar || item.name) : item.name,
                    secondaryText: `${item.sku ? `${item.sku} • ` : ''}${item.storage_unit || item.unit || 'unit'}`
                  }))}
                  placeholder={t('Search items by name or SKU...', 'ابحث عن الأصناف بالاسم أو الرمز...')}
                />
              </div>

              {/* Line Items Table */}
              {lineItems.length > 0 && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('Item', 'الصنف')}
                        </th>
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center`}>
                          {t('Qty', 'الكمية')}
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {lineItems.map((item, index) => (
                        <tr key={item.item_id}>
                          <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              {isRTL ? (item.item_name_ar || item.item_name) : item.item_name}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.storage_unit || 'unit'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(index, Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                                className="w-20 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-center focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                              />
                              <span className="text-xs text-zinc-500">{item.storage_unit || 'unit'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => removeLineItem(index)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {t('Notes (Optional)', 'ملاحظات (اختياري)')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t('Any notes about this template...', 'أي ملاحظات حول هذا القالب...')}
                  className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !name.trim() || !selectedVendorId || lineItems.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {template ? t('Save Changes', 'حفظ التغييرات') : t('Create Template', 'إنشاء القالب')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== PO DETAIL MODAL ====================
function PODetailModal({ isOpen, onClose, order, onUpdate, getStatusColor, getStatusLabel }: {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onUpdate: () => void;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
}) {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activity, setActivity] = useState<POActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  // Edit state
  const [editNotes, setEditNotes] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');

  useEffect(() => {
    if (order && isOpen) {
      setEditNotes(order.notes || '');
      setEditExpectedDate(order.expected_date || '');
      setIsEditing(false);
      setActiveTab('details');
      loadActivity();
    }
  }, [order, isOpen]);

  const loadActivity = async () => {
    if (!order) return;
    setIsLoadingActivity(true);
    try {
      const data = await getPOActivity(order.id);
      setActivity(data);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleSave = async () => {
    if (!order) return;
    setIsSaving(true);
    try {
      await updatePurchaseOrder(order.id, {
        notes: editNotes,
        expected_date: editExpectedDate || undefined,
      });
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      console.error('Failed to update PO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    setIsSaving(true);
    try {
      await updatePurchaseOrderStatus(order.id, 'cancelled', cancelNote || undefined);
      setShowCancelConfirm(false);
      setCancelNote('');
      onUpdate();
    } catch (err) {
      console.error('Failed to cancel PO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return t('Order Created', 'تم إنشاء الطلب');
      case 'status_changed': return t('Status Changed', 'تم تغيير الحالة');
      case 'items_updated': return t('Items Updated', 'تم تحديث الأصناف');
      case 'notes_updated': return t('Notes Updated', 'تم تحديث الملاحظات');
      case 'cancelled': return t('Order Cancelled', 'تم إلغاء الطلب');
      case 'received': return t('Order Received', 'تم استلام الطلب');
      default: return action;
    }
  };

  const canEdit = order && ['pending', 'draft'].includes(order.status);
  const canCancel = order && !['received', 'cancelled'].includes(order.status);

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <FileText className="w-6 h-6 text-zinc-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {order.order_number}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {isRTL ? (order.vendor?.name_ar || order.vendor?.name) : order.vendor?.name}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 px-6 pt-4 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'details'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t('Details', 'التفاصيل')}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'activity'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t('Activity History', 'سجل النشاط')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Order Date', 'تاريخ الطلب')}</p>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {new Date(order.order_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Expected Date', 'التاريخ المتوقع')}</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editExpectedDate}
                      onChange={(e) => setEditExpectedDate(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-sm"
                    />
                  ) : (
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {order.expected_date ? new Date(order.expected_date).toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>
                {order.tax_amount > 0 && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Subtotal', 'المجموع الفرعي')}</p>
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {order.subtotal.toFixed(2)} {getBusinessCurrency()}
                    </p>
                  </div>
                )}
                {order.tax_amount > 0 && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('VAT', 'الضريبة')}</p>
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {order.tax_amount.toFixed(2)} {getBusinessCurrency()}
                    </p>
                  </div>
                )}
                <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Total', 'الإجمالي')}</p>
                  <p className="font-bold text-zinc-900 dark:text-white text-lg">
                    {order.total_amount.toFixed(2)} {getBusinessCurrency()}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              {order.items && order.items.length > 0 && (
                <div>
                  <h3 className={`text-sm font-semibold text-zinc-900 dark:text-white mb-3 ${isRTL ? 'text-right' : ''}`}>
                    {t('Order Items', 'أصناف الطلب')} ({order.items.length})
                  </h3>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                          <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('Item', 'الصنف')}
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                            {t('Qty', 'الكمية')}
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                            {t('Received', 'المستلم')}
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                            {t('Unit Cost', 'سعر الوحدة')}
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                            {t('Total', 'الإجمالي')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                {isRTL ? (item.item?.name_ar || item.item?.name) : item.item?.name}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {item.item?.sku} • {item.item?.storage_unit || item.item?.unit}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-sm ${
                                item.received_quantity >= item.quantity 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : item.received_quantity > 0 
                                    ? 'text-amber-600 dark:text-amber-400' 
                                    : 'text-zinc-600 dark:text-zinc-400'
                              }`}>
                                {item.received_quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                              {item.unit_cost.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-zinc-900 dark:text-white">
                              {item.total_cost.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className={`text-sm font-semibold text-zinc-900 dark:text-white mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {t('Notes', 'ملاحظات')}
                </h3>
                {isEditing ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                  />
                ) : (
                  <p className={`text-sm text-zinc-600 dark:text-zinc-400 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 ${isRTL ? 'text-right' : ''}`}>
                    {order.notes || t('No notes', 'لا توجد ملاحظات')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Activity Tab
            <div className="space-y-4">
              {isLoadingActivity ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {t('No activity recorded yet', 'لم يتم تسجيل أي نشاط بعد')}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700`} />
                  
                  {activity.map((item, index) => (
                    <div key={item.id} className={`relative flex gap-4 pb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.action === 'created' ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                        item.action === 'cancelled' ? 'bg-red-100 dark:bg-red-900/50' :
                        item.action === 'received' ? 'bg-blue-100 dark:bg-blue-900/50' :
                        'bg-zinc-100 dark:bg-zinc-800'
                      }`}>
                        {item.action === 'created' ? (
                          <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : item.action === 'cancelled' ? (
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        ) : item.action === 'received' ? (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className={`flex-1 pb-4 ${isRTL ? 'text-right' : ''}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">
                            {getActionLabel(item.action)}
                          </p>
                          {item.old_status && item.new_status && (
                            <span className={`flex items-center gap-1 text-xs text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <span className={`px-1.5 py-0.5 rounded ${getStatusColor(item.old_status)}`}>
                                {getStatusLabel(item.old_status)}
                              </span>
                              <ArrowRight className="w-3 h-3" />
                              <span className={`px-1.5 py-0.5 rounded ${getStatusColor(item.new_status)}`}>
                                {getStatusLabel(item.new_status)}
                              </span>
                            </span>
                          )}
                        </div>
                        
                        {item.notes && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {item.notes}
                          </p>
                        )}
                        
                        {item.changes && (
                          <div className="mt-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                            {item.changes.items_count !== undefined && (
                              <p>{t('Items', 'الأصناف')}: {item.changes.items_count}</p>
                            )}
                            {item.changes.total_amount !== undefined && (
                              <p>{t('Total', 'الإجمالي')}: {item.changes.total_amount.toFixed(2)} {getBusinessCurrency()}</p>
                            )}
                          </div>
                        )}
                        
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                          {item.user ? `${item.user.first_name || item.user.username} • ` : ''}
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2">
            {canCancel && !isEditing && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {t('Cancel Order', 'إلغاء الطلب')}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('Save Changes', 'حفظ التغييرات')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('Close', 'إغلاق')}
                </button>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <Edit2 className="w-4 h-4" />
                    {t('Edit', 'تعديل')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Cancel Confirmation Modal */}
        <AnimatePresence>
          {showCancelConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6"
              >
                <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {t('Cancel Purchase Order?', 'إلغاء أمر الشراء؟')}
                  </h3>
                </div>
                
                <p className={`text-sm text-zinc-600 dark:text-zinc-400 mb-4 ${isRTL ? 'text-right' : ''}`}>
                  {t('This action cannot be undone. The order will be marked as cancelled.', 'لا يمكن التراجع عن هذا الإجراء. سيتم تحديد الطلب كملغي.')}
                </p>
                
                <div className="mb-4">
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                    {t('Reason (optional)', 'السبب (اختياري)')}
                  </label>
                  <textarea
                    value={cancelNote}
                    onChange={(e) => setCancelNote(e.target.value)}
                    rows={2}
                    placeholder={t('Enter cancellation reason...', 'أدخل سبب الإلغاء...')}
                    className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                  />
                </div>
                
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => { setShowCancelConfirm(false); setCancelNote(''); }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {t('Keep Order', 'الإبقاء على الطلب')}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('Cancel Order', 'إلغاء الطلب')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ==================== TRANSFERS TAB ====================
function TransfersTab() {
  const { t, isRTL } = useLanguage();
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const filters = [
    { key: 'all', label: t('All', 'الكل') },
    { key: 'draft', label: t('Draft', 'مسودة') },
    { key: 'pending', label: t('Pending', 'قيد الانتظار') },
    { key: 'in_transit', label: t('In Transit', 'في الطريق') },
    { key: 'completed', label: t('Completed', 'مكتمل') },
  ];

  const loadTransfers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getTransfers({ status: filter !== 'all' ? filter : undefined });
      setTransfers(data);
    } catch (err) {
      console.error('Failed to load transfers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Plus className="w-4 h-4" />
          {t('New Transfer', 'تحويل جديد')}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && transfers.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <ArrowLeftRight className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No transfers yet', 'لا توجد تحويلات حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Transfer inventory between branches or storage locations.', 'حوّل المخزون بين الفروع أو مواقع التخزين.')}
          </p>
          <button className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Plus className="w-4 h-4" />
            {t('Create First Transfer', 'أنشئ أول تحويل')}
          </button>
        </div>
      )}

      {/* Transfers List */}
      {!isLoading && transfers.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Transfer #', 'رقم التحويل')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('From', 'من')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('To', 'إلى')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Date', 'التاريخ')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Status', 'الحالة')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {transfer.transfer_number}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {transfer.from_branch?.name || '-'}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {transfer.to_branch?.name || '-'}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(transfer.transfer_date).toLocaleDateString()}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400`}>
                      {transfer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== INVENTORY COUNTS TAB ====================
function InventoryCountsTab() {
  const { t, isRTL } = useLanguage();
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const filters = [
    { key: 'all', label: t('All', 'الكل') },
    { key: 'draft', label: t('Draft', 'مسودة') },
    { key: 'in_progress', label: t('In Progress', 'قيد التنفيذ') },
    { key: 'completed', label: t('Completed', 'مكتمل') },
    { key: 'cancelled', label: t('Cancelled', 'ملغي') },
  ];

  const loadCounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getInventoryCounts({ status: filter !== 'all' ? filter : undefined });
      setCounts(data);
    } catch (err) {
      console.error('Failed to load counts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Plus className="w-4 h-4" />
          {t('Start Count', 'بدء الجرد')}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && counts.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No inventory counts yet', 'لا توجد عمليات جرد حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Perform regular inventory counts to ensure accurate stock levels.', 'قم بإجراء جرد دوري للمخزون لضمان دقة مستويات المخزون.')}
          </p>
          <button className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Plus className="w-4 h-4" />
            {t('Start First Count', 'ابدأ أول جرد')}
          </button>
        </div>
      )}

      {/* Counts List */}
      {!isLoading && counts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Count #', 'رقم الجرد')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Type', 'النوع')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Branch', 'الفرع')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Date', 'التاريخ')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Status', 'الحالة')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {counts.map((count) => (
                <tr key={count.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {count.count_number}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {count.count_type}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {count.branch?.name || t('All', 'الكل')}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(count.count_date).toLocaleDateString()}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400`}>
                      {count.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
