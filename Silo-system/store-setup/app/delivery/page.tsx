'use client';

import { useState, useEffect } from 'react';
import { Truck, Plus, Edit2, Trash2, Phone, Mail, MapPin, Clock, Percent, Coins, CheckCircle, XCircle, X, User, Building2, Store } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import api from '@/lib/api';
import { 
  getDeliveryPartners, 
  createDeliveryPartner, 
  updateDeliveryPartner, 
  deleteDeliveryPartner, 
  type DeliveryPartner,
  type CreateDeliveryPartnerData
} from '@/lib/delivery-api';

interface Branch {
  id: number;
  name: string;
  name_ar?: string;
  is_main?: boolean;
}

export default function DeliveryPage() {
  const { t, isRTL, formatCurrency } = useLanguage();
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Branches state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [branchId, setBranchId] = useState<number | null>(null);
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [commissionValue, setCommissionValue] = useState('');
  const [minimumOrder, setMinimumOrder] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (currentBranch) {
      loadPartners();
    }
  }, [currentBranch]);

  const loadBranches = async () => {
    try {
      const storedBusiness = localStorage.getItem('setup_business');
      const storedBranch = localStorage.getItem('setup_branch');
      
      if (storedBusiness) {
        const business = JSON.parse(storedBusiness);
        if (business.id) {
          const response = await api.get(`/businesses/${business.id}/branches`);
          if (response.data.branches && response.data.branches.length > 0) {
            setBranches(response.data.branches);
            
            // Set current branch from stored or use main/first
            if (storedBranch) {
              setCurrentBranch(JSON.parse(storedBranch));
            } else {
              const mainBranch = response.data.branches.find((b: Branch) => b.is_main) || response.data.branches[0];
              setCurrentBranch(mainBranch);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const loadPartners = async () => {
    try {
      setIsLoading(true);
      const data = await getDeliveryPartners({ branchId: currentBranch?.id });
      setPartners(data);
    } catch (err) {
      console.error('Failed to load delivery partners:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (partner?: DeliveryPartner) => {
    if (partner) {
      setEditingPartner(partner);
      setName(partner.name);
      setNameAr(partner.name_ar || '');
      setBranchId(partner.branch_id || currentBranch?.id || null);
      setContactPerson(partner.contact_person || '');
      setEmail(partner.email || '');
      setPhone(partner.phone || '');
      setAddress(partner.address || '');
      setCity(partner.city || '');
      setCountry(partner.country || '');
      setCommissionType(partner.commission_type);
      setCommissionValue(partner.commission_value.toString());
      setMinimumOrder(partner.minimum_order?.toString() || '');
      setDeliveryFee(partner.delivery_fee?.toString() || '');
      setEstimatedTime(partner.estimated_time?.toString() || '');
      setServiceAreas(partner.service_areas || '');
      setNotes(partner.notes || '');
    } else {
      setEditingPartner(null);
      setName('');
      setNameAr('');
      setBranchId(currentBranch?.id || null);
      setContactPerson('');
      setEmail('');
      setPhone('');
      setAddress('');
      setCity('');
      setCountry('');
      setCommissionType('percentage');
      setCommissionValue('');
      setMinimumOrder('');
      setDeliveryFee('');
      setEstimatedTime('');
      setServiceAreas('');
      setNotes('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPartner(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('Partner name is required', 'اسم شريك التوصيل مطلوب'));
      return;
    }
    if (!branchId) {
      setError(t('Branch is required', 'الفرع مطلوب'));
      return;
    }
    if (!commissionValue || parseFloat(commissionValue) < 0) {
      setError(t('Valid commission value is required', 'قيمة عمولة صحيحة مطلوبة'));
      return;
    }
    if (commissionType === 'percentage' && parseFloat(commissionValue) > 100) {
      setError(t('Percentage cannot exceed 100%', 'النسبة المئوية لا يمكن أن تتجاوز 100%'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingPartner) {
        await updateDeliveryPartner(editingPartner.id, {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          contact_person: contactPerson.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          commission_type: commissionType,
          commission_value: parseFloat(commissionValue),
          minimum_order: minimumOrder ? parseFloat(minimumOrder) : undefined,
          delivery_fee: deliveryFee ? parseFloat(deliveryFee) : undefined,
          estimated_time: estimatedTime ? parseInt(estimatedTime) : undefined,
          service_areas: serviceAreas.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        const data: CreateDeliveryPartnerData = {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          branch_id: branchId,
          contact_person: contactPerson.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          commission_type: commissionType,
          commission_value: parseFloat(commissionValue),
          minimum_order: minimumOrder ? parseFloat(minimumOrder) : undefined,
          delivery_fee: deliveryFee ? parseFloat(deliveryFee) : undefined,
          estimated_time: estimatedTime ? parseInt(estimatedTime) : undefined,
          service_areas: serviceAreas.trim() || undefined,
          notes: notes.trim() || undefined,
        };
        await createDeliveryPartner(data);
      }
      handleCloseModal();
      loadPartners();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save delivery partner', 'فشل في حفظ شريك التوصيل'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (partner: DeliveryPartner) => {
    try {
      await updateDeliveryPartner(partner.id, { 
        status: partner.status === 'active' ? 'inactive' : 'active' 
      });
      loadPartners();
    } catch (err) {
      console.error('Failed to toggle partner status:', err);
    }
  };

  const handleDelete = async (partner: DeliveryPartner) => {
    if (!confirm(t('Are you sure you want to delete this delivery partner?', 'هل أنت متأكد من حذف شريك التوصيل هذا؟'))) {
      return;
    }
    try {
      await deleteDeliveryPartner(partner.id);
      loadPartners();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to delete delivery partner', 'فشل في حذف شريك التوصيل'));
    }
  };

  // Filter and search partners
  const filteredPartners = partners.filter(p => {
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && p.status === 'active') || 
      (filter === 'inactive' && p.status === 'inactive');
    
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery);
    
    return matchesFilter && matchesSearch;
  });

  return (
    <PageLayout searchPlaceholder={{ en: 'Search delivery partners...', ar: 'البحث في شركاء التوصيل...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Delivery Partners', 'شركاء التوصيل')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage delivery service providers for your business', 'إدارة مزودي خدمة التوصيل لعملك')}
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add Partner', 'إضافة شريك')}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: t('All', 'الكل'), count: partners.length },
            { key: 'active', label: t('Active', 'نشط'), count: partners.filter(p => p.status === 'active').length },
            { key: 'inactive', label: t('Inactive', 'غير نشط'), count: partners.filter(p => p.status === 'inactive').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <Truck className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No delivery partners yet', 'لا يوجد شركاء توصيل بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Add delivery service providers you work with', 'أضف مزودي خدمة التوصيل الذين تعمل معهم')}
            </p>
            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add Partner', 'إضافة شريك')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPartners.map((partner) => (
              <motion.div
                key={partner.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${
                  partner.status === 'inactive' ? 'opacity-60' : ''
                }`}
              >
                <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-start gap-3 flex-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      partner.status === 'active' 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      <Truck className={`w-6 h-6 ${
                        partner.status === 'active'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-400'
                      }`} />
                    </div>
                    <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <h3 className="font-bold text-zinc-900 dark:text-white truncate">
                          {isRTL ? (partner.name_ar || partner.name) : partner.name}
                        </h3>
                        {partner.status === 'inactive' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex-shrink-0">
                            {t('Inactive', 'غير نشط')}
                          </span>
                        )}
                      </div>
                      
                      {partner.branch && (
                        <p className={`text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Store className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{isRTL && partner.branch.name_ar ? partner.branch.name_ar : partner.branch.name}</span>
                        </p>
                      )}
                      
                      {partner.contact_person && (
                        <p className={`text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <User className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{partner.contact_person}</span>
                        </p>
                      )}
                      
                      {partner.phone && (
                        <p className={`text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          <span dir="ltr">{partner.phone}</span>
                        </p>
                      )}
                      
                      <div className={`flex flex-wrap items-center gap-3 mt-3 text-xs text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className={`flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {partner.commission_type === 'percentage' ? (
                            <Percent className="w-3 h-3" />
                          ) : (
                            <Coins className="w-3 h-3" />
                          )}
                          {partner.commission_type === 'percentage' 
                            ? `${partner.commission_value}%`
                            : formatCurrency(partner.commission_value)
                          }
                        </span>
                        
                        {partner.estimated_time && (
                          <span className={`flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Clock className="w-3 h-3" />
                            {partner.estimated_time} {t('min', 'د')}
                          </span>
                        )}
                        
                        {partner.delivery_fee !== null && partner.delivery_fee !== undefined && (
                          <span className={`flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Coins className="w-3 h-3" />
                            {formatCurrency(partner.delivery_fee)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className={`flex items-center justify-end gap-1 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => handleToggleActive(partner)}
                    className={`p-2 rounded-lg transition-colors ${
                      partner.status === 'active'
                        ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                    title={partner.status === 'active' ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل')}
                  >
                    {partner.status === 'active' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleOpenModal(partner)}
                    className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(partner)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && handleCloseModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingPartner ? t('Edit Delivery Partner', 'تعديل شريك التوصيل') : t('Add Delivery Partner', 'إضافة شريك توصيل')}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Partner Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Partner Name', 'اسم الشريك')} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('e.g., Talabat, Deliveroo', 'مثال: طلبات، ديليفرو')}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Arabic Name', 'الاسم بالعربي')}
                    </label>
                    <input
                      type="text"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="طلبات"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* Branch Selection - Required */}
                <SearchableSelect
                  label={`${t('Branch', 'الفرع')} *`}
                  value={branchId}
                  onChange={(val) => setBranchId(val ? Number(val) : null)}
                  options={branches.map(b => ({
                    id: b.id,
                    name: isRTL && b.name_ar ? b.name_ar : b.name,
                  }))}
                  placeholder={t('Select branch', 'اختر الفرع')}
                  disabled={!!editingPartner}
                />

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Contact Person', 'الشخص المسؤول')}
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder={t('John Doe', 'محمد أحمد')}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Phone', 'الهاتف')}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+965 1234 5678"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Email', 'البريد الإلكتروني')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    dir="ltr"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Address', 'العنوان')}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('Street address', 'عنوان الشارع')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* City & Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('City', 'المدينة')}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t('Kuwait City', 'مدينة الكويت')}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Country', 'الدولة')}
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder={t('Kuwait', 'الكويت')}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                {/* Commission */}
                <div className="grid grid-cols-2 gap-4">
                  <SearchableSelect
                    label={`${t('Commission Type', 'نوع العمولة')} *`}
                    value={commissionType}
                    onChange={(val) => setCommissionType((val || 'percentage') as 'percentage' | 'fixed')}
                    options={[
                      { id: 'percentage', name: t('Percentage (%)', 'نسبة مئوية (%)') },
                      { id: 'fixed', name: t('Fixed Amount', 'مبلغ ثابت') },
                    ]}
                    placeholder={t('Select type', 'اختر النوع')}
                  />
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Commission Value', 'قيمة العمولة')} *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={commissionValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setCommissionValue(val);
                        }
                      }}
                      placeholder={commissionType === 'percentage' ? '15' : '2.000'}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                {/* Delivery Details */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Min Order', 'الحد الأدنى للطلب')}
                    </label>
                    <input
                      type="number"
                      value={minimumOrder}
                      onChange={(e) => setMinimumOrder(e.target.value)}
                      placeholder="5.000"
                      step="0.001"
                      min="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Delivery Fee', 'رسوم التوصيل')}
                    </label>
                    <input
                      type="number"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      placeholder="1.000"
                      step="0.001"
                      min="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Est. Time (min)', 'الوقت المتوقع (د)')}
                    </label>
                    <input
                      type="number"
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      placeholder="30"
                      min="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                {/* Service Areas */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Service Areas', 'مناطق الخدمة')}
                  </label>
                  <textarea
                    value={serviceAreas}
                    onChange={(e) => setServiceAreas(e.target.value)}
                    placeholder={t('Enter areas separated by commas...', 'أدخل المناطق مفصولة بفواصل...')}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Notes', 'ملاحظات')}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('Additional notes...', 'ملاحظات إضافية...')}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting 
                    ? t('Saving...', 'جاري الحفظ...') 
                    : editingPartner 
                      ? t('Update', 'تحديث')
                      : t('Create', 'إنشاء')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}



