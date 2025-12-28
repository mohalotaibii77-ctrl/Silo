import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import { SectionSkeleton } from '../components/SkeletonLoader';
import { 
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  Globe,
  Building2
} from 'lucide-react-native';

// Types
interface Category {
  id: number;
  name: string;
  name_ar?: string;
  description?: string;
  business_id?: number;
  is_system: boolean;
  is_general: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'system' | 'custom';

export default function CategoriesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, isRTL, language } = useLocalization();
  
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load categories with cache-first pattern
  const loadCategories = useCallback(async (forceRefresh = false) => {
    const cacheKey = CacheKeys.categories();
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<Category[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setCategories(cached);
        setIsLoading(false);
        // Refresh in background
        api.get('/categories')
          .then(response => {
            const fresh = response.data.data || [];
            if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
              setCategories(fresh);
              cacheManager.set(cacheKey, fresh, CACHE_TTL.LONG);
            }
          })
          .catch(() => {})
          .finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      const response = await api.get('/categories');
      const data = response.data.data || [];
      setCategories(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.LONG);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories(false); // Use cache if available
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [loadCategories]);

  // Filter categories
  useEffect(() => {
    let filtered = categories || [];
    
    // Filter by type
    if (filter === 'system') {
      filtered = filtered.filter(c => c.is_system);
    } else if (filter === 'custom') {
      filtered = filtered.filter(c => !c.is_system);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.name_ar?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      );
    }
    
    setFilteredCategories(filtered);
  }, [categories, filter, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCategories(true); // Force refresh on pull-to-refresh
  }, [loadCategories]);

  // Modal handlers
  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setNameAr(category.name_ar || '');
      setDescription(category.description || '');
    } else {
      setEditingCategory(null);
      setName('');
      setNameAr('');
      setDescription('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setName('');
    setNameAr('');
    setDescription('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('categoryNameRequired', 'Category name is required'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else {
        await api.post('/categories', {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          description: description.trim() || undefined,
        });
      }
      handleCloseModal();
      await cacheManager.invalidate(CacheKeys.categories());
      loadCategories(true); // Force refresh after mutation
    } catch (err: any) {
      setError(err.response?.data?.error || t('failedToSaveCategory', 'Failed to save category'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (category: Category) => {
    if (category.is_system) {
      Alert.alert(t('error', 'Error'), t('cannotDeleteSystemCategories', 'Cannot delete system categories'));
      return;
    }

    Alert.alert(
      t('confirmDelete', 'Confirm Delete'),
      t('confirmDeleteCategory', 'Are you sure you want to delete this category?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/categories/${category.id}`);
              await cacheManager.invalidate(CacheKeys.categories());
              loadCategories(true); // Force refresh after mutation
            } catch (err: any) {
              Alert.alert(t('error', 'Error'), err.response?.data?.error || t('failedToDeleteCategory', 'Failed to delete category'));
            }
          }
        }
      ]
    );
  };

  const systemCategories = (filteredCategories || []).filter(c => c.is_system);
  const customCategories = (filteredCategories || []).filter(c => !c.is_system);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Render filter tabs
  const FilterTabs = () => (
    <View style={[styles.filterContainer, isRTL && styles.filterContainerRTL]}>
      {[
        { key: 'all' as FilterType, label: t('all', 'All'), count: (categories || []).length },
        { key: 'system' as FilterType, label: t('general', 'General'), count: (categories || []).filter(c => c.is_system).length },
        { key: 'custom' as FilterType, label: t('custom', 'Custom'), count: (categories || []).filter(c => !c.is_system).length },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
          onPress={() => setFilter(tab.key)}
        >
          <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
            {tab.label} ({tab.count})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render category card
  const CategoryCard = ({ category, isSystem }: { category: Category; isSystem: boolean }) => (
    <View style={styles.categoryCard}>
      <View style={[styles.categoryCardContent, isRTL && styles.categoryCardContentRTL]}>
        <View style={[styles.categoryInfo, isRTL && { alignItems: 'flex-end' }]}>
          <Text style={[styles.categoryName, isRTL && styles.textRTL]}>
            {isRTL ? category.name_ar || category.name : category.name}
          </Text>
          {!isRTL && category.name_ar && (
            <Text style={styles.categoryNameAr}>{category.name_ar}</Text>
          )}
          {isRTL && category.name !== category.name_ar && (
            <Text style={styles.categoryNameAr}>{category.name}</Text>
          )}
          {category.description && (
            <Text style={[styles.categoryDescription, isRTL && styles.textRTL]} numberOfLines={1}>
              {category.description}
            </Text>
          )}
        </View>
        
        <View style={[styles.categoryActions, isRTL && styles.categoryActionsRTL]}>
          {isSystem ? (
            <View style={styles.systemBadge}>
              <Text style={styles.systemBadgeText}>{t('general', 'General')}</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleOpenModal(category)}
              >
                <Edit2 size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleDelete(category)}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header - scrolls with content */}
          <View style={[styles.header, isRTL && styles.headerRTL]}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => safeGoBack(navigation)}
            >
              <BackIcon size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{t('categories', 'Categories')}</Text>
              <Text style={styles.headerSubtitle}>{t('organizeMenuStructure', 'Organize your menu structure')}</Text>
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => handleOpenModal()}
            >
              <Plus size={20} color={colors.background} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchInputWrapper, isRTL && styles.searchInputWrapperRTL]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, isRTL && styles.textRTL]}
                placeholder={t('searchCategories', 'Search categories...')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                textAlign={isRTL ? 'right' : 'left'}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Filter Tabs */}
          <FilterTabs />
          {isLoading ? (
            <>
              <SectionSkeleton showHeader={true} itemCount={4} type="grid" />
              <SectionSkeleton showHeader={true} itemCount={2} type="grid" />
            </>
          ) : (filteredCategories || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <FolderTree size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('noCategoriesYet', 'No categories yet')}</Text>
              <Text style={styles.emptySubtitle}>{t('createFirstCategory', 'Get started by creating your first category')}</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => handleOpenModal()}>
                <Plus size={18} color={colors.background} />
                <Text style={styles.emptyButtonText}>{t('addCategory', 'Add Category')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* System Categories */}
              {(filter === 'all' || filter === 'system') && systemCategories.length > 0 && (
                <View style={styles.section}>
                  <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
                    <Globe size={16} color={colors.textSecondary} />
                    <Text style={styles.sectionTitle}>{t('generalCategories', 'General Categories')}</Text>
                    <Text style={styles.sectionCount}>({systemCategories.length})</Text>
                  </View>
                  <View style={styles.categoryGrid}>
                    {systemCategories.map((category) => (
                      <CategoryCard key={category.id} category={category} isSystem={true} />
                    ))}
                  </View>
                </View>
              )}

              {/* Custom Categories */}
              {(filter === 'all' || filter === 'custom') && customCategories.length > 0 && (
                <View style={styles.section}>
                  <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
                    <Building2 size={16} color={colors.textSecondary} />
                    <Text style={styles.sectionTitle}>{t('customCategories', 'Custom Categories')}</Text>
                    <Text style={styles.sectionCount}>({customCategories.length})</Text>
                  </View>
                  <View style={styles.categoryGrid}>
                    {customCategories.map((category) => (
                      <CategoryCard key={category.id} category={category} isSystem={false} />
                    ))}
                  </View>
                </View>
              )}

              {/* Empty custom categories message */}
              {(filter === 'all' || filter === 'custom') && customCategories.length === 0 && (
                <View style={styles.emptyCustom}>
                  <Text style={styles.emptyCustomText}>
                    {t('noCustomCategoriesYet', 'No custom categories yet. Create your own categories specific to your business.')}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Add/Edit Modal */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isRTL && styles.modalContentRTL]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={styles.modalTitle}>
                {editingCategory ? t('editCategory', 'Edit Category') : t('addCategory', 'Add Category')}
              </Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody}>
              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('categoryName', 'Category Name')} *
                </Text>
                <TextInput
                  style={[styles.formInput, isRTL && styles.textRTL]}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('egSignatureDishes', 'e.g., Signature Dishes')}
                  placeholderTextColor={colors.textSecondary}
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('arabicName', 'Arabic Name')}
                </Text>
                <TextInput
                  style={[styles.formInput, { textAlign: 'right' }]}
                  value={nameAr}
                  onChangeText={setNameAr}
                  placeholder={t('enterArabicName', 'Enter Arabic name')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('description', 'Description')}
                </Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea, isRTL && styles.textRTL]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('optionalDescription', 'Optional description...')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlign={isRTL ? 'right' : 'left'}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, isRTL && styles.modalFooterRTL]}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
                <Text style={styles.cancelButtonText}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting 
                    ? t('saving', 'Saving...') 
                    : editingCategory 
                      ? t('update', 'Update')
                      : t('create', 'Create')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInputWrapperRTL: {
    flexDirection: 'row-reverse',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterContainerRTL: {
    flexDirection: 'row-reverse',
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  filterTabActive: {
    backgroundColor: colors.text,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryCardContent: {
    flexDirection: 'column',
  },
  categoryCardContentRTL: {
    alignItems: 'flex-end',
  },
  categoryInfo: {
    flex: 1,
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  categoryNameAr: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  categoryDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryActionsRTL: {
    flexDirection: 'row-reverse',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  systemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  systemBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyCustom: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyCustomText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  textRTL: {
    textAlign: 'right',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: 20,
    maxHeight: '80%',
  },
  modalContentRTL: {},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  errorBanner: {
    backgroundColor: colors.error + '20',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTextarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    gap: 12,
  },
  modalFooterRTL: {
    flexDirection: 'row-reverse',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitButton: {
    backgroundColor: colors.text,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
});


