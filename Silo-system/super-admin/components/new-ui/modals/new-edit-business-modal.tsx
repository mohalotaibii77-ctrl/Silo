'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Building2, Mail, Phone, MapPin, Tag, Upload, FileText, 
  UserPlus, Users, Trash2, Copy, Check, Eye, EyeOff, ShieldCheck,
  Sparkles, Save, RefreshCw, Store, Plus, Edit2
} from 'lucide-react';
import { businessApi, UserCredentials } from '@/lib/api';
import type { Business, UpdateBusinessInput, BusinessUser, Branch, BranchInput } from '@/types';
import Image from 'next/image';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface NewEditBusinessModalProps {
  business: Business | null;
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

export function NewEditBusinessModal({ business, isOpen, onClose, onSuccess }: NewEditBusinessModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<UserCredentials[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'subscription' | 'users' | 'branches'>('info');
  
  // Branch management state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState<BranchInput>({ name: '', address: '', phone: '', email: '' });
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [editingBranch, setEditingBranch] = useState<Partial<BranchInput>>({});
  const [branchActionLoading, setBranchActionLoading] = useState(false);

  const [formData, setFormData] = useState<UpdateBusinessInput>({
    name: '', slug: '', email: '', phone: '', address: '',
    business_type: 'restaurant', logo_url: '', certificate_url: '',
    subscription_tier: 'basic', subscription_status: 'active',
    max_users: 5, max_products: 100, users: [],
  });

  const [newUser, setNewUser] = useState<Partial<BusinessUser>>({
    username: '', role: 'employee', first_name: '', last_name: ''
  });
  const [deletedUserIds, setDeletedUserIds] = useState<number[]>([]);

  useEffect(() => {
    if (business && isOpen) {
      setFormData({
        name: business.name,
        slug: business.slug,
        email: business.email || '',
        phone: business.phone || '',
        address: business.address || '',
        business_type: business.business_type || 'restaurant',
        logo_url: business.logo_url || '',
        certificate_url: business.certificate_url || '',
        subscription_tier: business.subscription_tier,
        subscription_status: business.subscription_status,
        max_users: business.max_users,
        max_products: business.max_products,
        users: [],
      });
      setLogoPreview(business.logo_url || null);
      loadBusinessUsers(business.id);
      loadBusinessBranches(business.id);
    }
  }, [business, isOpen]);

  const loadBusinessUsers = async (businessId: number) => {
    setLoadingUsers(true);
    try {
      const businessData = await businessApi.getById(businessId);
      setFormData(prev => ({ ...prev, users: businessData.users || [] }));
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadBusinessBranches = async (businessId: number) => {
    setLoadingBranches(true);
    try {
      const branchesData = await businessApi.getBranches(businessId);
      setBranches(branchesData);
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleAddBranch = async () => {
    if (!business || !newBranch.name.trim()) {
      setError('Branch name is required');
      return;
    }
    setBranchActionLoading(true);
    setError('');
    try {
      const created = await businessApi.createBranch(business.id, newBranch);
      setBranches(prev => [...prev, created]);
      setNewBranch({ name: '', address: '', phone: '', email: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create branch');
    } finally {
      setBranchActionLoading(false);
    }
  };

  const handleUpdateBranch = async (branchId: number) => {
    if (!business) return;
    setBranchActionLoading(true);
    setError('');
    try {
      const updated = await businessApi.updateBranch(business.id, branchId, editingBranch);
      setBranches(prev => prev.map(b => b.id === branchId ? updated : b));
      setEditingBranchId(null);
      setEditingBranch({});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update branch');
    } finally {
      setBranchActionLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!business) return;
    const branch = branches.find(b => b.id === branchId);
    if (branch?.is_main) {
      setError('Cannot delete the main branch');
      return;
    }
    if (!confirm('Are you sure you want to delete this branch?')) return;
    
    setBranchActionLoading(true);
    setError('');
    try {
      await businessApi.deleteBranch(business.id, branchId);
      setBranches(prev => prev.filter(b => b.id !== branchId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete branch');
    } finally {
      setBranchActionLoading(false);
    }
  };

  const startEditingBranch = (branch: Branch) => {
    setEditingBranchId(branch.id);
    setEditingBranch({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
    });
  };

  const handleAddUser = () => {
    if (!newUser.username) { setError('Username required'); return; }
    if (formData.users?.some(u => u.username === newUser.username)) { setError('Username exists'); return; }
    if ((formData.users?.length || 0) >= formData.max_users!) { setError('Max users reached'); return; }

    setFormData(prev => ({
      ...prev,
      users: [...(prev.users || []), {
        username: newUser.username!,
        role: newUser.role as any,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        password: DEFAULT_PASSWORD,
      }],
    }));
    setNewUser({ username: '', role: 'employee', first_name: '', last_name: '' });
    setError('');
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

  const handleSubmit = async () => {
    if (!business) return;
    setError('');
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

      // Only send NEW users (those with password) to the backend
      // New users have password set via handleAddUser, existing users from API don't
      const newUsersOnly = formData.users?.filter(u => !!u.password) || [];
      
      const dataToSend = { 
        ...formData, 
        logo_url: logoUrl,
        certificate_url: certificateUrl, 
        users: newUsersOnly,
        deleteUserIds: deletedUserIds.length > 0 ? deletedUserIds : undefined
      };
      const response = await businessApi.update(business.id, dataToSend);
      
      if (response.userCredentials && response.userCredentials.length > 0) {
        setCreatedCredentials(response.userCredentials);
        setShowCredentials(true);
      } else {
        handleClose();
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setCertificateFile(null);
    setShowCredentials(false);
    setCreatedCredentials([]);
    setDeletedUserIds([]);
    setBranches([]);
    setNewBranch({ name: '', address: '', phone: '', email: '' });
    setEditingBranchId(null);
    setEditingBranch({});
    setActiveTab('info');
    setError('');
    onClose();
  };

  const copyCredentials = (index: number) => {
    const cred = createdCredentials[index];
    const text = `Username: ${cred.username}\nPassword: ${cred.password}\nRole: ${cred.role}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!business) return null;

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
                <div className="p-8 flex flex-col h-full">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Update Successful!</h2>
                    <p className="text-zinc-500 mt-2">Credentials for new users created.</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-6 custom-scrollbar">
                    {createdCredentials.map((cred, index) => (
                      <div key={index} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                        <div className="flex justify-between mb-2">
                           <span className="font-bold text-zinc-900 dark:text-white">{cred.username}</span>
                           <button onClick={() => copyCredentials(index)}>
                             {copiedIndex === index ? <Check className="w-4 h-4 text-zinc-500" /> : <Copy className="w-4 h-4" />}
                           </button>
                        </div>
                        <div className="text-sm text-zinc-500">Password: <span className="font-mono text-zinc-900 dark:text-white">{cred.password}</span></div>
                      </div>
                    ))}
                  </div>
                  
                  <button onClick={() => { handleClose(); onSuccess(); }} className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-black dark:hover:bg-zinc-200 transition-colors">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Header with Tabs */}
                  <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="px-6 py-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Edit Business</h2>
                      <button onClick={handleClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                        <X className="w-5 h-5 text-zinc-500" />
                      </button>
                    </div>
                    <div className="flex px-6 gap-6">
                      {['info', 'subscription', 'users', 'branches'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab as any)}
                          className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                            activeTab === tab 
                            ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' 
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                          }`}
                        >
                          {tab === 'branches' ? `Branches (${branches.length})` : tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-900/50">
                    {error && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-lg text-sm">
                        {error}
                      </div>
                    )}

                    {activeTab === 'info' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-500">Business Name</label>
                            <input 
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-zinc-500/20 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-500">Slug</label>
                            <input 
                              value={formData.slug}
                              onChange={(e) => setFormData({...formData, slug: e.target.value})}
                              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-zinc-500/20 outline-none font-mono text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-500">Address</label>
                            <textarea 
                              value={formData.address}
                              onChange={(e) => setFormData({...formData, address: e.target.value})}
                              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-zinc-500/20 outline-none resize-none h-20"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-500">Phone</label>
                            <input 
                              value={formData.phone}
                              onChange={(e) => setFormData({...formData, phone: e.target.value})}
                              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-500">Email</label>
                            <input 
                              value={formData.email}
                              onChange={(e) => setFormData({...formData, email: e.target.value})}
                              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none"
                            />
                          </div>
                        </div>

                        {/* Logo Upload */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-500">Business Logo</label>
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
                              {logoPreview ? (
                                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="w-6 h-6 text-zinc-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all">
                                <div className="flex items-center gap-2">
                                  <Upload className="w-4 h-4 text-zinc-400" />
                                  <span className="text-sm text-zinc-500">
                                    {logoFile ? logoFile.name : 'Change logo'}
                                  </span>
                                </div>
                                <input type="file" className="hidden" onChange={handleLogoChange} accept="image/*" />
                              </label>
                            </div>
                            {(logoFile || logoPreview) && (
                              <button 
                                onClick={() => { setLogoFile(null); setLogoPreview(null); setFormData({...formData, logo_url: ''}); }}
                                className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'subscription' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                           <SearchableSelect
                             label="Status"
                             options={[
                               { id: 'active', name: 'Active' },
                               { id: 'inactive', name: 'Inactive' },
                             ]}
                             value={formData.subscription_status || 'active'}
                             onChange={(value) => setFormData({...formData, subscription_status: value as any})}
                             placeholder="Select status"
                           />
                           <SearchableSelect
                             label="Tier"
                             options={[
                               { id: 'basic', name: 'Basic' },
                               { id: 'pro', name: 'Pro' },
                               { id: 'enterprise', name: 'Enterprise' },
                             ]}
                             value={formData.subscription_tier || 'basic'}
                             onChange={(value) => setFormData({...formData, subscription_tier: value as any})}
                             placeholder="Select tier"
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                             <label className="text-xs font-medium text-zinc-500">Max Users</label>
                             <input 
                               type="number"
                               value={formData.max_users}
                               onChange={(e) => setFormData({...formData, max_users: parseInt(e.target.value)})}
                               className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none"
                             />
                           </div>
                           <div className="space-y-1">
                             <label className="text-xs font-medium text-zinc-500">Max Products</label>
                             <input 
                               type="number"
                               value={formData.max_products}
                               onChange={(e) => setFormData({...formData, max_products: parseInt(e.target.value)})}
                               className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none"
                             />
                           </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'users' && (
                      <div className="space-y-4">
                        {loadingUsers ? (
                          <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-zinc-400" /></div>
                        ) : (
                          <>
                            <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                               <h4 className="text-xs font-bold uppercase text-zinc-400">Add New User</h4>
                               <div className="flex gap-3 items-end">
                                 <input 
                                   placeholder="Username" 
                                   value={newUser.username}
                                   onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                   className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all"
                                 />
                                 <SearchableSelect
                                   className="w-36"
                                   options={[
                                     { id: 'employee', name: 'Employee' },
                                     { id: 'manager', name: 'Manager' },
                                     { id: 'owner', name: 'Owner' },
                                     { id: 'pos', name: 'POS Terminal' },
                                   ]}
                                   value={newUser.role || 'employee'}
                                   onChange={(value) => setNewUser({...newUser, role: value as any})}
                                   placeholder="Role"
                                 />
                                 <button onClick={handleAddUser} className="px-4 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:bg-black dark:hover:bg-zinc-200 font-medium text-sm transition-colors">Add</button>
                               </div>
                            </div>

                            <div className="space-y-2">
                              {formData.users?.map((u, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                      {u.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-zinc-900 dark:text-white">{u.username}</div>
                                      <div className="text-xs text-zinc-500 capitalize">{u.role}</div>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      // Track existing user deletions (users with id)
                                      if ('id' in u && u.id) {
                                        setDeletedUserIds(prev => [...prev, u.id as number]);
                                      }
                                      setFormData(prev => ({...prev, users: prev.users?.filter((_, idx) => idx !== i)}));
                                    }}
                                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {activeTab === 'branches' && (
                      <div className="space-y-4">
                        {loadingBranches ? (
                          <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-zinc-400" /></div>
                        ) : (
                          <>
                            {/* Add New Branch Form */}
                            <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                              <h4 className="text-xs font-bold uppercase text-zinc-400 flex items-center gap-2">
                                <Plus className="w-3 h-3" /> Add New Branch
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                <input 
                                  placeholder="Branch Name *" 
                                  value={newBranch.name}
                                  onChange={(e) => setNewBranch({...newBranch, name: e.target.value})}
                                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                                />
                                <input 
                                  placeholder="Phone" 
                                  value={newBranch.phone}
                                  onChange={(e) => setNewBranch({...newBranch, phone: e.target.value})}
                                  className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                                />
                              </div>
                              <input 
                                placeholder="Address" 
                                value={newBranch.address}
                                onChange={(e) => setNewBranch({...newBranch, address: e.target.value})}
                                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                              />
                              <div className="flex gap-3">
                                <input 
                                  placeholder="Email" 
                                  value={newBranch.email}
                                  onChange={(e) => setNewBranch({...newBranch, email: e.target.value})}
                                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                                />
                                <button 
                                  onClick={handleAddBranch}
                                  disabled={branchActionLoading || !newBranch.name.trim()}
                                  className="px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-black dark:hover:bg-zinc-200 font-medium text-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                  {branchActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                  Add
                                </button>
                              </div>
                            </div>

                            {/* Existing Branches List */}
                            <div className="space-y-2">
                              {branches.map((branch) => (
                                <div key={branch.id} className={`p-4 bg-white dark:bg-zinc-800 border rounded-xl transition-all ${branch.is_main ? 'border-zinc-400 dark:border-zinc-500' : 'border-zinc-200 dark:border-zinc-700'}`}>
                                  {editingBranchId === branch.id ? (
                                    // Edit mode
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <input 
                                          placeholder="Branch Name" 
                                          value={editingBranch.name || ''}
                                          onChange={(e) => setEditingBranch({...editingBranch, name: e.target.value})}
                                          className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                                        />
                                        <input 
                                          placeholder="Phone" 
                                          value={editingBranch.phone || ''}
                                          onChange={(e) => setEditingBranch({...editingBranch, phone: e.target.value})}
                                          className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                                        />
                                      </div>
                                      <input 
                                        placeholder="Address" 
                                        value={editingBranch.address || ''}
                                        onChange={(e) => setEditingBranch({...editingBranch, address: e.target.value})}
                                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                                      />
                                      <div className="flex gap-3">
                                        <input 
                                          placeholder="Email" 
                                          value={editingBranch.email || ''}
                                          onChange={(e) => setEditingBranch({...editingBranch, email: e.target.value})}
                                          className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none"
                                        />
                                        <button 
                                          onClick={() => handleUpdateBranch(branch.id)}
                                          disabled={branchActionLoading}
                                          className="px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-medium text-sm disabled:opacity-50"
                                        >
                                          Save
                                        </button>
                                        <button 
                                          onClick={() => { setEditingBranchId(null); setEditingBranch({}); }}
                                          className="px-4 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium text-sm"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    // View mode
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                                          <Store className="w-5 h-5 text-zinc-500" />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{branch.name}</span>
                                            {branch.is_main && (
                                              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300">Main</span>
                                            )}
                                            {branch.branch_code && (
                                              <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">{branch.branch_code}</span>
                                            )}
                                          </div>
                                          {branch.address && (
                                            <p className="text-xs text-zinc-500 mt-1">{branch.address}</p>
                                          )}
                                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                                            {branch.phone && <span>{branch.phone}</span>}
                                            {branch.email && <span>{branch.email}</span>}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => startEditingBranch(branch)}
                                          className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        {!branch.is_main && (
                                          <button 
                                            onClick={() => handleDeleteBranch(branch.id)}
                                            disabled={branchActionLoading}
                                            className="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                              
                              {branches.length === 0 && (
                                <div className="text-center py-8 text-zinc-500">
                                  <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                  <p>No branches yet. Add your first branch above.</p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                  </div>

                  <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <button 
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-black dark:hover:bg-zinc-200 hover:shadow-lg hover:shadow-zinc-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
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
