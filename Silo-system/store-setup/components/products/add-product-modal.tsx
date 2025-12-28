'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Package, Search, ChevronDown, Layers, ImagePlus, Camera, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { getItems, type Item } from '@/lib/items-api';
import { createProduct, updateProductIngredients, getProduct, updateProduct, getProductAccessories, updateProductAccessories, type CreateProductData, type Product, type ProductAccessory, type AccessoryOrderType } from '@/lib/products-api';
import { getCategories, type Category } from '@/lib/categories-api';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface IngredientEntry {
  id: string;
  item_id: number | null;
  item?: Item;
  quantity: number;
  removable: boolean; // Can customer remove this ingredient?
}

interface VariantEntry {
  id: string;
  name: string;
  name_ar: string;
  price_adjustment: number;
  ingredients: IngredientEntry[];
}

interface ModifierEntry {
  id: string;
  item_id: number | null;
  item?: Item;
  quantity: number; // Quantity of the add-on
  extra_price: number; // Extra charge for this add-on
}

interface AccessoryEntry {
  id: string;
  item_id: number | null;
  item?: Item;
  quantity: number;
  applicable_order_types: AccessoryOrderType[];
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProduct?: any;
}

export function AddProductModal({ isOpen, onClose, onSuccess, editProduct }: AddProductModalProps) {
  const { t, isRTL, formatCurrency } = useLanguage();
  
  // Form state
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [taxRate, setTaxRate] = useState('0');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Ingredients state
  const [hasVariants, setHasVariants] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([]);
  const [variants, setVariants] = useState<VariantEntry[]>([]);
  const [modifiers, setModifiers] = useState<ModifierEntry[]>([]);
  const [accessories, setAccessories] = useState<AccessoryEntry[]>([]);
  
  // Items and categories for selection
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Filter items by type for ingredients (food) vs accessories (non-food)
  const foodItems = useMemo(() => items.filter(item => !item.item_type || item.item_type === 'food'), [items]);
  const nonFoodItems = useMemo(() => items.filter(item => item.item_type && item.item_type !== 'food'), [items]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fetch items and categories on mount
  useEffect(() => {
    if (isOpen) {
      loadItems();
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (editProduct) {
        setName(editProduct.name || '');
        setNameAr(editProduct.name_ar || '');
        setDescription(editProduct.description || '');
        setDescriptionAr(editProduct.description_ar || '');
        setPrice(editProduct.price?.toString() || '');
        setCategoryId(editProduct.category_id || null);
        setTaxRate(editProduct.tax_rate?.toString() || '0');
        setHasVariants(editProduct.has_variants || false);
        setImageUrl(editProduct.image_url || null);
        setImagePreview(editProduct.image_url || null);
        
        // Load ingredients/variants from API
        loadProductIngredients(editProduct.id);
      } else {
        resetForm();
      }
    }
  }, [isOpen, editProduct]);

  // Load product ingredients when editing
  const loadProductIngredients = async (productId: number) => {
    setIsLoadingIngredients(true);
    try {
      const productData = await getProduct(productId);
      if (!productData) return;

      // Map variants with their ingredients
      if (productData.has_variants && productData.variants) {
        const mappedVariants: VariantEntry[] = productData.variants.map((v) => ({
          id: generateId(),
          name: v.name,
          name_ar: v.name_ar || '',
          price_adjustment: v.price_adjustment || 0,
          ingredients: (v.ingredients || []).map((ing) => {
            // Find the item in our items list to get full item data
            const item = items.find(i => i.id === ing.item_id);
            return {
              id: generateId(),
              item_id: ing.item_id,
              item: item || {
                id: ing.item_id,
                name: ing.item_name || '',
                name_ar: ing.item_name_ar,
                unit: ing.unit || '',
                cost_per_unit: ing.cost_per_unit || 0,
                category: 'other' as const,
              },
              quantity: ing.quantity,
              removable: ing.removable || false,
            };
          }),
        }));
        setVariants(mappedVariants);
        setIngredients([]);
      } else if (productData.ingredients) {
        // Map simple ingredients (no variants)
        const mappedIngredients: IngredientEntry[] = productData.ingredients.map((ing) => {
          const item = items.find(i => i.id === ing.item_id);
          return {
            id: generateId(),
            item_id: ing.item_id,
            item: item || {
              id: ing.item_id,
              name: ing.item_name || '',
              name_ar: ing.item_name_ar,
              unit: ing.unit || '',
              cost_per_unit: ing.cost_per_unit || 0,
              category: 'other' as const,
            },
            quantity: ing.quantity,
            removable: ing.removable || false,
          };
        });
        setIngredients(mappedIngredients);
        setVariants([]);
      }

      // Load modifiers (addable extras - from items)
      if (productData.modifiers && productData.modifiers.length > 0) {
        const mappedModifiers: ModifierEntry[] = productData.modifiers.map((m: any) => {
          const item = items.find(i => i.id === m.item_id);
          return {
            id: generateId(),
            item_id: m.item_id,
            item: item || (m.item_id ? {
              id: m.item_id,
              name: m.name || '',
              name_ar: m.name_ar,
              unit: 'piece' as const,
              cost_per_unit: 0,
              category: 'other' as const,
            } : undefined),
            quantity: m.quantity || 1,
            extra_price: m.extra_price || 0,
          };
        });
        setModifiers(mappedModifiers);
      } else {
        setModifiers([]);
      }

      // Load accessories (non-food items linked to product)
      try {
        const accessoriesData = await getProductAccessories(productId);
        if (accessoriesData && accessoriesData.length > 0) {
          const mappedAccessories: AccessoryEntry[] = accessoriesData.map((acc) => {
            const item = items.find(i => i.id === acc.item_id);
            return {
              id: generateId(),
              item_id: acc.item_id,
              item: item || (acc.item ? {
                id: acc.item.id,
                name: acc.item.name,
                name_ar: acc.item.name_ar,
                unit: acc.item.unit as any,
                cost_per_unit: acc.item.cost_per_unit || 0,
                category: 'other' as const,
                item_type: acc.item.item_type as any,
              } : undefined),
              quantity: acc.quantity,
              applicable_order_types: acc.applicable_order_types || ['always'],
            };
          });
          setAccessories(mappedAccessories);
        } else {
          setAccessories([]);
        }
      } catch (err) {
        console.error('Failed to load product accessories:', err);
        setAccessories([]);
      }
    } catch (err) {
      console.error('Failed to load product ingredients:', err);
    } finally {
      setIsLoadingIngredients(false);
    }
  };

  const resetForm = () => {
    setName('');
    setNameAr('');
    setDescription('');
    setDescriptionAr('');
    setPrice('');
    setCategoryId(null);
    setTaxRate('0');
    setHasVariants(false);
    setIngredients([]);
    setVariants([]);
    setModifiers([]);
    setAccessories([]);
    setError(null);
    setImageUrl(null);
    setImagePreview(null);
  };

  // Accessory functions
  const addAccessory = () => {
    setAccessories([...accessories, { 
      id: generateId(), 
      item_id: null,
      quantity: 1,
      applicable_order_types: ['always'],
    }]);
  };

  const removeAccessory = (id: string) => {
    setAccessories(accessories.filter(a => a.id !== id));
  };

  const updateAccessory = (id: string, updates: Partial<AccessoryEntry>) => {
    setAccessories(accessories.map(a => 
      a.id === id ? { ...a, ...updates } : a
    ));
  };

  const selectItemForAccessory = (accessoryId: string, item: Item) => {
    updateAccessory(accessoryId, { item_id: item.id, item });
    setActiveDropdown(null);
    setSearchQuery('');
  };

  const toggleOrderType = (accessoryId: string, orderType: AccessoryOrderType) => {
    const accessory = accessories.find(a => a.id === accessoryId);
    if (!accessory) return;

    let newTypes = [...accessory.applicable_order_types];
    
    if (orderType === 'always') {
      // If clicking 'always', set to only 'always'
      newTypes = ['always'];
    } else {
      // Remove 'always' if it exists
      newTypes = newTypes.filter(t => t !== 'always');
      
      if (newTypes.includes(orderType)) {
        // Remove the type if it exists
        newTypes = newTypes.filter(t => t !== orderType);
        // If no types left, default to 'always'
        if (newTypes.length === 0) {
          newTypes = ['always'];
        }
      } else {
        // Add the type
        newTypes.push(orderType);
      }
    }
    
    updateAccessory(accessoryId, { applicable_order_types: newTypes });
  };

  // Modifier functions (addable extras only)
  const addModifier = () => {
    setModifiers([...modifiers, { 
      id: generateId(), 
      item_id: null,
      quantity: 1,
      extra_price: 0
    }]);
  };

  const removeModifier = (id: string) => {
    setModifiers(modifiers.filter(m => m.id !== id));
  };

  const updateModifier = (id: string, updates: Partial<ModifierEntry>) => {
    setModifiers(modifiers.map(m => 
      m.id === id ? { ...m, ...updates } : m
    ));
  };

  // Select item for modifier
  const selectItemForModifier = (modifierId: string, item: Item) => {
    updateModifier(modifierId, { item_id: item.id, item });
    setActiveDropdown(null);
    setSearchQuery('');
  };

  const loadItems = async () => {
    try {
      const data = await getItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  };

  const generateId = () => Math.random().toString(36).substring(7);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('Please select an image file', 'يرجى اختيار ملف صورة'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError(t('Image must be less than 5MB', 'يجب أن تكون الصورة أقل من 5 ميجابايت'));
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImageUrl(base64String);
      setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  // Remove image
  const handleRemoveImage = () => {
    setImageUrl(null);
    setImagePreview(null);
  };

  // Add ingredient to product (no variants)
  const addIngredient = () => {
    setIngredients([...ingredients, { id: generateId(), item_id: null, quantity: 0, removable: false }]);
  };

  // Remove ingredient
  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  // Update ingredient
  const updateIngredient = (id: string, updates: Partial<IngredientEntry>) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, ...updates } : ing
    ));
  };

  // Select item for ingredient
  const selectItemForIngredient = (ingredientId: string, item: Item) => {
    updateIngredient(ingredientId, { item_id: item.id, item });
    setActiveDropdown(null);
    setSearchQuery('');
  };

  // Add variant
  const addVariant = () => {
    setVariants([...variants, { 
      id: generateId(), 
      name: '', 
      name_ar: '', 
      price_adjustment: 0,
      ingredients: [] 
    }]);
  };

  // Remove variant
  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  // Update variant
  const updateVariant = (id: string, updates: Partial<VariantEntry>) => {
    setVariants(variants.map(v => 
      v.id === id ? { ...v, ...updates } : v
    ));
  };

  // Add ingredient to variant
  const addVariantIngredient = (variantId: string) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        return { ...v, ingredients: [...v.ingredients, { id: generateId(), item_id: null, quantity: 0, removable: false }] };
      }
      return v;
    }));
  };

  // Remove ingredient from variant
  const removeVariantIngredient = (variantId: string, ingredientId: string) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        return { ...v, ingredients: v.ingredients.filter(ing => ing.id !== ingredientId) };
      }
      return v;
    }));
  };

  // Update variant ingredient
  const updateVariantIngredient = (variantId: string, ingredientId: string, updates: Partial<IngredientEntry>) => {
    setVariants(variants.map(v => {
      if (v.id === variantId) {
        return {
          ...v,
          ingredients: v.ingredients.map(ing =>
            ing.id === ingredientId ? { ...ing, ...updates } : ing
          )
        };
      }
      return v;
    }));
  };

  // Select item for variant ingredient
  const selectItemForVariantIngredient = (variantId: string, ingredientId: string, item: Item) => {
    updateVariantIngredient(variantId, ingredientId, { item_id: item.id, item });
    setActiveDropdown(null);
    setSearchQuery('');
  };

  /**
   * Calculate cost for a set of ingredients - FORM PREVIEW ONLY
   * Backend calculates and returns actual cost/margin when product is saved
   * Item prices (effective_price) come from backend API
   */
  const calculateCost = (ings: IngredientEntry[]) => {
    return ings.reduce((sum, ing) => {
      if (!ing.item) return sum;
      const itemPrice = (ing.item as any).effective_price || ing.item.cost_per_unit || 0;
      return sum + (ing.quantity * itemPrice);
    }, 0);
  };


  // Handle submit
  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!name.trim()) {
      setError(t('Product name is required', 'اسم المنتج مطلوب'));
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      setError(t('Valid price is required', 'السعر الصحيح مطلوب'));
      return;
    }
    if (!categoryId) {
      setError(t('Category is required', 'الفئة مطلوبة'));
      return;
    }

    if (hasVariants) {
      if (variants.length === 0) {
        setError(t('Add at least one variant', 'أضف صنف واحد على الأقل'));
        return;
      }
      for (const v of variants) {
        if (!v.name.trim()) {
          setError(t('All variants must have a name', 'يجب أن يكون لكل صنف اسم'));
          return;
        }
        // Check that each variant has at least one ingredient
        const validIngredients = v.ingredients.filter(ing => ing.item_id && ing.quantity > 0);
        if (validIngredients.length === 0) {
          setError(t(`Variant "${v.name}" must have at least one ingredient`, `الصنف "${v.name}" يجب أن يحتوي على مكون واحد على الأقل`));
          return;
        }
      }
    } else {
      // For products without variants, require at least one ingredient
      const validIngredients = ingredients.filter(ing => ing.item_id && ing.quantity > 0);
      if (validIngredients.length === 0) {
        setError(t('Add at least one ingredient with quantity', 'أضف مكون واحد على الأقل مع الكمية'));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const productData: CreateProductData = {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        description: description.trim() || undefined,
        description_ar: descriptionAr.trim() || undefined,
        category_id: categoryId,
        price: parseFloat(price),
        tax_rate: parseFloat(taxRate) || 0,
        has_variants: hasVariants,
        image_url: imageUrl || undefined,
      };

      if (hasVariants) {
        productData.variants = variants.map(v => ({
          name: v.name,
          name_ar: v.name_ar || undefined,
          price_adjustment: v.price_adjustment,
          ingredients: v.ingredients
            .filter(ing => ing.item_id)
            .map(ing => ({ item_id: ing.item_id!, quantity: ing.quantity, removable: ing.removable })),
        }));
      } else {
        productData.ingredients = ingredients
          .filter(ing => ing.item_id)
          .map(ing => ({ item_id: ing.item_id!, quantity: ing.quantity, removable: ing.removable }));
      }

      // Add modifiers (addable extras only - from items)
      if (modifiers.length > 0) {
        productData.modifiers = modifiers
          .filter(m => m.item_id)
          .map(m => ({
            item_id: m.item_id!,
            name: m.item?.name || '',
            name_ar: m.item?.name_ar || undefined,
            removable: false, // Modifiers are always addable, not removable
            addable: true,    // Modifiers are always addable
            quantity: m.quantity || 1,
            extra_price: m.extra_price || 0,
          }));
      }

      let productId: number;

      if (editProduct) {
        // Update existing product
        await updateProduct(editProduct.id, productData);
        productId = editProduct.id;
      } else {
        // Create new product
        const product = await createProduct(productData);
        productId = product.id;
      }

      // Prepare modifiers data for the API
      const modifiersData = modifiers
        .filter(m => m.item_id)
        .map(m => ({
          item_id: m.item_id!,
          name: m.item?.name || '',
          name_ar: m.item?.name_ar || undefined,
          quantity: m.quantity || 1,
          extra_price: m.extra_price || 0,
        }));

      // Then update ingredients and modifiers
      if (hasVariants && productData.variants) {
        await updateProductIngredients(productId, {
          has_variants: true,
          variants: productData.variants,
          modifiers: modifiersData.length > 0 ? modifiersData : undefined,
        });
      } else {
        await updateProductIngredients(productId, {
          has_variants: false,
          ingredients: productData.ingredients || [],
          modifiers: modifiersData.length > 0 ? modifiersData : undefined,
        });
      }

      // Update accessories (non-food items like packaging)
      const validAccessories = accessories.filter(a => a.item_id && a.quantity > 0);
      if (validAccessories.length > 0) {
        await updateProductAccessories(productId, validAccessories.map(a => ({
          item_id: a.item_id!,
          quantity: a.quantity,
          applicable_order_types: a.applicable_order_types,
        })));
      } else {
        // Clear accessories if none are set
        await updateProductAccessories(productId, []);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || t('Failed to save product', 'فشل في حفظ المنتج'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Item dropdown component
  const ItemDropdown = ({ 
    ingredientId, 
    variantId,
    selectedItem,
    onSelect,
    itemsList,
    placeholder,
  }: { 
    ingredientId: string; 
    variantId?: string;
    selectedItem?: Item;
    onSelect: (item: Item) => void;
    itemsList?: Item[];
    placeholder?: string;
  }) => {
    const dropdownId = variantId ? `${variantId}-${ingredientId}` : ingredientId;
    const isOpen = activeDropdown === dropdownId;
    
    // Use provided items list or default to all items
    const availableItems = itemsList || items;
    const searchedItems = availableItems.filter(item => {
      const query = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(query) || 
             (item.name_ar && item.name_ar.includes(query));
    });

    return (
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => {
            setActiveDropdown(isOpen ? null : dropdownId);
            setSearchQuery('');
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
        >
          <span className={selectedItem ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}>
            {selectedItem 
              ? (isRTL ? selectedItem.name_ar || selectedItem.name : selectedItem.name)
              : (placeholder || t('Select item', 'اختر عنصر'))}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl"
            >
              <div className="sticky top-0 p-2 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('Search items...', 'البحث في العناصر...')}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="py-1">
                {searchedItems.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                    {t('No items found', 'لم يتم العثور على عناصر')}
                  </div>
                ) : (
                  searchedItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <Package className="w-4 h-4 text-zinc-400" />
                      <div className="flex-1 text-left">
                        <div className="text-zinc-900 dark:text-white">
                          {isRTL ? item.name_ar || item.name : item.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {((item as any).effective_price || item.cost_per_unit || 0).toFixed(3)} / {item.unit}
                          {item.item_type && item.item_type !== 'food' && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                              {item.item_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (!isOpen) return null;

  const totalCost = hasVariants
    ? variants.reduce((sum, v) => sum + calculateCost(v.ingredients), 0) / Math.max(variants.length, 1)
    : calculateCost(ingredients);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
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
              {editProduct ? t('Edit Product', 'تعديل المنتج') : t('Add Product', 'إضافة منتج')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6 overscroll-contain">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('Product Name', 'اسم المنتج')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('Enter product name', 'أدخل اسم المنتج')}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('Arabic Name', 'الاسم بالعربي')}
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={t('Enter Arabic name', 'أدخل الاسم بالعربي')}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Price and Category */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('Price', 'السعر')} *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setPrice(val);
                    }
                  }}
                  placeholder="0.000"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('Tax Rate %', 'نسبة الضريبة %')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={taxRate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setTaxRate(val);
                    }
                  }}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>
              <SearchableSelect
                label={`${t('Category', 'الفئة')} *`}
                value={categoryId}
                onChange={(val) => setCategoryId(val ? Number(val) : null)}
                options={[
                  ...categories.filter(c => c.is_system).map((cat) => ({
                    id: cat.id,
                    name: `${isRTL ? cat.name_ar || cat.name : cat.name} (${t('General', 'عام')})`,
                  })),
                  ...categories.filter(c => !c.is_system).map((cat) => ({
                    id: cat.id,
                    name: isRTL ? cat.name_ar || cat.name : cat.name,
                  })),
                ]}
                placeholder={t('Select category', 'اختر الفئة')}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t('Description', 'الوصف')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('Product description...', 'وصف المنتج...')}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
              />
            </div>

            {/* Product Image */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                {t('Product Image', 'صورة المنتج')}
              </label>
              <div className="flex items-start gap-4">
                {/* Image Preview */}
                <div className="relative w-32 h-32 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 overflow-hidden bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center">
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <Camera className="w-8 h-8 mx-auto text-zinc-400 mb-1" />
                      <span className="text-xs text-zinc-500">{t('No image', 'لا توجد صورة')}</span>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex-1">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                      <ImagePlus className="w-5 h-5 text-zinc-500" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {imagePreview 
                          ? t('Change Image', 'تغيير الصورة') 
                          : t('Upload Image', 'رفع صورة')}
                      </span>
                    </div>
                  </label>
                  <p className="text-xs text-zinc-500 mt-2">
                    {t('PNG, JPG, or WEBP. Max 5MB.', 'PNG أو JPG أو WEBP. الحد الأقصى 5 ميجابايت.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Variants Section */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {t('Product Variants', 'أصناف المنتج')}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {t('(e.g., Small, Medium, Large)', '(مثال: صغير، وسط، كبير)')}
                  </span>
                </div>
                
                {/* Has Variants Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t('Enable Variants', 'تفعيل الأصناف')}
                  </span>
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => {
                      setHasVariants(e.target.checked);
                      if (e.target.checked && variants.length === 0) {
                        addVariant();
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-500 transition-colors">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>
              </div>

              {hasVariants && (
                <div className="space-y-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                  {variants.map((variant, vIndex) => (
                    <div key={variant.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-medium text-zinc-500 uppercase">
                          {t('Variant', 'صنف')} {vIndex + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => updateVariant(variant.id, { name: e.target.value })}
                          placeholder={t('Name (e.g., Medium)', 'الاسم (مثال: وسط)')}
                          className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                        <input
                          type="text"
                          value={variant.name_ar}
                          onChange={(e) => updateVariant(variant.id, { name_ar: e.target.value })}
                          placeholder={t('Arabic', 'بالعربي')}
                          dir="rtl"
                          className="w-28 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={variant.price_adjustment || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                              updateVariant(variant.id, { price_adjustment: val === '' ? 0 : parseFloat(val) || 0 });
                            }
                          }}
                          placeholder={t('+/- Price', '+/- السعر')}
                          className="w-24 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeVariant(variant.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 transition-colors w-full justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Add Variant', 'إضافة صنف')}
                  </button>
                </div>
              )}

              {!hasVariants && (
                <p className="text-sm text-zinc-500 italic">
                  {t('Enable variants if this product has multiple sizes or options with different prices.', 
                     'فعّل الأصناف إذا كان هذا المنتج له أحجام أو خيارات متعددة بأسعار مختلفة.')}
                </p>
              )}
            </div>

            {/* Ingredients/Recipe Section */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                <span className="font-medium text-zinc-900 dark:text-white">
                  {t('Ingredients (Recipe)', 'المكونات (الوصفة)')} *
                </span>
              </div>

              {!hasVariants ? (
                /* No Variants - Simple Ingredients List */
                <div className="space-y-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                  {ingredients.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      {t('No ingredients added. At least one ingredient is required.', 
                         'لم تتم إضافة مكونات. مطلوب مكون واحد على الأقل.')}
                    </p>
                  ) : (
                    ingredients.map((ing, index) => (
                      <div key={ing.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                        <ItemDropdown
                          ingredientId={ing.id}
                          selectedItem={ing.item}
                          onSelect={(item) => selectItemForIngredient(ing.id, item)}
                          itemsList={foodItems}
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ing.quantity ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateIngredient(ing.id, { quantity: val === '' ? 0 : parseFloat(val) });
                            }
                          }}
                          placeholder={t('Qty', 'الكمية')}
                          step="0.001"
                          min="0"
                          className="w-20 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                        {ing.item && (
                          <span className="text-xs text-zinc-500 w-12">
                            {ing.item.unit}
                          </span>
                        )}
                        <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={ing.removable}
                            onChange={(e) => updateIngredient(ing.id, { removable: e.target.checked })}
                            className="rounded border-zinc-300"
                          />
                          {t('Removable', 'قابل للإزالة')}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeIngredient(ing.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={addIngredient}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 transition-colors w-full justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Add Ingredient', 'إضافة مكون')}
                  </button>

                  {ingredients.length > 0 && (
                    <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {t('Total Cost:', 'التكلفة الإجمالية:')} 
                        <span className="font-semibold text-zinc-900 dark:text-white ml-2">
                          {formatCurrency(totalCost)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* With Variants - Each variant has its own ingredients */
                <div className="space-y-4">
                  <p className="text-sm text-zinc-500 mb-4">
                    {t('Add ingredients for each variant separately:', 'أضف المكونات لكل صنف بشكل منفصل:')}
                  </p>
                  
                  {variants.map((variant, vIndex) => (
                    <div key={variant.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {variant.name || `${t('Variant', 'صنف')} ${vIndex + 1}`}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {t('ingredients', 'المكونات')}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {variant.ingredients.map((ing) => (
                          <div key={ing.id} className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                            <ItemDropdown
                              ingredientId={ing.id}
                              variantId={variant.id}
                              selectedItem={ing.item}
                              onSelect={(item) => selectItemForVariantIngredient(variant.id, ing.id, item)}
                              itemsList={foodItems}
                            />
                            <input
                              type="text"
                              inputMode="decimal"
                              value={ing.quantity ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  updateVariantIngredient(variant.id, ing.id, { quantity: val === '' ? 0 : parseFloat(val) });
                                }
                              }}
                              placeholder={t('Qty', 'الكمية')}
                              className="w-16 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                            />
                            {ing.item && (
                              <span className="text-xs text-zinc-500 w-10">
                                {ing.item.unit}
                              </span>
                            )}
                            <label className="flex items-center gap-1 text-xs text-zinc-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ing.removable}
                                onChange={(e) => updateVariantIngredient(variant.id, ing.id, { removable: e.target.checked })}
                                className="rounded border-zinc-300 w-3 h-3"
                              />
                              {t('Rem', 'إزالة')}
                            </label>
                            <button
                              type="button"
                              onClick={() => removeVariantIngredient(variant.id, ing.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addVariantIngredient(variant.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 transition-colors w-full justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {t('Add Ingredient', 'إضافة مكون')}
                        </button>
                      </div>

                      {variant.ingredients.length > 0 && (
                        <div className="flex justify-end mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                          <span className="text-xs text-zinc-500">
                            {t('Cost:', 'التكلفة:')} 
                            <span className="font-medium text-zinc-700 dark:text-zinc-300 ml-1">
                              {formatCurrency(calculateCost(variant.ingredients))}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modifiers Section - Addable Extras Only */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Plus className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                <span className="font-medium text-zinc-900 dark:text-white">
                  {t('Add-ons (Extra Items)', 'الإضافات')}
                </span>
              </div>
              <p className="text-sm text-zinc-500 mb-4">
                {t('Extra items customers can add with additional charge (e.g., Extra Cheese +0.500)', 
                   'عناصر إضافية يمكن للعملاء إضافتها مقابل رسوم إضافية (مثال: جبن إضافي +0.500)')}
              </p>

              <div className="space-y-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                {modifiers.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    {t('No add-ons configured. Add extras that customers can order.', 
                       'لم يتم تكوين إضافات. أضف عناصر إضافية يمكن للعملاء طلبها.')}
                  </p>
                ) : (
                  modifiers.map((mod) => (
                    <div key={mod.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <ItemDropdown
                        ingredientId={mod.id}
                        variantId="modifier"
                        selectedItem={mod.item}
                        onSelect={(item) => selectItemForModifier(mod.id, item)}
                        itemsList={foodItems}
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={mod.quantity ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateModifier(mod.id, { quantity: val === '' ? 1 : parseFloat(val) });
                            }
                          }}
                          placeholder={t('Qty', 'الكمية')}
                          className="w-16 px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                        {mod.item && (
                          <span className="text-xs text-zinc-500 w-12">
                            {mod.item.unit}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-zinc-500">+</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={mod.extra_price ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateModifier(mod.id, { extra_price: val === '' ? 0 : parseFloat(val) });
                            }
                          }}
                          placeholder="0.000"
                          className="w-24 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeModifier(mod.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={addModifier}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 transition-colors w-full justify-center"
                >
                  <Plus className="w-4 h-4" />
                  {t('Add Extra Item', 'إضافة عنصر إضافي')}
                </button>
              </div>
            </div>

            {/* Accessories Section - Non-Food Items (Packaging, Supplies) */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <ShoppingBag className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                <span className="font-medium text-zinc-900 dark:text-white">
                  {t('Accessories (Packaging & Supplies)', 'الملحقات (التعبئة والمستلزمات)')}
                </span>
              </div>
              <p className="text-sm text-zinc-500 mb-4">
                {t('Non-food items to deduct from inventory when this product is sold (e.g., cups, boxes, napkins)', 
                   'المواد غير الغذائية التي يتم خصمها من المخزون عند بيع هذا المنتج (مثال: أكواب، علب، مناديل)')}
              </p>

              <div className="space-y-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                {nonFoodItems.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400 text-center py-4">
                    {t('No non-food items available. Create packaging or supply items first in the Items section.', 
                       'لا توجد مواد غير غذائية متاحة. قم بإنشاء مواد التعبئة أو المستلزمات أولاً في قسم المواد.')}
                  </p>
                ) : accessories.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    {t('No accessories configured. Add packaging or supplies that should be deducted when sold.', 
                       'لم يتم تكوين ملحقات. أضف التعبئة أو المستلزمات التي يجب خصمها عند البيع.')}
                  </p>
                ) : (
                  accessories.map((acc) => (
                    <div key={acc.id} className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-3 mb-3">
                        <ItemDropdown
                          ingredientId={acc.id}
                          variantId="accessory"
                          selectedItem={acc.item}
                          onSelect={(item) => selectItemForAccessory(acc.id, item)}
                          itemsList={nonFoodItems}
                          placeholder={t('Select packaging/supply item', 'اختر مادة تعبئة/مستلزم')}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={acc.quantity ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              updateAccessory(acc.id, { quantity: val === '' ? 1 : parseInt(val) });
                            }
                          }}
                          placeholder={t('Qty', 'الكمية')}
                          min="1"
                          className="w-20 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                        {acc.item && (
                          <span className="text-xs text-zinc-500 w-12">
                            {acc.item.unit}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAccessory(acc.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Order type toggles */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-zinc-500 self-center">
                          {t('Deduct for:', 'خصم عند:')}
                        </span>
                        {(['always', 'dine_in', 'takeaway', 'delivery'] as AccessoryOrderType[]).map((orderType) => (
                          <button
                            key={orderType}
                            type="button"
                            onClick={() => toggleOrderType(acc.id, orderType)}
                            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                              acc.applicable_order_types.includes(orderType)
                                ? 'bg-amber-500 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                            }`}
                          >
                            {orderType === 'always' && t('Always', 'دائماً')}
                            {orderType === 'dine_in' && t('Dine-in', 'محلي')}
                            {orderType === 'takeaway' && t('Takeaway', 'سفري')}
                            {orderType === 'delivery' && t('Delivery', 'توصيل')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}

                {nonFoodItems.length > 0 && (
                  <button
                    type="button"
                    onClick={addAccessory}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 transition-colors w-full justify-center"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Add Accessory', 'إضافة ملحق')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <button
              onClick={onClose}
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
                : editProduct 
                  ? t('Update Product', 'تحديث المنتج')
                  : t('Create Product', 'إنشاء المنتج')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

