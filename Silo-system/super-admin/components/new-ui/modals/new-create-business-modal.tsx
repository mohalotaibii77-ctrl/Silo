'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Building2, Mail, Phone, MapPin, Tag, Upload, FileText, 
  UserPlus, Users, Trash2, Copy, Check, Eye, EyeOff, ShieldCheck,
  Sparkles, ArrowRight, ChevronRight, Crown, Plus, Store, Minus
} from 'lucide-react';
import { businessApi, UserCredentials } from '@/lib/api';
import type { CreateBusinessInput, BusinessUser } from '@/types';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface NewCreateBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_PASSWORD = '90074007';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", damping: 25, stiffness: 300 }
  },
  exit: { opacity: 0, scale: 0.95, y: 20 }
};

export function NewCreateBusinessModal({ isOpen, onClose, onSuccess }: NewCreateBusinessModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<UserCredentials[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Subscription, 3: Users
  
  const [formData, setFormData] = useState<CreateBusinessInput>({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    business_type: 'restaurant',
    country: '', // Required - no default
    currency: '', // Required - no default
    timezone: '', // Required - no default
    language: 'en',
    logo_url: '',
    certificate_url: '',
    subscription_tier: 'basic',
    max_users: 5,
    max_products: 100,
    branch_count: 1,
    users: [],
  });

  const [newUser, setNewUser] = useState<Partial<BusinessUser>>({
    username: '',
    role: 'employee',
    first_name: '',
    last_name: '',
  });

  const handleAddUser = () => {
    if (!newUser.username) {
      setError('Username is required');
      return;
    }

    if (formData.users?.some(u => u.username === newUser.username)) {
      setError('Username already exists');
      return;
    }

    if ((formData.users?.length || 0) >= formData.max_users!) {
      setError(`Maximum ${formData.max_users} users allowed`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      users: [...(prev.users || []), {
        username: newUser.username!,
        role: newUser.role as 'owner' | 'manager' | 'employee' | 'pos',
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        password: DEFAULT_PASSWORD,
      }],
    }));

    setNewUser({ username: '', role: 'employee', first_name: '', last_name: '' });
    setError('');
  };

  const handleRemoveUser = (index: number) => {
    setFormData(prev => ({
      ...prev,
      users: prev.users?.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    setError('');
    
    // Validate required fields
    if (!formData.name) {
      setError('Business name is required');
      return;
    }
    if (!formData.country) {
      setError('Country is required');
      return;
    }
    if (!formData.currency) {
      setError('Currency is required');
      return;
    }
    if (!formData.timezone) {
      setError('Timezone is required');
      return;
    }
    if (!formData.users || formData.users.length === 0) {
      setError('At least one owner account is required');
      return;
    }
    
    setLoading(true);

    try {
      let logoUrl = formData.logo_url;
      let certificateUrl = formData.certificate_url;
      
      // Convert logo file to base64
      if (logoFile) {
        const reader = new FileReader();
        logoUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoFile);
        });
      }

      // Convert certificate file to base64
      if (certificateFile) {
        const reader = new FileReader();
        certificateUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(certificateFile);
        });
      }

      const dataToSend = { ...formData, logo_url: logoUrl, certificate_url: certificateUrl };
      const response = await businessApi.create(dataToSend);
      
      if (response.userCredentials && response.userCredentials.length > 0) {
        setCreatedCredentials(response.userCredentials);
        setShowCredentials(true);
      } else {
        handleClose();
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '', slug: '', email: '', phone: '', address: '',
      business_type: 'restaurant', country: '', currency: '', timezone: '', language: 'en',
      logo_url: '', certificate_url: '',
      subscription_tier: 'basic', max_users: 5, max_products: 100, branch_count: 1, users: [],
    });
    setLogoFile(null);
    setLogoPreview(null);
    setCertificateFile(null);
    setShowCredentials(false);
    setCreatedCredentials([]);
    setError('');
    setStep(1);
    onClose();
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({ ...prev, name, slug: generateSlug(name) }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }
      setLogoFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setError('Only image or PDF files are allowed');
        return;
      }
      setCertificateFile(file);
      setError('');
    }
  };

  const copyCredentials = (index: number) => {
    const cred = createdCredentials[index];
    const text = `Username: ${cred.username}\nPassword: ${cred.password}\nRole: ${cred.role}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCredentials = () => {
    const text = createdCredentials.map(cred => 
      `Username: ${cred.username}\nPassword: ${cred.password}\nRole: ${cred.role}`
    ).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm"
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
            >
              {showCredentials ? (
                 // Credentials View
                 <div className="p-8 flex flex-col h-full">
                   <div className="text-center mb-8">
                     <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-full flex items-center justify-center mx-auto mb-4">
                       <ShieldCheck className="w-8 h-8" />
                     </div>
                     <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Business Created!</h2>
                     <p className="text-zinc-500 mt-2">Here are the initial login credentials.</p>
                   </div>

                   <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
                     <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium flex items-center gap-2">
                       <Sparkles className="w-4 h-4" />
                       Save these now. Passwords cannot be recovered later.
                     </p>
                   </div>

                   <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-6 custom-scrollbar">
                     {createdCredentials.map((cred, index) => (
                       <div key={index} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 group hover:border-zinc-400 transition-colors">
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                             {cred.role}
                           </span>
                           <button onClick={() => copyCredentials(index)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                             {copiedIndex === index ? <Check className="w-4 h-4 text-zinc-500" /> : <Copy className="w-4 h-4" />}
                           </button>
                         </div>
                         <div className="grid grid-cols-2 gap-4 text-sm">
                           <div>
                             <span className="text-zinc-500 text-xs block mb-1">Username</span>
                             <code className="font-mono text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 block w-full">
                               {cred.username}
                             </code>
                           </div>
                           <div>
                             <span className="text-zinc-500 text-xs block mb-1">Password</span>
                             <div className="relative">
                               <code className="font-mono text-zinc-900 dark:text-zinc-200 bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 block w-full">
                                 {showPassword ? cred.password : '••••••••'}
                               </code>
                               <button 
                                 onClick={() => setShowPassword(!showPassword)}
                                 className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                               >
                                 {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                               </button>
                             </div>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                     <button
                       onClick={copyAllCredentials}
                       className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                     >
                       {copiedIndex === -1 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                       Copy All
                     </button>
                     <button
                       onClick={() => { handleClose(); onSuccess(); }}
                       className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-black dark:hover:bg-zinc-200 transition-colors shadow-lg shadow-zinc-500/10"
                     >
                       Done
                     </button>
                   </div>
                 </div>
              ) : (
                // Create Form View
                <>
                  <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                    <div>
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create Business</h2>
                      <p className="text-sm text-zinc-500">Step {step} of 3: {step === 1 ? 'Basic Info' : step === 2 ? 'Subscription' : 'Users'}</p>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <X className="w-5 h-5 text-zinc-500" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
                      >
                        <X className="w-4 h-4" /> {error}
                      </motion.div>
                    )}

                    {step === 1 && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Business Name</label>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                              <input 
                                value={formData.name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none transition-all"
                                placeholder="e.g. The Burger Joint"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Slug (URL)</label>
                            <div className="relative">
                              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                              <input 
                                value={formData.slug}
                                onChange={(e) => setFormData({...formData, slug: e.target.value})}
                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none transition-all font-mono text-sm text-zinc-600 dark:text-zinc-400"
                                placeholder="auto-generated"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <SearchableSelect
                            label="Business Type"
                            options={[
                              { id: 'restaurant', name: 'Restaurant' },
                              { id: 'cafe', name: 'Cafe' },
                              { id: 'retail', name: 'Retail' },
                              { id: 'service', name: 'Service' },
                            ]}
                            value={formData.business_type || 'restaurant'}
                            onChange={(value) => setFormData({...formData, business_type: value})}
                            placeholder="Select type"
                          />
                          <div className="space-y-2">
                             <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone</label>
                             <div className="relative">
                               <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                               <input 
                                 value={formData.phone}
                                 onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                 className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none transition-all"
                                 placeholder="+1 (555) 000-0000"
                               />
                             </div>
                          </div>
                        </div>

                        {/* Country & Currency - REQUIRED */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <SearchableSelect
                            label="Country *"
                            options={[
                              { id: 'Kuwait', name: 'Kuwait' },
                              { id: 'Saudi Arabia', name: 'Saudi Arabia' },
                              { id: 'United Arab Emirates', name: 'United Arab Emirates' },
                              { id: 'Qatar', name: 'Qatar' },
                              { id: 'Bahrain', name: 'Bahrain' },
                              { id: 'Oman', name: 'Oman' },
                              { id: 'Egypt', name: 'Egypt' },
                              { id: 'Jordan', name: 'Jordan' },
                              { id: 'Lebanon', name: 'Lebanon' },
                              { id: 'United States', name: 'United States' },
                              { id: 'United Kingdom', name: 'United Kingdom' },
                              { id: 'Canada', name: 'Canada' },
                              { id: 'Australia', name: 'Australia' },
                            ]}
                            value={formData.country || ''}
                            onChange={(value) => setFormData({...formData, country: value})}
                            placeholder="Select country"
                          />
                          <SearchableSelect
                            label="Currency *"
                            options={[
                              { id: 'KWD', name: 'KWD - Kuwaiti Dinar' },
                              { id: 'SAR', name: 'SAR - Saudi Riyal' },
                              { id: 'AED', name: 'AED - UAE Dirham' },
                              { id: 'QAR', name: 'QAR - Qatari Riyal' },
                              { id: 'BHD', name: 'BHD - Bahraini Dinar' },
                              { id: 'OMR', name: 'OMR - Omani Rial' },
                              { id: 'EGP', name: 'EGP - Egyptian Pound' },
                              { id: 'JOD', name: 'JOD - Jordanian Dinar' },
                              { id: 'LBP', name: 'LBP - Lebanese Pound' },
                              { id: 'USD', name: 'USD - US Dollar' },
                              { id: 'EUR', name: 'EUR - Euro' },
                              { id: 'GBP', name: 'GBP - British Pound' },
                            ]}
                            value={formData.currency || ''}
                            onChange={(value) => setFormData({...formData, currency: value})}
                            placeholder="Select currency"
                          />
                        </div>

                        {/* Timezone & Language */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <SearchableSelect
                            label="Timezone *"
                            options={[
                              { id: 'Asia/Kuwait', name: 'Kuwait (GMT+3)' },
                              { id: 'Asia/Riyadh', name: 'Saudi Arabia (GMT+3)' },
                              { id: 'Asia/Dubai', name: 'UAE (GMT+4)' },
                              { id: 'Asia/Qatar', name: 'Qatar (GMT+3)' },
                              { id: 'Asia/Bahrain', name: 'Bahrain (GMT+3)' },
                              { id: 'Asia/Muscat', name: 'Oman (GMT+4)' },
                              { id: 'Africa/Cairo', name: 'Egypt (GMT+2)' },
                              { id: 'Asia/Amman', name: 'Jordan (GMT+2)' },
                              { id: 'Asia/Beirut', name: 'Lebanon (GMT+2)' },
                              { id: 'America/New_York', name: 'New York (GMT-5)' },
                              { id: 'America/Los_Angeles', name: 'Los Angeles (GMT-8)' },
                              { id: 'Europe/London', name: 'London (GMT+0)' },
                              { id: 'Australia/Sydney', name: 'Sydney (GMT+10)' },
                            ]}
                            value={formData.timezone || ''}
                            onChange={(value) => setFormData({...formData, timezone: value})}
                            placeholder="Select timezone"
                          />
                          <SearchableSelect
                            label="Language"
                            options={[
                              { id: 'en', name: 'English' },
                              { id: 'ar', name: 'العربية (Arabic)' },
                            ]}
                            value={formData.language || 'en'}
                            onChange={(value) => setFormData({...formData, language: value})}
                            placeholder="Select language"
                          />
                        </div>

                        {/* Logo Upload */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Business Logo (Optional)</label>
                          <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                              {logoPreview ? (
                                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="w-8 h-8 text-zinc-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all">
                                <div className="flex items-center gap-2">
                                  <Upload className="w-5 h-5 text-zinc-400" />
                                  <span className="text-sm text-zinc-500">
                                    {logoFile ? logoFile.name : 'Upload logo'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">PNG, JPG up to 5MB</p>
                                <input type="file" className="hidden" onChange={handleLogoChange} accept="image/*" />
                              </label>
                            </div>
                            {logoFile && (
                              <button 
                                onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                                className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                           <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
                           <div className="relative">
                             <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                             <input 
                               value={formData.email}
                               onChange={(e) => setFormData({...formData, email: e.target.value})}
                               className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none transition-all"
                               placeholder="business@example.com"
                             />
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Address</label>
                           <div className="relative">
                             <MapPin className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                             <textarea 
                               value={formData.address}
                               onChange={(e) => setFormData({...formData, address: e.target.value})}
                               className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none transition-all min-h-[80px] resize-none"
                               placeholder="123 Main St, City, Country"
                             />
                           </div>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {['basic', 'pro', 'enterprise'].map((tier) => (
                            <div 
                              key={tier}
                              onClick={() => setFormData({...formData, subscription_tier: tier as any})}
                              className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                                formData.subscription_tier === tier 
                                ? 'border-zinc-500 bg-zinc-100 dark:bg-zinc-800' 
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                              }`}
                            >
                              <div className="capitalize font-semibold text-zinc-900 dark:text-white mb-1">{tier}</div>
                              <div className="text-xs text-zinc-500">
                                {tier === 'basic' ? 'For small businesses' : tier === 'pro' ? 'For growing teams' : 'For large scale ops'}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Max Users</label>
                             <input 
                               type="text"
                               inputMode="numeric"
                               value={formData.max_users || ''}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 if (val === '' || /^\d+$/.test(val)) {
                                   setFormData({...formData, max_users: val === '' ? 0 : parseInt(val)});
                                 }
                               }}
                               placeholder="0"
                               className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none transition-all"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Max Products</label>
                             <input 
                               type="text"
                               inputMode="numeric"
                               value={formData.max_products || ''}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 if (val === '' || /^\d+$/.test(val)) {
                                   setFormData({...formData, max_products: val === '' ? 0 : parseInt(val)});
                                 }
                               }}
                               placeholder="0"
                               className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none transition-all"
                             />
                          </div>
                        </div>

                        {/* Number of Branches */}
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            <Store className="w-4 h-4" />
                            Number of Branches
                          </label>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
                              <button
                                type="button"
                                onClick={() => setFormData({...formData, branch_count: Math.max(1, (formData.branch_count || 1) - 1)})}
                                className="px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={(formData.branch_count || 1) <= 1}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="px-6 py-2.5 text-lg font-semibold text-zinc-900 dark:text-white min-w-[60px] text-center border-x border-zinc-200 dark:border-zinc-700">
                                {formData.branch_count || 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFormData({...formData, branch_count: (formData.branch_count || 1) + 1})}
                                className="px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-sm text-zinc-500">
                              {(formData.branch_count || 1) === 1 
                                ? 'Single location business' 
                                : `${formData.branch_count} branches will be created`}
                            </p>
                          </div>
                          <p className="text-xs text-zinc-400">
                            Branches share products & recipes but have separate orders, employees, and inventory tracking.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Business Certificate (Optional)</label>
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all">
                             <div className="flex flex-col items-center justify-center pt-5 pb-6">
                               <Upload className="w-8 h-8 text-zinc-400 mb-2" />
                               <p className="text-sm text-zinc-500">
                                 <span className="font-semibold">Click to upload</span> or drag and drop
                               </p>
                               <p className="text-xs text-zinc-400 mt-1">{certificateFile ? certificateFile.name : 'SVG, PNG, JPG (MAX. 5MB)'}</p>
                             </div>
                             <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                          </label>
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-6">
                        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">
                            Create the business owner account. The owner can then add managers and employees from their Store Setup dashboard.
                          </p>
                        </div>

                        <div className="p-5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                              <Crown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Owner Account</span>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1 block">Username *</label>
                              <input 
                                placeholder="e.g., owner_john"
                                value={newUser.username}
                                onChange={(e) => setNewUser({...newUser, username: e.target.value, role: 'owner'})}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-zinc-500 mb-1 block">First Name</label>
                                <input 
                                  placeholder="First Name"
                                  value={newUser.first_name}
                                  onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-zinc-500 mb-1 block">Last Name</label>
                                <input 
                                  placeholder="Last Name"
                                  value={newUser.last_name}
                                  onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                Default Password: <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">{DEFAULT_PASSWORD}</code>
                              </div>
                            </div>
                          </div>
                        </div>

                        {formData.users && formData.users.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">Owner to be Created</label>
                            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-200 dark:bg-emerald-800 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                  {formData.users[0].username[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-zinc-900 dark:text-white">{formData.users[0].username}</div>
                                  <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Crown className="w-3 h-3" /> Owner
                                  </div>
                                </div>
                              </div>
                              <button onClick={() => handleRemoveUser(0)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {(!formData.users || formData.users.length === 0) && newUser.username && (
                          <button 
                            onClick={() => {
                              if (newUser.username) {
                                setFormData(prev => ({
                                  ...prev,
                                  users: [{
                                    username: newUser.username!,
                                    role: 'owner',
                                    first_name: newUser.first_name,
                                    last_name: newUser.last_name,
                                    password: DEFAULT_PASSWORD,
                                  }],
                                }));
                              }
                            }}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Set as Owner
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xl">
                    {step > 1 ? (
                      <button 
                        onClick={() => setStep(step - 1)}
                        className="px-6 py-2.5 text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-white transition-colors"
                      >
                        Back
                      </button>
                    ) : (
                      <div></div>
                    )}
                    
                    {step < 3 ? (
                      <button 
                        onClick={() => setStep(step + 1)}
                        className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:shadow-lg hover:shadow-zinc-500/20 transition-all flex items-center gap-2"
                      >
                        Next Step <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-black dark:hover:bg-zinc-200 hover:shadow-lg hover:shadow-zinc-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Creating...' : 'Create Business'} <Sparkles className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
