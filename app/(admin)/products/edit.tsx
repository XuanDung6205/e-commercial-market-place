
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../src/services/supabase';

const IMAGE_BUCKET = 'avatars';
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string | null;
  sku: string | null;
  description: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  status: string;
};

type Category = {
  id: string;
  name: string;
};

type SelectedImage = {
  uri: string;
  name: string;
  mimeType: string;
};

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
};

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
}: InputFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{
    productId: string;
  }>();

  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [stock, setStock] = useState('');

  const [isActive, setIsActive] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ảnh hiện có trên sản phẩm
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  // Ảnh mới được chọn từ thiết bị
  const [newImages, setNewImages] = useState<SelectedImage[]>([]);

  // Quay về trang quản lý sản phẩm
  const goToProductManagement = useCallback(() => {
    router.replace('/(admin)/products');
  }, []);

  // ==================== LOAD PRODUCT ====================

  const loadProduct = useCallback(async () => {
    if (!productId || Array.isArray(productId)) {
      Alert.alert('Lỗi', 'Không nhận được mã sản phẩm.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [
        { data: product, error: productError },
        { data: categoryData, error: categoryError },
        { data: variantData, error: variantError },
        { data: imageData, error: imageError },
      ] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single(),

        supabase
          .from('categories')
          .select('id, name')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),

        supabase
          .from('product_variants')
          .select('color, size')
          .eq('product_id', productId)
          .eq('is_active', true),

        supabase
          .from('product_images')
          .select('image_url')
          .eq('product_id', productId)
          .order('sort_order', { ascending: true }),
      ]);

      if (productError) throw productError;
      if (categoryError) throw categoryError;
      if (variantError) throw variantError;

      const currentProduct = product as Product;
      const currentCategories = categoryData ?? [];

      setProductName(currentProduct.name ?? '');
      setProductCode(currentProduct.sku ?? '');
      setDescription(currentProduct.description ?? '');

      setPrice(
        currentProduct.compare_at_price != null
          ? String(currentProduct.compare_at_price)
          : '',
      );

      setSalePrice(
        currentProduct.price != null
          ? String(currentProduct.price)
          : '',
      );

      setStock(String(currentProduct.stock_quantity ?? 0));
      setIsActive(currentProduct.status === 'active');

      setCategories(currentCategories);

      const currentCategory = currentCategories.find(
        (item) => item.id === currentProduct.category_id,
      );

      setCategory(currentCategory?.name ?? '');

      const colors = Array.from(
        new Set(
          (variantData ?? [])
            .map((item) => item.color)
            .filter((item): item is string => Boolean(item)),
        ),
      );

      const sizes = Array.from(
        new Set(
          (variantData ?? [])
            .map((item) => item.size)
            .filter((item): item is string => Boolean(item)),
        ),
      );

      setColor(colors.join(', '));
      setSize(sizes.join(', '));

      const tableImageUrls =
        !imageError && imageData
          ? imageData
              .map((item) => item.image_url)
              .filter((url): url is string => Boolean(url))
          : [];

      setExistingImageUrls(tableImageUrls);
    } catch (error: any) {
      console.error('Load product error:', error);

      Alert.alert(
        'Lỗi',
        error?.message || 'Không thể tải thông tin sản phẩm.',
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // ==================== IMAGE PICKER ====================

  const handlePickImages = async () => {
    const currentCount = existingImageUrls.length + newImages.length;

    if (currentCount >= MAX_IMAGES) {
      Alert.alert('Thông báo', `Chỉ được chọn tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Quyền truy cập',
          'Vui lòng cấp quyền truy cập thư viện ảnh.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - currentCount,
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

      setNewImages((previous) =>
        [...previous, ...selected].slice(
          0,
          MAX_IMAGES - existingImageUrls.length,
        ),
      );
    } catch (error: any) {
      console.error('Pick image error:', error);
      Alert.alert('Lỗi', error?.message ?? 'Không thể chọn ảnh.');
    }
  };

  const removeExistingImage = (url: string) => {
    setExistingImageUrls((previous) =>
      previous.filter((imageUrl) => imageUrl !== url),
    );
  };

  const removeNewImage = (uri: string) => {
    setNewImages((previous) =>
      previous.filter((image) => image.uri !== uri),
    );
  };

  // ==================== UPLOAD NEW IMAGES ====================

  const uploadNewImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const image of newImages) {
      const response = await fetch(image.uri);
      const blob = await response.blob();

      const extension =
        image.name.split('.').pop()?.toLowerCase() || 'jpg';

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

  // ==================== SAVE PRODUCT ====================

  const handleSave = async () => {
    if (saving) return;

    if (!productId || Array.isArray(productId)) {
      Alert.alert('Lỗi', 'Không tìm thấy mã sản phẩm.');
      return;
    }

    if (!productName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên sản phẩm!');
      return;
    }

    if (
      !price.trim() ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0
    ) {
      Alert.alert('Thông báo', 'Giá gốc không hợp lệ!');
      return;
    }

    if (
      salePrice.trim() &&
      (!Number.isFinite(Number(salePrice)) ||
        Number(salePrice) <= 0)
    ) {
      Alert.alert('Thông báo', 'Giá bán không hợp lệ!');
      return;
    }

    if (salePrice.trim() && Number(salePrice) > Number(price)) {
      Alert.alert(
        'Thông báo',
        'Giá bán không được lớn hơn giá gốc!',
      );
      return;
    }

    if (
      !stock.trim() ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0
    ) {
      Alert.alert('Thông báo', 'Số lượng tồn kho không hợp lệ!');
      return;
    }

    try {
      setSaving(true);

      const selectedCategory = categories.find(
        (item) =>
          item.name.trim().toLowerCase() ===
          category.trim().toLowerCase(),
      );

      if (category.trim() && !selectedCategory) {
        Alert.alert(
          'Thông báo',
          'Danh mục không tồn tại. Vui lòng nhập đúng tên danh mục.',
        );
        return;
      }

      const originalPrice = Number(price);

      const sellingPrice = salePrice.trim()
        ? Number(salePrice)
        : originalPrice;

      // Upload ảnh mới được chọn
      const uploadedUrls = await uploadNewImages();

      // Ảnh cũ được giữ lại + ảnh mới
      const finalImageUrls = [
        ...existingImageUrls,
        ...uploadedUrls,
      ].slice(0, MAX_IMAGES);

      // Cập nhật thông tin sản phẩm
      // Không truyền image_url vào bảng products
      const updateData = {
        name: productName.trim(),
        sku: productCode.trim() || null,
        category_id: selectedCategory?.id ?? null,
        description: description.trim() || null,
        price: sellingPrice,
        compare_at_price: originalPrice,
        stock_quantity: Number(stock),
        status: isActive ? 'active' : 'draft',
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (updateError) {
        throw updateError;
      }

      // Xóa ảnh cũ khỏi product_images
      const { error: deleteImagesError } = await supabase
        .from('product_images')
        .delete()
        .eq('product_id', productId);

      if (deleteImagesError) {
        throw deleteImagesError;
      }

      // Thêm danh sách ảnh cuối cùng
      if (finalImageUrls.length > 0) {
        const imageRows = finalImageUrls.map((imageUrl, index) => ({
          product_id: productId,
          image_url: imageUrl,
          alt_text: productName.trim(),
          sort_order: index,
        }));

        const { error: insertImagesError } = await supabase
          .from('product_images')
          .insert(imageRows);

        if (insertImagesError) {
          throw insertImagesError;
        }
      }

      // Lưu thành công
      // Điều hướng trực tiếp, không phụ thuộc Alert.alert
      console.log('Update product successful');

      if (Platform.OS !== 'web') {
        Alert.alert(
          'Thành công',
          'Cập nhật sản phẩm thành công.',
        );
      }

      router.replace('/(admin)/products');
    } catch (error: any) {
      console.error('Update product error:', error);

      Alert.alert(
        'Lỗi',
        error?.message || 'Không thể cập nhật sản phẩm.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    goToProductManagement();
  };

  // ==================== LOADING ====================

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />

          <Text style={styles.loadingText}>
            Đang tải thông tin sản phẩm...
          </Text>
        </View>
      </View>
    );
  }

  // ==================== UI ====================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goToProductManagement}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text style={styles.title}>Cập nhật sản phẩm</Text>
          <Text style={styles.subtitle}>
            Chỉnh sửa thông tin sản phẩm
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product images */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Hình ảnh sản phẩm
          </Text>

          <TouchableOpacity
            style={styles.imageUpload}
            onPress={handlePickImages}
          >
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageIcon}>▧</Text>

              <Text style={styles.imageMainText}>
                Thêm hoặc thay đổi ảnh
              </Text>

              <Text style={styles.imageSubText}>
                Tối đa 5 ảnh · 5 MB/ảnh
              </Text>
            </View>
          </TouchableOpacity>

          {(existingImageUrls.length > 0 || newImages.length > 0) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageList}
            >
              {existingImageUrls.map((url) => (
                <View key={url} style={styles.imagePreviewWrapper}>
                  <Image
                    source={{ uri: url }}
                    style={styles.imagePreview}
                  />

                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeExistingImage(url)}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {newImages.map((image) => (
                <View
                  key={image.uri}
                  style={styles.imagePreviewWrapper}
                >
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.imagePreview}
                  />

                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeNewImage(image.uri)}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Basic information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Thông tin cơ bản
          </Text>

          <InputField
            label="Tên sản phẩm *"
            value={productName}
            onChangeText={setProductName}
            placeholder="Nhập tên sản phẩm"
          />

          <InputField
            label="Mã sản phẩm"
            value={productCode}
            onChangeText={setProductCode}
            placeholder="Nhập mã sản phẩm"
          />

          <InputField
            label="Danh mục"
            value={category}
            onChangeText={setCategory}
            placeholder="Nhập danh mục"
          />

          <InputField
            label="Mô tả sản phẩm"
            value={description}
            onChangeText={setDescription}
            placeholder="Nhập mô tả sản phẩm"
            multiline
          />
        </View>

        {/* Price */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Giá bán</Text>

          <InputField
            label="Giá gốc (VNĐ) *"
            value={price}
            onChangeText={setPrice}
            placeholder="Nhập giá gốc"
            keyboardType="numeric"
          />

          <InputField
            label="Giá khuyến mãi (VNĐ)"
            value={salePrice}
            onChangeText={setSalePrice}
            placeholder="Nhập giá khuyến mãi"
            keyboardType="numeric"
          />
        </View>

        {/* Variants */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Phân loại sản phẩm
          </Text>

          <InputField
            label="Màu sắc"
            value={color}
            onChangeText={setColor}
            placeholder="Ví dụ: Đen, Trắng, Xám"
          />

          <InputField
            label="Kích thước"
            value={size}
            onChangeText={setSize}
            placeholder="Ví dụ: S, M, L, XL"
          />

          <InputField
            label="Số lượng tồn kho"
            value={stock}
            onChangeText={setStock}
            placeholder="Nhập số lượng"
            keyboardType="numeric"
          />
        </View>

        {/* Status */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Trạng thái sản phẩm
          </Text>

          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                Đang kinh doanh
              </Text>

              <Text style={styles.statusDescription}>
                {isActive
                  ? 'Sản phẩm đang được hiển thị trên cửa hàng'
                  : 'Sản phẩm hiện không được kinh doanh'}
              </Text>
            </View>

            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{
                false: '#D1D5DB',
                true: '#A7E8E5',
              }}
              thumbColor={
                isActive ? '#0D9488' : '#F4F4F5'
              }
            />
          </View>
        </View>

        <Text style={styles.note}>
          * Các trường thông tin bắt buộc
        </Text>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={saving}
        >
          <Text style={styles.cancelText}>Hủy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            saving && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Lưu thay đổi</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F0FDFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 32,
    color: '#0D9488',
    lineHeight: 36,
  },
  headerTitle: {
    marginLeft: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#172554',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 25,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EDF0F4',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#172554',
    marginBottom: 17,
  },
  imageUpload: {
    borderWidth: 1.5,
    borderColor: '#99DCD7',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 18,
    backgroundColor: '#F0FDFC',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  imageIcon: {
    fontSize: 42,
    color: '#0D9488',
    marginBottom: 8,
  },
  imageMainText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  imageSubText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 5,
  },
  imageList: {
    marginTop: 12,
  },
  imagePreviewWrapper: {
    position: 'relative',
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
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  statusDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 5,
    paddingRight: 10,
  },
  note: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  saveButton: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#00BCD4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
