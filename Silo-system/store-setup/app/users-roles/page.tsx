'use client';

import { useState, useEffect } from 'react';
import { UserCog, Plus, Edit2, Trash2, Crown, Shield, User, Key, X, AlertCircle, Monitor } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword, type BusinessUser, type CreateUserData } from '@/lib/users-api';

export default function UsersRolesPage() {
  const { t, isRTL } = useLanguage();
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [maxUsers, setMaxUsers] = useState(5);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<BusinessUser | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'manager' | 'employee' | 'pos'>('employee');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await getUsers();
      // Sort users: owner first, then managers, then employees/pos
      const sortedUsers = [...response.data].sort((a, b) => {
        const roleOrder: Record<string, number> = { owner: 0, manager: 1, employee: 2, pos: 3 };
        return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
      });
      setUsers(sortedUsers);
      setMaxUsers(response.max_users);
      setCurrentUserId(response.current_user_id);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      if (err.response?.status === 403) {
        setError(t('Only owners can manage users', 'فقط المالك يمكنه إدارة المستخدمين'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (user?: BusinessUser) => {
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRole(user.role === 'owner' ? 'manager' : user.role as 'manager' | 'employee');
      setStatus(user.status === 'suspended' ? 'inactive' : user.status as 'active' | 'inactive');
    } else {
      setEditingUser(null);
      setUsername('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setRole('employee');
      setStatus('active');
    }
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError(t('Username is required', 'اسم المستخدم مطلوب'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          username: username.trim(),
          role: editingUser.role === 'owner' ? undefined : role,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          status: editingUser.role === 'owner' ? undefined : status,
        });
        setSuccessMessage(t('User updated successfully', 'تم تحديث المستخدم بنجاح'));
      } else {
        const result = await createUser({
          username: username.trim(),
          role,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        setSuccessMessage(t(`User created! Default password: ${result.default_password}`, `تم إنشاء المستخدم! كلمة المرور الافتراضية: ${result.default_password}`));
      }
      loadUsers();
      setTimeout(() => {
        handleCloseModal();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save user', 'فشل في حفظ المستخدم'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: BusinessUser) => {
    if (user.role === 'owner') {
      alert(t('Cannot delete owner account', 'لا يمكن حذف حساب المالك'));
      return;
    }

    if (!confirm(t('Are you sure you want to delete this user?', 'هل أنت متأكد من حذف هذا المستخدم؟'))) {
      return;
    }

    try {
      await deleteUser(user.id);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to delete user', 'فشل في حذف المستخدم'));
    }
  };

  const handleResetPassword = async (user: BusinessUser) => {
    if (!confirm(t('Reset password to default (90074007)?', 'إعادة تعيين كلمة المرور إلى الافتراضية (90074007)؟'))) {
      return;
    }

    try {
      const result = await resetUserPassword(user.id);
      alert(t(`Password reset to: ${result.default_password}`, `تم إعادة تعيين كلمة المرور إلى: ${result.default_password}`));
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to reset password', 'فشل في إعادة تعيين كلمة المرور'));
    }
  };

  const getRoleIcon = (userRole: string) => {
    switch (userRole) {
      case 'owner': return <Crown className="w-4 h-4 text-amber-500" />;
      case 'manager': return <Shield className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
      case 'pos': return <Monitor className="w-4 h-4 text-emerald-500" />;
      default: return <User className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'owner': 
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'manager': 
        return 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300';
      case 'pos': 
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      default: 
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    }
  };

  const canAddUsers = users.length < maxUsers;

  return (
    <PageLayout searchPlaceholder={{ en: 'Search users...', ar: 'البحث في المستخدمين...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Users & Roles', 'المستخدمين والصلاحيات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage staff access and permissions', 'إدارة صلاحيات الموظفين')}
            </p>
          </div>
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm text-zinc-500">
              {users.length} / {maxUsers} {t('users', 'مستخدم')}
            </span>
            <button 
              onClick={() => handleOpenModal()}
              disabled={!canAddUsers}
              className={`inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors ${isRTL ? 'flex-row-reverse' : ''} ${!canAddUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Plus className="w-4 h-4" />
              {t('Add User', 'إضافة مستخدم')}
            </button>
          </div>
        </div>

        {!canAddUsers && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('You have reached the maximum number of users for your plan. Contact support to upgrade.', 'لقد وصلت إلى الحد الأقصى لعدد المستخدمين في خطتك. تواصل مع الدعم للترقية.')}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <UserCog className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No additional users yet', 'لا يوجد مستخدمين إضافيين بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Add managers and employees to help run your business', 'أضف مديرين وموظفين للمساعدة في إدارة عملك')}
            </p>
            <button 
              onClick={() => handleOpenModal()}
              disabled={!canAddUsers}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add User', 'إضافة مستخدم')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <div className={`flex items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                      user.role === 'owner' 
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {user.username[0].toUpperCase()}
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <h3 className="font-semibold text-zinc-900 dark:text-white">
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : user.username}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex items-center gap-1 ${getRoleBadge(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {t(
                            user.role === 'owner' ? 'Owner' : 
                            user.role === 'manager' ? 'Manager' : 
                            user.role === 'pos' ? 'POS Terminal' : 'Employee',
                            user.role === 'owner' ? 'مالك' : 
                            user.role === 'manager' ? 'مدير' : 
                            user.role === 'pos' ? 'نقطة بيع' : 'موظف'
                          )}
                        </span>
                        {user.status !== 'active' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            {t('Inactive', 'غير نشط')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                        @{user.username}
                        {user.email && ` • ${user.email}`}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {/* Reset password - only for non-owners or self */}
                    {(user.role !== 'owner' || user.id === currentUserId) && (
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                        title={t('Reset Password', 'إعادة تعيين كلمة المرور')}
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    )}
                    {/* Edit - only for non-owners or self */}
                    {(user.role !== 'owner' || user.id === currentUserId) && (
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {/* Delete - only for non-owners */}
                    {user.role !== 'owner' && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
              className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingUser ? t('Edit User', 'تعديل المستخدم') : t('Add User', 'إضافة مستخدم')}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
                    {successMessage}
                  </div>
                )}

                {editingUser?.role === 'owner' && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    {t('Owner role and status cannot be changed', 'لا يمكن تغيير دور المالك أو حالته')}
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Username', 'اسم المستخدم')} *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('e.g., john_doe', 'مثال: john_doe')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('First Name', 'الاسم الأول')}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Last Name', 'الاسم الأخير')}
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                {(!editingUser || editingUser.role !== 'owner') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                        {t('Role', 'الدور')} *
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'manager' | 'employee' | 'pos')}
                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      >
                        <option value="manager">{t('Manager', 'مدير')}</option>
                        <option value="employee">{t('Employee', 'موظف')}</option>
                        <option value="pos">{t('POS Terminal', 'نقطة بيع')}</option>
                      </select>
                    </div>
                    {editingUser && (
                      <div>
                        <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                          {t('Status', 'الحالة')}
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        >
                          <option value="active">{t('Active', 'نشط')}</option>
                          <option value="inactive">{t('Inactive', 'غير نشط')}</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Email', 'البريد الإلكتروني')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
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
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {!editingUser && (
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm text-zinc-600 dark:text-zinc-400">
                    {t('Default password will be: ', 'كلمة المرور الافتراضية ستكون: ')}
                    <code className="font-mono bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded">90074007</code>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !!successMessage}
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting 
                    ? t('Saving...', 'جاري الحفظ...') 
                    : editingUser 
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
