
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

import { supabase } from '../../../src/services/supabase';

// ==================== TYPES ====================

type Voucher = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type VoucherFilter =
  | 'all'
  | 'active'
  | 'inactive'
  | 'expired';

// ==================== SCREEN ====================

export default function VoucherManagementScreen() {
  const router = useRouter();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [search, setSearch] = useState('');

  const [selectedStatus, setSelectedStatus] =
    useState<VoucherFilter>('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [filterVisible, setFilterVisible] =
    useState(false);

  // ==================== MESSAGE ====================

  const showMessage = (
    title: string,
    message: string,
  ) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // ==================== LOAD VOUCHERS ====================

  const loadVouchers = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const { data, error } = await supabase
          .from('vouchers')
          .select('*')
          .order('created_at', {
            ascending: false,
          });

        if (error) {
          throw error;
        }

        setVouchers((data ?? []) as Voucher[]);
      } catch (error: any) {
        console.error(
          'Load vouchers error:',
          error,
        );

        showMessage(
          'Lỗi tải voucher',
          error?.message ||
            'Không thể tải danh sách voucher.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  // ==================== FORMAT PRICE ====================

  const formatPrice = (
    price: number | null | undefined,
  ) => {
    return `${Number(price ?? 0).toLocaleString('vi-VN')} đ`;
  };

  // ==================== FORMAT DISCOUNT ====================

  const formatDiscount = (voucher: Voucher) => {
    const value = Number(
      voucher.discount_value ?? 0,
    );

    if (voucher.discount_type === 'percentage') {
      return `Giảm ${value}%`;
    }

    return `Giảm ${formatPrice(value)}`;
  };

  // ==================== FORMAT DATE ====================

  const formatDate = (
    date: string | null | undefined,
  ) => {
    if (!date) {
      return 'Không giới hạn';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Không xác định';
    }

    return parsedDate.toLocaleDateString('vi-VN');
  };

  // ==================== VOUCHER STATUS ====================

  const getVoucherStatus = (
    voucher: Voucher,
  ): {
    label: string;
    type: 'active' | 'inactive' | 'expired';
  } => {
    if (!voucher.is_active) {
      return {
        label: 'Đã ẩn',
        type: 'inactive',
      };
    }

    const now = new Date();

    if (
      voucher.expires_at &&
      new Date(voucher.expires_at) < now
    ) {
      return {
        label: 'Đã hết hạn',
        type: 'expired',
      };
    }

    if (
      voucher.starts_at &&
      new Date(voucher.starts_at) > now
    ) {
      return {
        label: 'Chưa bắt đầu',
        type: 'inactive',
      };
    }

    return {
      label: 'Đang hoạt động',
      type: 'active',
    };
  };

  // ==================== SEARCH AND FILTER ====================

  const filteredVouchers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return vouchers.filter((voucher) => {
      const matchSearch =
        !keyword ||
        voucher.code?.toLowerCase().includes(keyword) ||
        voucher.description
          ?.toLowerCase()
          .includes(keyword);

      const status = getVoucherStatus(voucher);

      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' &&
          status.type === 'active') ||
        (selectedStatus === 'inactive' &&
          status.type === 'inactive') ||
        (selectedStatus === 'expired' &&
          status.type === 'expired');

      return matchSearch && matchStatus;
    });
  }, [
    vouchers,
    search,
    selectedStatus,
  ]);

  // ==================== DELETE VOUCHER ====================

  const handleDelete = (voucher: Voucher) => {
    const confirmDelete = async () => {
      try {
        setDeletingId(voucher.id);

        const { error } = await supabase
          .from('vouchers')
          .delete()
          .eq('id', voucher.id);

        if (error) {
          throw error;
        }

        setVouchers((previous) =>
          previous.filter(
            (item) => item.id !== voucher.id,
          ),
        );

        showMessage(
          'Thành công',
          `Đã xóa voucher ${voucher.code}.`,
        );
      } catch (error: any) {
        console.error(
          'Delete voucher error:',
          error,
        );

        showMessage(
          'Lỗi',
          error?.message ||
            'Không thể xóa voucher.',
        );
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Bạn có chắc chắn muốn xóa voucher "${voucher.code}" không?`,
      );

      if (confirmed) {
        void confirmDelete();
      }

      return;
    }

    Alert.alert(
      'Xóa voucher',
      `Bạn có chắc chắn muốn xóa voucher "${voucher.code}" không?`,
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

  // ==================== TOGGLE VOUCHER ====================

  const handleToggleStatus = async (
    voucher: Voucher,
  ) => {
    try {
      const newStatus = !voucher.is_active;

      const { error } = await supabase
        .from('vouchers')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', voucher.id);

      if (error) {
        throw error;
      }

      setVouchers((previous) =>
        previous.map((item) =>
          item.id === voucher.id
            ? {
                ...item,
                is_active: newStatus,
              }
            : item,
        ),
      );

      showMessage(
        'Thành công',
        newStatus
          ? `Đã kích hoạt voucher ${voucher.code}.`
          : `Đã tắt voucher ${voucher.code}.`,
      );
    } catch (error: any) {
      console.error(
        'Update voucher status error:',
        error,
      );

      showMessage(
        'Lỗi',
        error?.message ||
          'Không thể cập nhật trạng thái voucher.',
      );
    }
  };

  // ==================== VOUCHER CARD ====================

  const renderVoucher = ({
    item,
  }: {
    item: Voucher;
  }) => {
    const status = getVoucherStatus(item);

    return (
      <View style={styles.voucherCard}>
        {/* ICON */}

        <View style={styles.voucherIcon}>
          <Text style={styles.voucherIconText}>
            %
          </Text>
        </View>

        {/* INFORMATION */}

        <View style={styles.voucherInfo}>
          <Text
            style={styles.voucherCode}
            numberOfLines={1}
          >
            {item.code || 'Chưa có mã'}
          </Text>

          <Text style={styles.discountText}>
            {formatDiscount(item)}
          </Text>

          <Text
            style={styles.descriptionText}
            numberOfLines={1}
          >
            {item.description ||
              (item.discount_type === 'percentage'
                ? 'Mã giảm giá theo phần trăm'
                : 'Mã giảm giá theo số tiền')}
          </Text>

          <Text style={styles.minimumOrderText}>
            Đơn tối thiểu:{' '}
            {formatPrice(item.min_order_amount)}
          </Text>

          <Text style={styles.dateText}>
            Hết hạn: {formatDate(item.expires_at)}
          </Text>

          <View style={styles.voucherMeta}>
            <View
              style={[
                styles.statusBadge,
                status.type === 'active'
                  ? styles.activeBadge
                  : status.type === 'expired'
                    ? styles.expiredBadge
                    : styles.hiddenBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  status.type === 'active'
                    ? styles.activeText
                    : status.type === 'expired'
                      ? styles.expiredText
                      : styles.hiddenText,
                ]}
              >
                {status.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ACTIONS */}

        <View style={styles.actions}>
          {/* SWITCH */}

          <TouchableOpacity
            style={[
              styles.switch,
              item.is_active &&
                styles.switchActive,
            ]}
            onPress={() =>
              handleToggleStatus(item)
            }
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.switchThumb,
                item.is_active &&
                  styles.switchThumbActive,
              ]}
            />
          </TouchableOpacity>

          {/* DELETE */}

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
                ⌫
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
          Quản lý voucher
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
            placeholder="Tìm kiếm voucher"
            placeholderTextColor="#A0A0A0"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <TouchableOpacity
          style={styles.filterIconButton}
          onPress={() =>
            setFilterVisible(true)
          }
        >
          <Text style={styles.filterIcon}>
            ☷
          </Text>

          {selectedStatus !== 'all' && (
            <View style={styles.filterDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* STATUS FILTER */}

      <FlatList
        horizontal
        data={[
          {
            value: 'all',
            label: 'Tất cả',
          },
          {
            value: 'active',
            label: 'Đang hoạt động',
          },
          {
            value: 'inactive',
            label: 'Đã ẩn',
          },
          {
            value: 'expired',
            label: 'Đã hết hạn',
          },
        ]}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFlatList}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              setSelectedStatus(
                item.value as VoucherFilter,
              )
            }
            style={[
              styles.categoryChip,
              selectedStatus === item.value &&
                styles.categoryChipActive,
            ]}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedStatus === item.value &&
                  styles.categoryChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* VOUCHER COUNT */}

      <View style={styles.listHeader}>
        <Text style={styles.voucherCount}>
          {filteredVouchers.length} voucher
        </Text>

        <TouchableOpacity
          onPress={() => loadVouchers(true)}
        >
          <Text style={styles.sortText}>
            Làm mới ↻
          </Text>
        </TouchableOpacity>
      </View>

      {/* VOUCHER LIST */}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color="#00B8C8"
          />

          <Text style={styles.loadingText}>
            Đang tải voucher...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredVouchers}
          keyExtractor={(item) => item.id}
          renderItem={renderVoucher}
          contentContainerStyle={
            styles.voucherList
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                loadVouchers(true)
              }
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>
                🎟️
              </Text>

              <Text style={styles.emptyText}>
                Không tìm thấy voucher
              </Text>
            </View>
          }
        />
      )}

      {/* ADD VOUCHER BUTTON */}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() =>
          router.push('/(admin)/vouchers/form')
        }
        activeOpacity={0.85}
      >
        <Text style={styles.floatingButtonText}>
          +
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
            active: true,
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
                item.active &&
                  styles.navActive,
              ]}
            >
              {item.icon}
            </Text>

            <Text
              style={[
                styles.navLabel,
                item.active &&
                  styles.navActive,
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
                Lọc voucher
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
              Trạng thái voucher
            </Text>

            {[
              {
                value: 'all',
                label: 'Tất cả',
              },
              {
                value: 'active',
                label: 'Đang hoạt động',
              },
              {
                value: 'inactive',
                label: 'Đã ẩn',
              },
              {
                value: 'expired',
                label: 'Đã hết hạn',
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={styles.filterOption}
                onPress={() =>
                  setSelectedStatus(
                    item.value as VoucherFilter,
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
                  setSearch('');
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

  // ==================== HEADER ====================

  header: {
    height: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#252525',
  },

  // ==================== SEARCH ====================

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 12,
  },

  searchBox: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },

  searchIcon: {
    fontSize: 27,
    color: '#A0A0A0',
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333333',
    paddingVertical: 0,
  },

  filterIconButton: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  filterIcon: {
    fontSize: 27,
    color: '#00B8C8',
  },

  filterDot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E64B4B',
    top: 7,
    right: 7,
  },

  // ==================== STATUS FILTER ====================

  categoryFlatList: {
    flexGrow: 0,
    flexShrink: 0,
    height: 54,
    marginTop: 10,
  },

  categoryList: {
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 9,
  },

  categoryChip: {
    backgroundColor: '#F0F1F4',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 9,
    alignSelf: 'center',
  },

  categoryChipActive: {
    backgroundColor: '#DDF8F8',
  },

  categoryChipText: {
    fontSize: 12,
    color: '#777777',
  },

  categoryChipTextActive: {
    color: '#00AEBE',
    fontWeight: '700',
  },

  // ==================== LIST HEADER ====================

  listHeader: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  voucherCount: {
    fontSize: 13,
    color: '#999999',
  },

  sortText: {
    fontSize: 13,
    color: '#00B8C8',
    fontWeight: '600',
  },

  // ==================== VOUCHER LIST ====================

  voucherList: {
    paddingHorizontal: 14,
    paddingBottom: 110,
  },

  voucherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 13,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 125,
    gap: 11,
    borderWidth: 1,
    borderColor: '#EEEEF2',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  // ==================== VOUCHER ICON ====================

  voucherIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#F0E9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  voucherIconText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#9B70F5',
  },

  // ==================== VOUCHER INFORMATION ====================

  voucherInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },

  voucherCode: {
    color: '#3C3C46',
    fontSize: 15,
    fontWeight: '700',
  },

  discountText: {
    color: '#00AFC0',
    fontSize: 15,
    fontWeight: '700',
  },

  descriptionText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
  },

  minimumOrderText: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 15,
  },

  dateText: {
    color: '#999999',
    fontSize: 11,
    lineHeight: 15,
  },

  voucherMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 3,
  },

  // ==================== STATUS BADGE ====================

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },

  activeBadge: {
    backgroundColor: '#E2F8EC',
  },

  hiddenBadge: {
    backgroundColor: '#FDE8E8',
  },

  expiredBadge: {
    backgroundColor: '#FFF0D9',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  activeText: {
    color: '#21A45B',
  },

  hiddenText: {
    color: '#DC5555',
  },

  expiredText: {
    color: '#D97706',
  },

  // ==================== SWITCH ====================

  actions: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    height: 55,
    width: 38,
    gap: 12,
  },

  switch: {
    width: 34,
    height: 20,
    borderRadius: 12,
    backgroundColor: '#D8DDE3',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },

  switchActive: {
    backgroundColor: '#00B8C8',
  },

  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },

  switchThumbActive: {
    alignSelf: 'flex-end',
  },

  deleteAction: {
    width: 30,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteIcon: {
    color: '#E65A5A',
    fontSize: 18,
  },

  // ==================== LOADING / EMPTY ====================

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: '#888888',
    fontSize: 14,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 65,
  },

  emptyIcon: {
    fontSize: 45,
  },

  emptyText: {
    marginTop: 12,
    color: '#888888',
    fontSize: 15,
  },

  // ==================== ADD BUTTON ====================

  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 82,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#00B8C8',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },

  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '300',
  },

  // ==================== BOTTOM NAVIGATION ====================

  bottomNavigation: {
    height: 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4,
  },

  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  navIcon: {
    fontSize: 21,
    color: '#AEB4BD',
  },

  navLabel: {
    fontSize: 10,
    color: '#AEB4BD',
  },

  navActive: {
    color: '#00B8C8',
    fontWeight: '700',
  },

  // ==================== FILTER MODAL ====================

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  filterModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222',
  },

  closeModal: {
    fontSize: 23,
    color: '#888888',
  },

  filterTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 12,
  },

  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },

  filterOptionText: {
    fontSize: 15,
    color: '#666666',
  },

  filterOptionSelected: {
    color: '#00B8C8',
    fontWeight: '700',
  },

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#00B8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#00B8C8',
  },

  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },

  resetButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F0F1F3',
    alignItems: 'center',
  },

  resetButtonText: {
    color: '#555555',
    fontWeight: '600',
    fontSize: 14,
  },

  applyButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#00B8C8',
    alignItems: 'center',
  },

  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

