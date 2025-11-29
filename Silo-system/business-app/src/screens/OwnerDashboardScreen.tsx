import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
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
  Search
} from 'lucide-react-native';

export default function OwnerDashboardScreen({ navigation }: any) {
  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const MenuItem = ({ icon: Icon, title, subtitle, isLast }: any) => (
    <TouchableOpacity style={[styles.menuItem, isLast && styles.menuItemLast]}>
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

  const StatCard = ({ title, value, change, isPositive }: any) => (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <View style={[styles.statChangeContainer, { backgroundColor: isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
        <Text style={[styles.statChangeText, { color: isPositive ? '#22c55e' : '#ef4444' }]}>
          {change}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerBrand}>Silo Business</Text>
            <Text style={styles.headerRole}>Owner Workspace</Text>
          </View>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Quick Stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsContainer}>
          <StatCard title="Total Sales" value="$12,450" change="+15%" isPositive={true} />
          <StatCard title="Active Orders" value="24" change="+5" isPositive={true} />
          <StatCard title="Low Stock" value="3 Items" change="-2" isPositive={false} />
        </ScrollView>

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
    marginTop: 4,
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Destructive light
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
  statsScroll: {
    marginBottom: 32,
    marginHorizontal: -24,
  },
  statsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    width: 140,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statTitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  statChangeContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statChangeText: {
    fontSize: 11,
    fontWeight: '700',
  },
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
  menuItemLast: {
    // Remove any bottom borders if added later
  },
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
    backgroundColor: 'transparent', // or colors.secondary for subtle circle
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 80, // Align with text start
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
});
