import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import { useLocalization } from '../localization/LocalizationContext';
import api from '../api/client';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  Search,
  Filter,
} from 'lucide-react-native';

type AttendanceStatus = 'on_time' | 'late' | 'absent' | 'checked_in' | 'checked_out' | 'rest_day';

interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_role: string;
  date: string;
  day_name: string;
  checkin_time: string | null;
  checkout_time: string | null;
  total_hours: number | null;
  status: AttendanceStatus;
  late_minutes: number;
  branch_name: string | null;
}

interface AttendanceSummary {
  total_records: number;
  on_time: number;
  late: number;
  absent: number;
  checked_in: number;
}

export default function OwnerAttendanceScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t, isRTL } = useLocalization();
  const styles = createStyles(colors);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Date range (default: last 7 days)
  const [startDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadAttendance();
  }, []);

  const loadAttendance = async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      setError(null);

      const response = await api.get('/hr/attendance/employees', {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });

      if (response.data.success) {
        setRecords(response.data.data.records);
        setSummary(response.data.data.summary);
      }
    } catch (err: any) {
      console.error('Failed to load attendance:', err);
      setError(err.response?.data?.error || t('failedToLoadAttendance'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAttendance(true);
  }, []);

  // Filter records by search query
  const filteredRecords = records.filter((record) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      record.employee_name.toLowerCase().includes(query) ||
      record.employee_role.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'on_time':
        return '#22c55e';
      case 'late':
        return '#f59e0b';
      case 'absent':
        return '#ef4444';
      case 'checked_in':
        return '#3b82f6';
      case 'checked_out':
        return colors.mutedForeground;
      default:
        return colors.mutedForeground;
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    const color = getStatusColor(status);
    switch (status) {
      case 'on_time':
        return <CheckCircle2 size={14} color={color} />;
      case 'late':
        return <AlertCircle size={14} color={color} />;
      case 'absent':
        return <XCircle size={14} color={color} />;
      case 'checked_in':
        return <Clock size={14} color={color} />;
      default:
        return <CheckCircle2 size={14} color={color} />;
    }
  };

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case 'on_time':
        return t('onTime');
      case 'late':
        return t('late');
      case 'absent':
        return t('absent');
      case 'checked_in':
        return t('checkedIn');
      case 'checked_out':
        return t('checkedOut');
      default:
        return status;
    }
  };

  const renderRecord = ({ item }: { item: AttendanceRecord }) => (
    <View style={[styles.recordCard, isRTL && styles.rtlRow]}>
      <View style={[styles.avatar, isRTL && { marginRight: 0, marginLeft: 12 }]}>
        <User size={20} color={colors.mutedForeground} />
      </View>
      <View style={[styles.recordContent, isRTL && { alignItems: 'flex-end' }]}>
        <View style={[styles.recordHeader, isRTL && styles.rtlRow]}>
          <Text style={[styles.employeeName, isRTL && styles.rtlText]}>{item.employee_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text style={[styles.employeeRole, isRTL && styles.rtlText]}>
          {item.employee_role === 'manager' ? t('manager') :
           item.employee_role === 'operations_manager' ? t('opsManager') : t('employee')}
        </Text>
        <View style={[styles.recordDetails, isRTL && styles.rtlRow]}>
          <View style={[styles.detailItem, isRTL && styles.rtlRow]}>
            <Calendar size={12} color={colors.mutedForeground} />
            <Text style={[styles.detailText, isRTL && { marginLeft: 0, marginRight: 4 }]}>
              {item.date} ({item.day_name})
            </Text>
          </View>
          <View style={[styles.detailItem, isRTL && styles.rtlRow]}>
            <Clock size={12} color={colors.mutedForeground} />
            <Text style={[styles.detailText, isRTL && { marginLeft: 0, marginRight: 4 }]}>
              {item.checkin_time || '-'} - {item.checkout_time || '-'}
              {item.late_minutes > 0 && (
                <Text style={styles.lateText}> (+{item.late_minutes}m)</Text>
              )}
            </Text>
          </View>
        </View>
        {item.total_hours !== null && (
          <Text style={[styles.hoursText, isRTL && styles.rtlText]}>
            {t('totalHours')}: {item.total_hours.toFixed(1)}h
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerContent, isRTL && styles.rtlRow]}>
          <TouchableOpacity
            style={[styles.backButton, isRTL && { marginRight: 0, marginLeft: 12 }]}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color={colors.foreground} style={isRTL ? { transform: [{ rotate: '180deg' }] } : undefined} />
          </TouchableOpacity>
          <View style={isRTL ? { alignItems: 'flex-end' } : undefined}>
            <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('attendanceRecords')}</Text>
            <Text style={[styles.headerSubtitle, isRTL && styles.rtlText]}>{t('viewEmployeeAttendance')}</Text>
          </View>
        </View>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryRow, isRTL && styles.rtlRow]}>
            <View style={[styles.summaryCard, { borderLeftColor: '#22c55e' }]}>
              <Text style={styles.summaryValue}>{summary.on_time}</Text>
              <Text style={styles.summaryLabel}>{t('onTime')}</Text>
            </View>
            <View style={[styles.summaryCard, { borderLeftColor: '#f59e0b' }]}>
              <Text style={styles.summaryValue}>{summary.late}</Text>
              <Text style={styles.summaryLabel}>{t('late')}</Text>
            </View>
            <View style={[styles.summaryCard, { borderLeftColor: '#ef4444' }]}>
              <Text style={styles.summaryValue}>{summary.absent}</Text>
              <Text style={styles.summaryLabel}>{t('absent')}</Text>
            </View>
            <View style={[styles.summaryCard, { borderLeftColor: '#3b82f6' }]}>
              <Text style={styles.summaryValue}>{summary.checked_in}</Text>
              <Text style={styles.summaryLabel}>{t('currentlyIn')}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, isRTL && styles.rtlRow]}>
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.rtlText]}
            placeholder={t('searchEmployee')}
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadAttendance()}>
            <Text style={styles.retryText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Clock size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>{t('noAttendanceRecords')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecords}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: 12,
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    summaryContainer: {
      padding: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 8,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderLeftWidth: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      fontSize: 15,
      color: colors.foreground,
    },
    listContent: {
      padding: 16,
      paddingTop: 4,
    },
    recordCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    recordContent: {
      flex: 1,
    },
    recordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    employeeName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
      flex: 1,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      gap: 4,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
    employeeRole: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 8,
    },
    recordDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginLeft: 4,
    },
    lateText: {
      color: '#f59e0b',
      fontWeight: '500',
    },
    hoursText: {
      fontSize: 12,
      color: colors.foreground,
      fontWeight: '500',
      marginTop: 6,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: 15,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginTop: 12,
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.foreground,
      borderRadius: 10,
    },
    retryText: {
      color: colors.background,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    emptyText: {
      fontSize: 15,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginTop: 12,
    },
    rtlRow: {
      flexDirection: 'row-reverse',
    },
    rtlText: {
      textAlign: 'right',
    },
  });
