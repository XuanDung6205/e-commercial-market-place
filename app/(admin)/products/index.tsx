import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';

import {
  deleteProduct,
  getProducts,
  Product,
} from '../../../src/services/admin/productService';

type StatusFilter = 'all' | 'active' | 'hidden';

export default function ProductManagementScreen() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState('Tất cả');

  const [selectedStatus, setSelectedStatus] =
    useState<StatusFilter>('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [filterVisible, setFilterVisible] = useState(false);

  // ==================== LOAD PRODUCTS ====================

  const loadProducts = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await getProducts();

        setProducts(data);
      } catch (error: any) {
        console.error('Load products error:', error);

        const message =
          error?.message ||
          'Không thể tải danh sách sản phẩm.';

        if (Platform.OS === 'web') {
          window.alert(`Lỗi: ${message}`);
        } else {
          Alert.alert('Lỗi', message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ==================== GET CATEGORIES ====================

  const categories = useMemo(() => {
    const names = Array.from(
      new Set(
        products
          .map((product) => product.category_name)
          .filter(
            (name): name is string =>
              Boolean(
                name && name !== 'Chưa phân loại',
              ),
          ),
      ),
    );

    return ['Tất cả', ...names];
  }, [products]);

  // ==================== SEARCH AND FILTER ====================

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchSearch =
        !keyword ||
        product.name?.toLowerCase().includes(keyword) ||
        product.sku?.toLowerCase().includes(keyword);

      const matchCategory =
        selectedCategory === 'Tất cả' ||
        product.category_name === selectedCategory;

      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active'
          ? product.status === 'active'
          : product.status !== 'active');

      return (
        matchSearch &&
        matchCategory &&
        matchStatus
      );
    });
  }, [
    products,
    search,
    selectedCategory,
    selectedStatus,
  ]);

  // ==================== FORMAT PRICE ====================

  const formatPrice = (price: number | null) => {
    return `${Number(price ?? 0).toLocaleString('vi-VN')} đ`;
  };

  // ==================== DELETE PRODUCT ====================

  const handleDelete = (product: Product) => {
    const confirmDelete = async () => {
      try {
        setDeletingId(product.id);

        await deleteProduct(product.id);

        // Cập nhật danh sách sau khi xóa thành công
        setProducts((previous) =>
          previous.filter(
            (item) => item.id !== product.id,
          ),
        );

        if (Platform.OS === 'web') {
          window.alert('Đã xóa sản phẩm thành công.');
        } else {
          Alert.alert(
            'Thành công',
            'Đã xóa sản phẩm.',
          );
        }
      } catch (error: any) {
        console.error(
          'Delete product error:',
          error,
        );

        const message =
          error?.message ||
          'Không thể xóa sản phẩm.';

        if (Platform.OS === 'web') {
          window.alert(`Lỗi: ${message}`);
        } else {
          Alert.alert('Lỗi', message);
        }
      } finally {
        setDeletingId(null);
      }
    };

    // Xác nhận xóa trên Web
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Bạn có chắc chắn muốn xóa "${product.name}" không?`,
      );

      if (confirmed) {
        void confirmDelete();
      }

      return;
    }

    // Xác nhận xóa trên Android / iOS
    Alert.alert(
      'Xóa sản phẩm',
      `Bạn có chắc chắn muốn xóa "${product.name}" không?`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void confirmDelete();
          },
        },
      ],
    );
  };

  // ==================== PRODUCT CARD ====================

  const renderProduct = ({
    item,
  }: {
    item: Product;
  }) => {
    const isActive = item.status === 'active';

    return (
      <View style={styles.productCard}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.productImage,
              styles.imagePlaceholder,
            ]}
          >
            <Text style={styles.placeholderIcon}>
              📦
            </Text>
          </View>
        )}

        <View style={styles.productInfo}>
          <Text
            style={styles.productName}
            numberOfLines={1}
          >
            {item.name || 'Chưa có tên'}
          </Text>

          <Text style={styles.productPrice}>
            {formatPrice(item.price)}
          </Text>

          <View style={styles.productMeta}>
            <Text style={styles.stockText}>
              Kho: {item.stock_quantity ?? 0}
            </Text>

            <View
              style={[
                styles.statusBadge,
                isActive
                  ? styles.activeBadge
                  : styles.hiddenBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isActive
                    ? styles.activeText
                    : styles.hiddenText,
                ]}
              >
                {isActive
                  ? 'Còn hàng'
                  : 'Đã ẩn'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {/* SỬA */}
          <TouchableOpacity
            style={styles.editAction}
            onPress={() =>
              router.push({
                pathname: '/(admin)/products/edit',
                params: {
                  productId: item.id,
                },
              })
            }
          >
            <Text style={styles.editIcon}>
              ✎
            </Text>
          </TouchableOpacity>

          {/* XÓA */}
          <TouchableOpacity
            style={styles.deleteAction}
            disabled={deletingId === item.id}
            onPress={() => handleDelete(item)}
          >
            {deletingId === item.id ? (
              <ActivityIndicator
                size="small"
                color="#E64B4B"
              />
            ) : (
              <Text style={styles.deleteIcon}>
                ▤
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ==================== MAIN UI ====================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Quản lý sản phẩm
        </Text>
      </View>

      {/* SEARCH */}

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>
            ⌕
          </Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm sản phẩm"
            placeholderTextColor="#A0A0A0"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <TouchableOpacity
          style={styles.filterIconButton}
          onPress={() => setFilterVisible(true)}
        >
          <Text style={styles.filterIcon}>
            ☷
          </Text>

          {selectedStatus !== 'all' && (
            <View style={styles.filterDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* CATEGORY */}

      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFlatList}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              setSelectedCategory(item)
            }
            style={[
              styles.categoryChip,
              selectedCategory === item &&
                styles.categoryChipActive,
            ]}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === item &&
                  styles.categoryChipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* PRODUCT COUNT */}

      <View style={styles.listHeader}>
        <Text style={styles.productCount}>
          {filteredProducts.length} sản phẩm
        </Text>

        <TouchableOpacity>
          <Text style={styles.sortText}>
            Mới nhất ↓
          </Text>
        </TouchableOpacity>
      </View>

      {/* PRODUCT LIST */}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color="#00B8C8"
          />

          <Text style={styles.loadingText}>
            Đang tải sản phẩm...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadProducts(true)}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>
                📦
              </Text>

              <Text style={styles.emptyText}>
                Không tìm thấy sản phẩm
              </Text>
            </View>
          }
        />
      )}

      {/* ADD PRODUCT BUTTON */}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() =>
          router.push('/(admin)/products/add')
        }
      >
        <Text style={styles.floatingButtonText}>
          ＋
        </Text>
      </TouchableOpacity>

      {/* BOTTOM NAVIGATION */}

      <View style={styles.bottomNavigation}>
        {[
          {
            icon: '▦',
            label: 'Tổng quan',
            route: '/(admin)',
          },
          {
            icon: '⬡',
            label: 'Sản phẩm',
            route: '/(admin)/products',
            active: true,
          },
          {
            icon: '▤',
            label: 'Đơn hàng',
            route: '/(admin)/orders',
          },
          {
            icon: '◇',
            label: 'Khuyến mãi',
            route: '/(admin)/vouchers',
          },
          {
            icon: '⚙',
            label: 'Cài đặt',
            route: '/(admin)/settings',
          },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.navItem}
            onPress={() => {
              if (!item.active) {
                router.push(item.route as any);
              }
            }}
          >
            <Text
              style={[
                styles.navIcon,
                item.active && styles.navActive,
              ]}
            >
              {item.icon}
            </Text>

            <Text
              style={[
                styles.navLabel,
                item.active && styles.navActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FILTER MODAL */}

      <Modal
        visible={filterVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setFilterVisible(false)
        }
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() =>
            setFilterVisible(false)
          }
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.filterModal}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Lọc sản phẩm
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setFilterVisible(false)
                }
              >
                <Text style={styles.closeModal}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterTitle}>
              Trạng thái sản phẩm
            </Text>

            {[
              {
                value: 'all',
                label: 'Tất cả',
              },
              {
                value: 'active',
                label: 'Đang bán',
              },
              {
                value: 'hidden',
                label: 'Đã ẩn',
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={styles.filterOption}
                onPress={() =>
                  setSelectedStatus(
                    item.value as StatusFilter,
                  )
                }
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedStatus === item.value &&
                      styles.filterOptionSelected,
                  ]}
                >
                  {item.label}
                </Text>

                <View style={styles.radioOuter}>
                  {selectedStatus === item.value && (
                    <View
                      style={styles.radioInner}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  setSelectedStatus('all');
                  setSelectedCategory('Tất cả');
                }}
              >
                <Text
                  style={styles.resetButtonText}
                >
                  Đặt lại
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={() =>
                  setFilterVisible(false)
                }
              >
                <Text
                  style={styles.applyButtonText}
                >
                  Áp dụng
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  // HEADER
  header: {
    height: 52,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#252525',
  },

  // SEARCH
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    paddingTop: 12,
    gap: 9,
  },

  searchBox: {
    flex: 1,
    height: 39,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  searchIcon: {
    fontSize: 23,
    color: '#A0A0A0',
    marginRight: 7,
  },

  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#333333',
    paddingVertical: 0,
  },

  filterIconButton: {
    width: 35,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterIcon: {
    fontSize: 23,
    color: '#00B8C8',
  },

  filterDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E64B4B',
    top: 6,
    right: 5,
  },

  // CATEGORY
  categoryFlatList: {
    flexGrow: 0,
    flexShrink: 0,
    height: 43,
    marginTop: 9,
  },

  categoryList: {
    paddingHorizontal: 17,
    alignItems: 'center',
    gap: 7,
  },

  categoryChip: {
    backgroundColor: '#EDEFF2',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'center',
  },

  categoryChipActive: {
    backgroundColor: '#DDF8F8',
  },

  categoryChipText: {
    fontSize: 11,
    color: '#777777',
  },

  categoryChipTextActive: {
    color: '#00AEBE',
    fontWeight: '700',
  },

  // LIST HEADER
  listHeader: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  productCount: {
    fontSize: 11,
    color: '#999999',
  },

  sortText: {
    fontSize: 11,
    color: '#00B8C8',
    fontWeight: '600',
  },

  // PRODUCT LIST
  productList: {
    paddingHorizontal: 13,
    paddingBottom: 95,
  },

  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 9,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 77,
    gap: 9,
  },

  productImage: {
    width: 49,
    height: 54,
    borderRadius: 7,
    backgroundColor: '#F0F2F3',
  },

  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderIcon: {
    fontSize: 21,
  },

  productInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },

  productName: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '600',
  },

  productPrice: {
    color: '#00AFC0',
    fontSize: 11,
    fontWeight: '700',
  },

  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  stockText: {
    color: '#999999',
    fontSize: 9,
  },

  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },

  activeBadge: {
    backgroundColor: '#E2F8EC',
  },

  hiddenBadge: {
    backgroundColor: '#FDE8E8',
  },

  statusText: {
    fontSize: 8,
    fontWeight: '600',
  },

  activeText: {
    color: '#21A45B',
  },

  hiddenText: {
    color: '#DC5555',
  },

  actions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    width: 22,
  },

  editAction: {
    width: 22,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editIcon: {
    color: '#AAAAAA',
    fontSize: 17,
  },

  deleteAction: {
    width: 22,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteIcon: {
    color: '#E65A5A',
    fontSize: 15,
  },

  // LOADING / EMPTY
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 9,
    color: '#888888',
    fontSize: 12,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 55,
  },

  emptyIcon: {
    fontSize: 35,
  },

  emptyText: {
    marginTop: 10,
    color: '#888888',
    fontSize: 13,
  },

  // ADD BUTTON
  floatingButton: {
    position: 'absolute',
    right: 18,
    bottom: 82,
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#00B8C8',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    zIndex: 10,
  },

  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 33,
    fontWeight: '300',
  },

  // BOTTOM NAVIGATION
  bottomNavigation: {
    height: 61,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 3,
  },

  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  navIcon: {
    fontSize: 17,
    color: '#AEB4BD',
  },

  navLabel: {
    fontSize: 9,
    color: '#AEB4BD',
  },

  navActive: {
    color: '#00B8C8',
    fontWeight: '700',
  },

  // FILTER MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  filterModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
  },

  closeModal: {
    fontSize: 20,
    color: '#888888',
  },

  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 10,
  },

  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },

  filterOptionText: {
    fontSize: 14,
    color: '#666666',
  },

  filterOptionSelected: {
    color: '#00B8C8',
    fontWeight: '700',
  },

  radioOuter: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#00B8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00B8C8',
  },

  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },

  resetButton: {
    flex: 1,
    padding: 12,
    borderRadius: 9,
    backgroundColor: '#F0F1F3',
    alignItems: 'center',
  },

  resetButtonText: {
    color: '#555555',
    fontWeight: '600',
  },

  applyButton: {
    flex: 1,
    padding: 12,
    borderRadius: 9,
    backgroundColor: '#00B8C8',
    alignItems: 'center',
  },

  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});