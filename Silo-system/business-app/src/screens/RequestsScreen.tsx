import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Platform,
  RefreshControl
} from 'react-native';
import { colors } from '../theme/colors';
import api from '../api/client';
import { useLocalization } from '../localization/LocalizationContext';
import { StatsSkeleton, ListSkeleton } from '../components/SkeletonLoader';
import { 
  ArrowLeft,
  ArrowRight,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Store,
  Mail,
  Phone,
  MapPin,
  Image as ImageIcon,
  MessageSquare,
  StickyNote,
  Globe,
  Percent
} from 'lucide-react-native';

interface ChangeRequest {
  id: number;
  request_type: string;
  status: 'pending' | 'approved' | 'rejected';
  new_name?: string;
  new_email?: string;
  new_phone?: string;
  new_address?: string;
  new_logo_url?: string;
  new_certificate_url?: string;
  // Localization fields
  new_currency?: string;
  new_language?: string;
  new_timezone?: string;
  // Tax fields
  new_vat_enabled?: boolean;
  new_vat_rate?: number;
  requester_notes?: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
  reviewed_at?: string;
}

export default function RequestsScreen({ navigation }: any) {
  const { t, isRTL } = useLocalization();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/business-settings/change-requests');
      setRequests(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, []);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={20} color="#22c55e" />;
      case 'rejected': return <XCircle size={20} color="#ef4444" />;
      default: return <Clock size={20} color="#f59e0b" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return { bg: '#dcfce7', text: '#166534' };
      case 'rejected': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#fef3c7', text: '#92400e' };
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'logo': return t('logoUpdate');
      case 'certificate': return t('certificateUpload');
      case 'profile':
      case 'info': return t('profileUpdate');
      case 'localization': return t('localizationSettings');
      case 'tax': return t('taxVatSettings');
      default: return t('changeRequest');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return t('approved');
      case 'rejected': return t('rejected');
      default: return t('pending');
    }
  };

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'logo': return <ImageIcon size={22} color={colors.mutedForeground} />;
      case 'certificate': return <FileText size={22} color={colors.mutedForeground} />;
      case 'localization': return <Globe size={22} color={colors.mutedForeground} />;
      case 'tax': return <Percent size={22} color={colors.mutedForeground} />;
      default: return <Store size={22} color={colors.mutedForeground} />;
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('myRequests')}</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.content}>
          <StatsSkeleton count={4} />
          <ListSkeleton count={4} type="request" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back button always on the left */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myRequests')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        <View style={[styles.statsRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{requests.length}</Text>
            <Text style={styles.statLabel}>{t('total')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statNumber, { color: '#92400e' }]}>
              {requests.filter(r => r.status === 'pending').length}
            </Text>
            <Text style={[styles.statLabel, { color: '#92400e' }]}>{t('pending')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.statNumber, { color: '#166534' }]}>
              {requests.filter(r => r.status === 'approved').length}
            </Text>
            <Text style={[styles.statLabel, { color: '#166534' }]}>{t('approved')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.statNumber, { color: '#991b1b' }]}>
              {requests.filter(r => r.status === 'rejected').length}
            </Text>
            <Text style={[styles.statLabel, { color: '#991b1b' }]}>{t('rejected')}</Text>
          </View>
        </View>

        {/* Requests List */}
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, isRTL && { textAlign: 'right' }]}>{t('noRequests')}</Text>
            <Text style={[styles.emptyText, isRTL && { textAlign: 'right' }]}>
              {t('noRequests')}
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {requests.map((req) => {
              const isExpanded = expandedId === req.id;
              const dateInfo = formatDateTime(req.created_at);
              const reviewedDateInfo = req.reviewed_at ? formatDateTime(req.reviewed_at) : null;
              const statusColors = getStatusColor(req.status);
              
              return (
                <View key={req.id} style={styles.requestCard}>
                  {/* Collapsed Header - always same JSX order, RTL handled via styles */}
                  <TouchableOpacity 
                    style={[styles.requestHeader, isRTL && { flexDirection: 'row-reverse' }]}
                    onPress={() => toggleExpand(req.id)}
                    activeOpacity={0.7}
                  >
                    {/* Icon Container */}
                    <View style={[
                      styles.requestIconContainer,
                      req.status === 'approved' && { backgroundColor: '#dcfce7' },
                      req.status === 'rejected' && { backgroundColor: '#fee2e2' },
                    ]}>
                      {getRequestIcon(req.request_type)}
                    </View>
                    
                    {/* Info Section */}
                    <View style={styles.requestInfo}>
                      {/* Title on its own line */}
                      <Text style={[styles.requestTitle, isRTL && styles.rtlText]} numberOfLines={1}>
                        {getRequestTypeLabel(req.request_type)}
                      </Text>
                      
                      {/* Status badge and date on second line */}
                      <View style={[styles.requestMetaRow, isRTL && { flexDirection: 'row-reverse' }]}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }, isRTL && { flexDirection: 'row-reverse' }]}>
                          {getStatusIcon(req.status)}
                          <Text style={[styles.statusText, { color: statusColors.text }]}>
                            {getStatusLabel(req.status)}
                          </Text>
                        </View>
                        <View style={[styles.requestMeta, isRTL && { flexDirection: 'row-reverse' }]}>
                          <Calendar size={14} color={colors.mutedForeground} />
                          <Text style={styles.requestMetaText}>{dateInfo.relative}</Text>
                        </View>
                      </View>
                    </View>
                    
                    {/* Chevron */}
                    {isExpanded ? (
                      <ChevronUp size={20} color={colors.mutedForeground} />
                    ) : (
                      <ChevronDown size={20} color={colors.mutedForeground} />
                    )}
                  </TouchableOpacity>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Timeline */}
                      <View style={styles.section}>
                        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('timeline')}</Text>
                        <View style={styles.timeline}>
                          <View style={[styles.timelineItem, isRTL && styles.rtlRow]}>
                            <View style={styles.timelineDot} />
                            <View style={[styles.timelineContent, isRTL && { alignItems: 'flex-end' }]}>
                              <Text style={[styles.timelineTitle, isRTL && styles.rtlText]}>{t('requestSubmitted')}</Text>
                              <Text style={[styles.timelineDate, isRTL && styles.rtlText]}>{dateInfo.date} {t('at')} {dateInfo.time}</Text>
                            </View>
                          </View>
                          {req.status !== 'pending' && reviewedDateInfo && (
                            <View style={[styles.timelineItem, isRTL && styles.rtlRow]}>
                              <View style={[
                                styles.timelineDot,
                                req.status === 'approved' && { backgroundColor: '#22c55e' },
                                req.status === 'rejected' && { backgroundColor: '#ef4444' },
                              ]} />
                              <View style={[styles.timelineContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.timelineTitle, isRTL && styles.rtlText]}>
                                  {req.status === 'approved' ? t('requestApproved') : t('requestRejected')}
                                </Text>
                                <Text style={[styles.timelineDate, isRTL && styles.rtlText]}>
                                  {reviewedDateInfo.date} {t('at')} {reviewedDateInfo.time}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Requested Changes */}
                      <View style={styles.section}>
                        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('requestedChanges')}</Text>
                        <View style={styles.changesContainer}>
                          {req.new_name && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Store size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newName')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_name}</Text>
                              </View>
                            </View>
                          )}
                          {req.new_email && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Mail size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newEmail')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_email}</Text>
                              </View>
                            </View>
                          )}
                          {req.new_phone && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Phone size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newPhone')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_phone}</Text>
                              </View>
                            </View>
                          )}
                          {req.new_address && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <MapPin size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newAddress')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_address}</Text>
                              </View>
                            </View>
                          )}
                          {/* Localization Fields */}
                          {req.new_currency && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Globe size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newCurrency')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_currency}</Text>
                              </View>
                            </View>
                          )}
                          {req.new_language && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Globe size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newLanguage')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_language === 'en' ? t('english') : req.new_language === 'ar' ? t('arabic') : req.new_language}</Text>
                              </View>
                            </View>
                          )}
                          {req.new_timezone && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Globe size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newTimezone')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_timezone}</Text>
                              </View>
                            </View>
                          )}
                          {/* Tax/VAT Fields */}
                          {req.new_vat_enabled !== undefined && req.new_vat_enabled !== null && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Percent size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('vatEnabled')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText, { color: req.new_vat_enabled ? '#16a34a' : '#dc2626' }]}>
                                  {req.new_vat_enabled ? t('yes') : t('no')}
                                </Text>
                              </View>
                            </View>
                          )}
                          {req.new_vat_rate !== undefined && (
                            <View style={[styles.changeItem, isRTL && styles.rtlRow]}>
                              <Percent size={16} color={colors.mutedForeground} />
                              <View style={[styles.changeContent, isRTL && { alignItems: 'flex-end' }]}>
                                <Text style={[styles.changeLabel, isRTL && styles.rtlText]}>{t('newVatRate')}</Text>
                                <Text style={[styles.changeValue, isRTL && styles.rtlText]}>{req.new_vat_rate}%</Text>
                              </View>
                            </View>
                          )}
                          {!req.new_name && !req.new_email && !req.new_phone && !req.new_address && 
                           !req.new_currency && !req.new_language && !req.new_timezone &&
                           req.new_vat_enabled === undefined && req.new_vat_rate === undefined && (
                            <Text style={[styles.noChangesText, isRTL && styles.rtlText]}>{t('noSpecificChanges')}</Text>
                          )}
                        </View>
                      </View>

                      {/* Your Note */}
                      {req.requester_notes && (
                        <View style={[styles.section, styles.noteSection, isRTL && styles.noteSectionRTL]}>
                          <View style={[styles.noteTitleRow, isRTL && styles.rtlRow]}>
                            <StickyNote size={16} color="#3b82f6" />
                            <Text style={[styles.sectionTitle, { color: '#3b82f6', marginBottom: 0 }, isRTL && styles.rtlText]}>
                              {t('yourNote')}
                            </Text>
                          </View>
                          <Text style={[styles.noteText, isRTL && styles.rtlText]}>{req.requester_notes}</Text>
                        </View>
                      )}

                      {/* Admin Response */}
                      {req.admin_notes && (
                        <View style={[
                          styles.section, 
                          styles.adminNoteSection,
                          isRTL && styles.adminNoteSectionRTL,
                          req.status === 'approved' && { backgroundColor: '#dcfce7', borderLeftColor: '#22c55e', borderRightColor: '#22c55e' },
                          req.status === 'rejected' && { backgroundColor: '#fee2e2', borderLeftColor: '#ef4444', borderRightColor: '#ef4444' },
                        ]}>
                          <View style={[styles.noteTitleRow, isRTL && styles.rtlRow]}>
                            <MessageSquare size={16} color={
                              req.status === 'approved' ? '#166534' : 
                              req.status === 'rejected' ? '#991b1b' : colors.mutedForeground
                            } />
                            <Text style={[
                              styles.sectionTitle, 
                              { marginBottom: 0 },
                              isRTL && styles.rtlText,
                              req.status === 'approved' && { color: '#166534' },
                              req.status === 'rejected' && { color: '#991b1b' },
                            ]}>
                              {t('adminResponse')}
                            </Text>
                          </View>
                          <Text style={[
                            styles.noteText,
                            isRTL && styles.rtlText,
                            req.status === 'approved' && { color: '#166534' },
                            req.status === 'rejected' && { color: '#991b1b' },
                          ]}>
                            {req.admin_notes}
                          </Text>
                        </View>
                      )}

                      {/* Status Message */}
                      <View style={[
                        styles.statusMessage,
                        isRTL && styles.rtlRow,
                        req.status === 'approved' && { backgroundColor: '#dcfce7' },
                        req.status === 'rejected' && { backgroundColor: '#fee2e2' },
                        req.status === 'pending' && { backgroundColor: '#fef3c7' },
                      ]}>
                        {getStatusIcon(req.status)}
                        <Text style={[
                          styles.statusMessageText,
                          isRTL && styles.rtlText,
                          req.status === 'approved' && { color: '#166534' },
                          req.status === 'rejected' && { color: '#991b1b' },
                          req.status === 'pending' && { color: '#92400e' },
                        ]}>
                          {req.status === 'approved' && t('changesApplied')}
                          {req.status === 'rejected' && t('rejectedSeeResponse')}
                          {req.status === 'pending' && t('pendingReview')}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  requestsList: {
    gap: 12,
  },
  requestCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  requestIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 6,
  },
  requestMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestMetaText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
  },
  section: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  timeline: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.mutedForeground,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  changesContainer: {
    gap: 10,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  changeContent: {
    flex: 1,
  },
  changeLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  changeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  noChangesText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  noteSection: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  adminNoteSection: {
    borderLeftWidth: 3,
    borderLeftColor: colors.mutedForeground,
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  statusMessageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  // RTL Styles
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
  noteSectionRTL: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: '#3b82f6',
  },
  adminNoteSectionRTL: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
  },
});

