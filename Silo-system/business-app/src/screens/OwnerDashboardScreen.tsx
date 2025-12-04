import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import api from '../api/client';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  ClipboardList, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  ChevronRight,
  Bell,
  Search,
  Building2,
  Check,
  Layers,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react-native';

interface Business {
  id: number;
  name: string;
  slug: string;
  currency?: string;
}

interface DashboardStats {
  ordersToday: number;
  activeOrders: number;
  completedToday: number;
  totalRevenue: number;
  lowStockItems: number;
  currency: string;
}

type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

export default function OwnerDashboardScreen({ navigation }: any) {
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [showBusinessPicker, setShowBusinessPicker] = useState(false);
  const [isAllWorkspaces, setIsAllWorkspaces] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBusinessData();
  }, []);

  useEffect(() => {
    if (currentBusiness || isAllWorkspaces) {
      fetchDashboardStats();
    }
  }, [currentBusiness, isAllWorkspaces, selectedPeriod]);

  const loadBusinessData = async () => {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      const businessesStr = await AsyncStorage.getItem('businesses');
      
      if (businessStr) {
        setCurrentBusiness(JSON.parse(businessStr));
      }
      if (businessesStr) {
        setBusinesses(JSON.parse(businessesStr));
      }
    } catch (error) {
      console.error('Error loading business data:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/analytics/dashboard', {
        params: {
          period: selectedPeriod,
          combined: isAllWorkspaces ? 'true' : 'false',
        },
      });
      
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardStats();
  }, [selectedPeriod, isAllWorkspaces]);

  const switchBusiness = async (business: Business | null) => {
    try {
      if (business === null) {
        // Switch to "All Workspaces" mode
        setIsAllWorkspaces(true);
        setCurrentBusiness(null);
      } else {
        setIsAllWorkspaces(false);
        await AsyncStorage.setItem('business', JSON.stringify(business));
        setCurrentBusiness(business);
      }
      setShowBusinessPicker(false);
      setLoading(true);
    } catch (error) {
      console.error('Error switching business:', error);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const symbols: Record<string, string> = {
      USD: '$',
      KWD: 'KD ',
      EUR: '€',
      GBP: '£',
      SAR: 'SR ',
      AED: 'AED ',
    };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPeriodLabel = () => {
    const period = TIME_PERIODS.find(p => p.value === selectedPeriod);
    return period?.label || 'Today';
  };

  const MenuItem = ({ icon: Icon, title, subtitle, isLast, onPress }: any) => (
    <TouchableOpacity style={[styles.menuItem, isLast && styles.menuItemLast]} onPress={onPress}>
      <View style={styles.menuIconContainer}>
        <Icon size={22} color={colors.foreground} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.menuArrowContainer}>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );

  const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const displayName = isAllWorkspaces ? 'All Workspaces' : (currentBusiness?.name || 'Silo Business');

  return (
    <View style={styles.container}>
      {/* Business Picker Modal */}
      <Modal
        visible={showBusinessPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBusinessPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowBusinessPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Switch Workspace</Text>
            
            {/* All Workspaces Option */}
            {businesses.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.businessOption,
                  isAllWorkspaces && styles.businessOptionActive
                ]}
                onPress={() => switchBusiness(null)}
              >
                <Layers size={20} color={isAllWorkspaces ? colors.primary : colors.mutedForeground} />
                <Text style={[
                  styles.businessOptionText,
                  isAllWorkspaces && styles.businessOptionTextActive
                ]}>
                  All Workspaces
                </Text>
                {isAllWorkspaces && (
                  <Check size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}

            {/* Individual Businesses */}
            {businesses.map((business) => (
              <TouchableOpacity
                key={business.id}
                style={[
                  styles.businessOption,
                  !isAllWorkspaces && currentBusiness?.id === business.id && styles.businessOptionActive
                ]}
                onPress={() => switchBusiness(business)}
              >
                <Building2 size={20} color={!isAllWorkspaces && currentBusiness?.id === business.id ? colors.primary : colors.mutedForeground} />
                <Text style={[
                  styles.businessOptionText,
                  !isAllWorkspaces && currentBusiness?.id === business.id && styles.businessOptionTextActive
                ]}>
                  {business.name}
                </Text>
                {!isAllWorkspaces && currentBusiness?.id === business.id && (
                  <Check size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => businesses.length > 0 && setShowBusinessPicker(true)}>
            <Text style={styles.headerBrand}>{displayName}</Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerRole}>Owner Workspace</Text>
              {businesses.length > 1 && (
                <View style={[styles.switchBadge, isAllWorkspaces && styles.switchBadgeAll]}>
                  <Text style={styles.switchBadgeText}>{isAllWorkspaces ? 'Combined' : 'Switch'}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Search size={20} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Bell size={20} color={colors.foreground} />
              <View style={styles.badge} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, styles.logoutButton]} onPress={handleLogout}>
              <LogOut size={20} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Time Period Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
          {TIME_PERIODS.map((period) => (
            <TouchableOpacity
              key={period.value}
              style={[
                styles.filterChip,
                selectedPeriod === period.value && styles.filterChipActive
              ]}
              onPress={() => {
                setSelectedPeriod(period.value);
                setLoading(true);
              }}
            >
              <Text style={[
                styles.filterChipText,
                selectedPeriod === period.value && styles.filterChipTextActive
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : stats ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard 
                icon={ShoppingBag}
                title="Orders"
                value={stats.ordersToday}
                subtitle={getPeriodLabel()}
                color="#3b82f6"
              />
              <StatCard 
                icon={Clock}
                title="Active Now"
                value={stats.activeOrders}
                subtitle="In progress"
                color="#f59e0b"
              />
              <StatCard 
                icon={CheckCircle}
                title="Completed"
                value={stats.completedToday}
                subtitle={getPeriodLabel()}
                color="#22c55e"
              />
              <StatCard 
                icon={TrendingUp}
                title="Revenue"
                value={formatCurrency(stats.totalRevenue, stats.currency)}
                subtitle={getPeriodLabel()}
                color="#8b5cf6"
              />
            </View>

            {/* Low Stock Alert */}
            {stats.lowStockItems > 0 && (
              <View style={styles.alertCard}>
                <View style={styles.alertIconContainer}>
                  <AlertTriangle size={20} color="#ef4444" />
                </View>
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertTitle}>Low Stock Alert</Text>
                  <Text style={styles.alertSubtitle}>{stats.lowStockItems} item{stats.lowStockItems > 1 ? 's' : ''} need restocking</Text>
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No data available</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.card}>
            <MenuItem 
              icon={LayoutDashboard} 
              title="Dashboard & Analytics" 
              subtitle="Real-time business insights"
            />
            <View style={styles.divider} />
            <MenuItem 
              icon={BarChart3} 
              title="Reports" 
              subtitle="Sales and performance data"
              isLast
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>
          <View style={styles.card}>
            <MenuItem icon={Package} title="Product Management" subtitle="Manage catalog & prices" />
            <View style={styles.divider} />
            <MenuItem icon={ShoppingBag} title="Orders" subtitle="Track and process orders" />
            <View style={styles.divider} />
            <MenuItem icon={ClipboardList} title="Inventory" subtitle="Stock levels & suppliers" isLast />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff & Settings</Text>
          <View style={styles.card}>
            <MenuItem icon={Users} title="Staff Management" subtitle="Roles & permissions" />
            <View style={styles.divider} />
            <MenuItem icon={Settings} title="System Settings" subtitle="Configure your business" isLast />
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Silo Business App v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  headerRole: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  switchBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  switchBadgeAll: {
    backgroundColor: '#8b5cf6',
  },
  switchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.destructive,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  // Filter styles
  filterScroll: {
    marginBottom: 24,
    marginHorizontal: -24,
  },
  filterContainer: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: colors.background,
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  statSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
    opacity: 0.7,
    marginTop: 2,
  },
  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  // Loading state
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mutedForeground,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.card,
  },
  menuItemLast: {},
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '400',
  },
  menuArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 80,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: colors.mutedForeground,
    opacity: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 16,
    textAlign: 'center',
  },
  businessOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    marginBottom: 8,
    gap: 12,
  },
  businessOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  businessOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
  },
  businessOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
