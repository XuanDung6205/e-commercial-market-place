
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/services/supabase';
import {
  addProduct,
  getCategories,
  CategoryOption,
} from '../../../src/services/admin/productService';

type ProductVariant = {
  id: number;
  color: string;
  size: string;
  stock: string;
};

type SelectedImage = {
  uri: string;
  name: string;
  mimeType: string;
};

const IMAGE_BUCKET = 'avatars';
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function AddProductScreen() {
  const router = useRouter();

  const [name, setName] = useState('Tai nghe không dây Air');
  const [category, setCategory] = useState('Điện tử');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [price, setPrice] = useState('890.000');
  const [discount, setDiscount] = useState('15');

  const [description, setDescription] = useState(
    'Âm thanh trong trẻo, kết nối Bluetooth 5.3. Pin sử dụng đến 30 giờ, đệm tai êm ái.',
  );

  const [variants, setVariants] = useState<ProductVariant[]>([
    {
      id: 1,
      color: 'Trắng',
      size: 'Tiêu chuẩn',
      stock: '48',
    },
  ]);

  const [images, setImages] = useState<SelectedImage[]>([]);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);

      if (data.length > 0) {
        const defaultCategory =
          data.find((item) => item.name === category) ?? data[0];

        setCategory(defaultCategory.name);
        setSelectedCategoryId(defaultCategory.id);

        const index = data.findIndex(
          (item) => item.id === defaultCategory.id,
        );

        setCategoryIndex(index >= 0 ? index : 0);
      }
    } catch (error: any) {
      console.error('Load categories error:', error);

      Alert.alert(
        'Lỗi',
        error?.message ?? 'Không thể tải danh mục sản phẩm.',
      );
    }
  };

  // ==================== IMAGE PICKER ====================

  const handleUploadImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Thông báo', `Chỉ được chọn tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Quyền truy cập',
          'Vui lòng cấp quyền truy cập thư viện ảnh để chọn hình sản phẩm.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const selected: SelectedImage[] = [];

      for (const asset of result.assets) {
        if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) {
          Alert.alert(
            'Ảnh quá lớn',
            `${asset.fileName ?? 'Ảnh đã chọn'} vượt quá 5 MB.`,
          );
          continue;
        }

        selected.push({
          uri: asset.uri,
          name:
            asset.fileName ??
            `product-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.jpg`,
          mimeType: asset.mimeType ?? 'image/jpeg',
        });
      }

      setImages((previous) =>
        [...previous, ...selected].slice(0, MAX_IMAGES),
      );
    } catch (error: any) {
      console.error('Pick image error:', error);
      Alert.alert('Lỗi', error?.message ?? 'Không thể chọn ảnh.');
    }
  };

  const removeImage = (uri: string) => {
    setImages((previous) => previous.filter((image) => image.uri !== uri));
  };

  // ==================== UPLOAD IMAGES ====================

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const image of images) {
      const response = await fetch(image.uri);
      const blob = await response.blob();

      const extension = image.name.split('.').pop()?.toLowerCase() || 'jpg';

      const filePath = `products/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(filePath, blob, {
          contentType: image.mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(filePath);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  // ==================== VARIANTS ====================

  const addVariant = () => {
    setVariants((previous) => [
      ...previous,
      {
        id: Date.now(),
        color: '',
        size: '',
        stock: '',
      },
    ]);
  };

  const updateVariant = (
    id: number,
    field: keyof Omit<ProductVariant, 'id'>,
    value: string,
  ) => {
    setVariants((previous) =>
      previous.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant,
      ),
    );
  };

  const removeVariant = (id: number) => {
    setVariants((previous) =>
      previous.filter((variant) => variant.id !== id),
    );
  };

  // ==================== CATEGORY ====================

  const handleCategoryPress = () => {
    if (categories.length === 0) {
      Alert.alert('Thông báo', 'Chưa có danh mục trong cơ sở dữ liệu.');
      return;
    }

    const nextIndex = (categoryIndex + 1) % categories.length;
    const nextCategory = categories[nextIndex];

    setCategoryIndex(nextIndex);
    setCategory(nextCategory.name);
    setSelectedCategoryId(nextCategory.id);
  };

  // ==================== SLUG ====================

  const createSlug = (value: string) => {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // ==================== SAVE PRODUCT ====================

  const handleSave = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);

      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!data.session) {
        Alert.alert(
          'Thông báo',
          'Bạn chưa đăng nhập bằng Supabase Auth.',
        );
        return;
      }

      if (!name.trim()) {
        Alert.alert('Thông báo', 'Vui lòng nhập tên sản phẩm.');
        return;
      }

      if (!selectedCategoryId) {
        Alert.alert(
          'Thông báo',
          'Vui lòng chọn danh mục sản phẩm hợp lệ.',
        );
        return;
      }

      const productPrice = Number(price.replace(/\D/g, ''));

      if (
        !price.trim() ||
        !Number.isFinite(productPrice) ||
        productPrice <= 0
      ) {
        Alert.alert('Thông báo', 'Vui lòng nhập giá sản phẩm hợp lệ.');
        return;
      }

      const discountValue = Number(discount || 0);

      if (
        !Number.isFinite(discountValue) ||
        discountValue < 0 ||
        discountValue > 100
      ) {
        Alert.alert(
          'Thông báo',
          'Phần trăm giảm giá phải nằm trong khoảng 0 đến 100.',
        );
        return;
      }

      if (variants.length === 0) {
        Alert.alert(
          'Thông báo',
          'Vui lòng thêm ít nhất một biến thể sản phẩm.',
        );
        return;
      }

      const invalidVariant = variants.some(
        (variant) =>
          !variant.color.trim() ||
          !variant.size.trim() ||
          !variant.stock.trim() ||
          !Number.isInteger(Number(variant.stock)) ||
          Number(variant.stock) < 0,
      );

      if (invalidVariant) {
        Alert.alert(
          'Thông báo',
          'Vui lòng nhập đầy đủ màu sắc, kích thước và số lượng tồn kho hợp lệ.',
        );
        return;
      }

      const compareAtPrice =
        discountValue > 0
          ? Math.round(
              (productPrice / (1 - discountValue / 100)) * 100,
            ) / 100
          : null;

      const totalStock = variants.reduce(
        (total, variant) => total + Number(variant.stock),
        0,
      );

      const slug = createSlug(name);
      const productSku = `SP-${Date.now()}`;

      // Upload ảnh trước khi tạo sản phẩm
      const imageUrls = await uploadImages();

      const productData = {
        category_id: selectedCategoryId,
        name: name.trim(),
        slug: `${slug}-${Date.now()}`,
        sku: productSku,
        description: description.trim() || null,
        price: productPrice,
        compare_at_price: compareAtPrice,
        stock_quantity: totalStock,
        status: 'active' as const,
        image_url: imageUrls[0] ?? null,

        variants: variants.map((variant, index) => ({
          sku: `${productSku}-${index + 1}`,
          color: variant.color.trim(),
          size: variant.size.trim(),
          stock_quantity: Number(variant.stock),
          price_override: null,
          is_active: true,
        })),
      };

      await addProduct(productData);

      router.replace('/(admin)/products');
    } catch (error: any) {
      console.error('Add product error:', error);

      Alert.alert(
        'Thêm sản phẩm thất bại',
        error?.message ??
          'Đã xảy ra lỗi khi lưu sản phẩm. Vui lòng thử lại.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Thêm sản phẩm</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Images */}
          <View style={styles.imageSection}>
            <TouchableOpacity
              style={styles.uploadBox}
              activeOpacity={0.7}
              onPress={handleUploadImage}
            >
              <Text style={styles.uploadIcon}>▧</Text>
              <Text style={styles.uploadTitle}>Thêm ảnh sản phẩm</Text>
              <Text style={styles.uploadDescription}>
                Tối đa 5 ảnh · JPG, PNG · 5 MB/ảnh
              </Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {images.map((image) => (
                  <View key={image.uri} style={styles.imagePreviewWrapper}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.imagePreview}
                    />

                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(image.uri)}
                    >
                      <Text style={styles.removeImageText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Tên</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nhập tên sản phẩm"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Category */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Danh mục</Text>

            <TouchableOpacity
              style={styles.categoryInput}
              onPress={handleCategoryPress}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryText}>{category}</Text>
              <Text style={styles.chevron}>⌄</Text>
            </TouchableOpacity>

            <Text style={styles.helperText}>
              Nhấn để chuyển danh mục
            </Text>
          </View>

          {/* Price */}
          <View style={styles.formGroup}>
            <View style={styles.row}>
              <View style={[styles.column, styles.leftColumn]}>
                <Text style={styles.label}>Giá</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.column}>
                <Text style={styles.label}>% giảm giá</Text>
                <TextInput
                  style={styles.input}
                  value={discount}
                  onChangeText={setDiscount}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Mô tả</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Nhập mô tả sản phẩm"
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Variants */}
          <View style={styles.variantSection}>
            <Text style={styles.sectionTitle}>Biến thể</Text>

            <View style={styles.variantHeader}>
              <Text style={styles.variantHeaderText}>Màu</Text>
              <Text style={styles.variantHeaderText}>Size</Text>
              <Text style={styles.variantHeaderText}>Tồn kho</Text>
              <View style={styles.removeColumn} />
            </View>

            {variants.map((variant) => (
              <View key={variant.id} style={styles.variantRow}>
                <TextInput
                  style={[styles.variantInput, styles.variantColor]}
                  value={variant.color}
                  onChangeText={(value) =>
                    updateVariant(variant.id, 'color', value)
                  }
                  placeholder="Trắng"
                  placeholderTextColor="#9CA3AF"
                />

                <TextInput
                  style={[styles.variantInput, styles.variantSize]}
                  value={variant.size}
                  onChangeText={(value) =>
                    updateVariant(variant.id, 'size', value)
                  }
                  placeholder="Size"
                  placeholderTextColor="#9CA3AF"
                />

                <TextInput
                  style={[styles.variantInput, styles.variantStock]}
                  value={variant.stock}
                  onChangeText={(value) =>
                    updateVariant(variant.id, 'stock', value)
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeVariant(variant.id)}
                >
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addVariantButton}
              onPress={addVariant}
              activeOpacity={0.7}
            >
              <Text style={styles.addVariantText}>+ Thêm biến thể</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Lưu sản phẩm</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 30,
    height: 40,
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 30,
    color: '#374151',
    lineHeight: 34,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#252B36',
    marginLeft: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  imageSection: {
    marginBottom: 10,
  },
  uploadBox: {
    minHeight: 74,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#60D9E8',
    borderRadius: 8,
    backgroundColor: '#F0FCFE',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  uploadIcon: {
    fontSize: 20,
    color: '#00BCD4',
    marginBottom: 2,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00AFC4',
  },
  uploadDescription: {
    fontSize: 9,
    color: '#8995A5',
    marginTop: 4,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginTop: 10,
    marginRight: 10,
  },
  imagePreview: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 21,
  },
  formGroup: {
    marginBottom: 9,
  },
  label: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 5,
  },
  input: {
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 7,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#374151',
    backgroundColor: '#FFFFFF',
  },
  categoryInput: {
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 12,
    color: '#374151',
  },
  chevron: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  helperText: {
    display: 'none',
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  leftColumn: {
    marginRight: 8,
  },
  descriptionInput: {
    height: 62,
    paddingTop: 9,
    lineHeight: 17,
  },
  variantSection: {
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
  },
  variantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  variantHeaderText: {
    flex: 1,
    fontSize: 10,
    color: '#9CA3AF',
  },
  removeColumn: {
    width: 20,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    gap: 5,
  },
  variantInput: {
    height: 32,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 7,
    fontSize: 11,
    color: '#374151',
  },
  variantColor: {
    flex: 1,
  },
  variantSize: {
    flex: 1.15,
  },
  variantStock: {
    flex: 0.85,
  },
  removeButton: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#EF4444',
    fontSize: 20,
  },
  addVariantButton: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
  },
  addVariantText: {
    fontSize: 11,
    color: '#00BCD4',
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    height: 42,
    borderRadius: 5,
    backgroundColor: '#06B6CB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
