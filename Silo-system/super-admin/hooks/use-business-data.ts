import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { businessApi, authApi } from '@/lib/api';
import type { Business, User } from '@/types';

export function useBusinessData() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  const loadBusinesses = useCallback(async () => {
    try {
      const data = await businessApi.getAll();
      setBusinesses(data);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));
    loadBusinesses();
  }, [router, loadBusinesses]);

  const handleLogout = () => {
    authApi.logout();
    router.push('/login');
  };

  const handleView = (business: Business) => {
    setSelectedBusiness(business);
    setShowViewModal(true);
  };

  const handleEdit = (business: Business) => {
    setSelectedBusiness(business);
    setShowEditModal(true);
  };

  const handleDelete = (business: Business) => {
    setSelectedBusiness(business);
    setShowDeleteModal(true);
  };

  return {
    user,
    businesses,
    loading,
    loadBusinesses,
    handleLogout,
    modalState: {
      showCreateModal, setShowCreateModal,
      showViewModal, setShowViewModal,
      showEditModal, setShowEditModal,
      showDeleteModal, setShowDeleteModal,
      selectedBusiness, setSelectedBusiness
    },
    actions: {
      handleView,
      handleEdit,
      handleDelete
    }
  };
}

