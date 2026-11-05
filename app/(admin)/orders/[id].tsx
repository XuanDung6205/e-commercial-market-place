import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  AdminOrder,
  getAdminOrderById,
  isTransitionAllowed,
  STATUS_LABELS,
  updateAdminOrderStatus,
} from '@/src/services/admin.order.service';
import type { OrderStatus } from '@/src/types/models';
import { formatCurrency } from '@/src/utils/formatCurrency';

const ORDER_STATUS_OPTIONS: { id: OrderStatus; label: string; isDanger?: boolean }[] = [
  { id: 'pending', label: 'Chờ xác nhận' },
  { id: 'confirmed', label: 'Đã xác nhận' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'delivered', label: 'Đã giao' },
  { id: 'cancelled', label: 'Đã hủy', isDanger: true },
];

export default function AdminOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('pending');
  const [updating, setUpdating] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAdminOrderById(id);
      setOrder(data);
      if (data) {
        const norm = data.status === 'shipped' ? 'shipping' : data.status;
        setSelectedStatus(norm);
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết đơn hàng:', err);
      Alert.alert('Lỗi', 'Không thể tải chi tiết đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!id) return;
      try {
        const data = await getAdminOrderById(id);
        if (isMounted) {
          setOrder(data);
          if (data) {
            const norm = data.status === 'shipped' ? 'shipping' : data.status;
            setSelectedStatus(norm);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải chi tiết đơn hàng:', err);
        Alert.alert('Lỗi', 'Không thể tải chi tiết đơn hàng.');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const openStatusModal = () => {
    if (!order) return;
    const currentNorm = order.status === 'shipped' ? 'shipping' : order.status;
    setSelectedStatus(currentNorm);
    setModalVisible(true);
  };

  const handleUpdateStatus = async () => {
    if (!order) return;
    const currentNorm = order.status === 'shipped' ? 'shipping' : order.status;

    if (selectedStatus === currentNorm) {
      setModalVisible(false);
      return;
    }

    if (!isTransitionAllowed(currentNorm, selectedStatus)) {
      Alert.alert(
        'Không hợp lệ',
        `Chuyển từ "${STATUS_LABELS[currentNorm]}" sang "${STATUS_LABELS[selectedStatus]}" không được phép.`
      );
      return;
    }

    setUpdating(true);
    try {
      const updated = await updateAdminOrderStatus(order.id, order.status, selectedStatus);
      setOrder(updated);
      setModalVisible(false);
      Alert.alert(
        'Thành công',
        `Trạng thái đơn hàng đã được cập nhật thành "${STATUS_LABELS[selectedStatus]}".`
      );
    } catch (err: any) {
      Alert.alert('Lỗi cập nhật', err?.message || 'Không thể cập nhật trạng thái.');
    } finally {
      setUpdating(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = status === 'shipped' ? 'shipping' : status;

    let badgeStyle = styles.badgePending;
    let textStyle = styles.badgeTextPending;

    if (s === 'shipping') {
      badgeStyle = styles.badgeShipping;
      textStyle = styles.badgeTextShipping;
    } else if (s === 'delivered') {
      badgeStyle = styles.badgeDelivered;
      textStyle = styles.badgeTextDelivered;
    } else if (s === 'cancelled') {
      badgeStyle = styles.badgeCancelled;
      textStyle = styles.badgeTextCancelled;
    } else if (s === 'confirmed') {
      badgeStyle = styles.badgeConfirmed;
      textStyle = styles.badgeTextConfirmed;
    }

    return (
      <View style={[styles.badge, badgeStyle]}>
        <Text style={[styles.badgeText, textStyle]}>
          {STATUS_LABELS[s] || s}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết đơn</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>Đang tải chi tiết đơn hàng...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết đơn</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Không tìm thấy đơn hàng</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={reload}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#6B7280' }]}
              onPress={() => router.back()}
            >
              <Text style={styles.retryText}>Quay lại</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatusNorm = order.status === 'shipped' ? 'shipping' : order.status;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết đơn</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Order ID & Status Header */}
        <View style={styles.orderHeaderCard}>
          <Text style={styles.orderNumberText}>
            Đơn hàng {order.displayId}
          </Text>
          <TouchableOpacity activeOpacity={0.8} onPress={openStatusModal}>
            {renderStatusBadge(order.status)}
          </TouchableOpacity>
        </View>

        {/* Customer Information Card */}
        <View style={styles.customerCard}>
          <View style={styles.customerIconContainer}>
            <Ionicons name="person-outline" size={20} color="#6B7280" />
          </View>
          <View style={styles.customerInfoTextContainer}>
            <Text style={styles.customerNameAndPhone}>
              {order.recipientName} · {order.phone}
            </Text>
            <Text style={styles.customerDateAndPayment}>
              {order.date} · {order.paymentMethodLabel}
            </Text>
            {Boolean(order.address) && (
              <Text style={styles.customerAddress} numberOfLines={2}>
                {order.address}
              </Text>
            )}
          </View>
        </View>

        {/* Ordered Products Section */}
        <View style={styles.sectionCard}>
          {order.items.map((item, index) => (
            <View
              key={item.id || index}
              style={[
                styles.productItem,
                index < order.items.length - 1 && styles.productItemBorder,
              ]}
            >
              <Image
                source={
                  item.image
                    ? { uri: item.image }
                    : { uri: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80' }
                }
                style={styles.productImage}
                resizeMode="cover"
              />
              <View style={styles.productDetails}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.productName}
                </Text>
                <Text style={styles.productVariant}>
                  {item.variant ? `${item.variant} · ` : ''}Số lượng: {item.quantity}
                </Text>
                <Text style={styles.productPrice}>
                  {formatCurrency(item.price)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Price Breakdown Card */}
        <View style={styles.priceBreakdownCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tạm tính</Text>
            <Text style={styles.priceValue}>{formatCurrency(order.subtotal)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Thuế (10%)</Text>
            <Text style={styles.priceValue}>{formatCurrency(order.tax)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Phí vận chuyển</Text>
            <Text style={styles.priceValue}>{formatCurrency(order.shippingFee)}</Text>
          </View>
          {order.discount > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Giảm giá</Text>
              <Text style={[styles.priceValue, { color: '#EF4444' }]}>
                -{formatCurrency(order.discount)}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.updateStatusButton}
          activeOpacity={0.8}
          onPress={openStatusModal}
        >
          <Text style={styles.updateStatusButtonText}>Cập nhật trạng thái</Text>
        </TouchableOpacity>
      </View>

      {/* Status Update Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật trạng thái</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={12}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Status Radio List */}
            <View style={styles.statusOptionsContainer}>
              {ORDER_STATUS_OPTIONS.map((option) => {
                const isCurrent = option.id === currentStatusNorm;
                const isSelected = option.id === selectedStatus;
                const isAllowed = isCurrent || isTransitionAllowed(currentStatusNorm, option.id);

                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={isAllowed ? 0.7 : 1}
                    disabled={!isAllowed}
                    onPress={() => {
                      if (isAllowed) {
                        setSelectedStatus(option.id);
                      }
                    }}
                    style={[
                      styles.statusOptionRow,
                      !isAllowed && styles.statusOptionDisabled,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                        !isAllowed && styles.radioOuterDisabled,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.statusOptionText,
                        option.isDanger && styles.statusOptionTextDanger,
                        !isAllowed && styles.statusOptionTextDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Action Button */}
            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                updating && styles.modalSubmitButtonDisabled,
              ]}
              disabled={updating}
              onPress={handleUpdateStatus}
              activeOpacity={0.8}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitButtonText}>Cập nhật</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  orderHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderNumberText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E242B',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextPending: {
    color: '#B45309',
  },
  badgeConfirmed: {
    backgroundColor: '#E0F2FE',
  },
  badgeTextConfirmed: {
    color: '#0284C7',
  },
  badgeShipping: {
    backgroundColor: '#E0F7FA',
  },
  badgeTextShipping: {
    color: '#00BCD4',
  },
  badgeDelivered: {
    backgroundColor: '#DCFCE7',
  },
  badgeTextDelivered: {
    color: '#16A34A',
  },
  badgeCancelled: {
    backgroundColor: '#FEE2E2',
  },
  badgeTextCancelled: {
    color: '#DC2626',
  },
  customerCard: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  customerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInfoTextContainer: {
    flex: 1,
  },
  customerNameAndPhone: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  customerDateAndPayment: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  customerAddress: {
    fontSize: 12,
    color: '#475569',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  productItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 14,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E242B',
    marginBottom: 4,
  },
  productVariant: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00BCD4',
  },
  priceBreakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E242B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E242B',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00BCD4',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  updateStatusButton: {
    backgroundColor: '#00BCD4',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateStatusButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#00BCD4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E242B',
  },
  modalCloseButton: {
    padding: 4,
  },
  statusOptionsContainer: {
    marginBottom: 24,
  },
  statusOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statusOptionDisabled: {
    opacity: 0.35,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  radioOuterSelected: {
    borderColor: '#00BCD4',
  },
  radioOuterDisabled: {
    borderColor: '#E5E7EB',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00BCD4',
  },
  statusOptionText: {
    fontSize: 15,
    color: '#1E242B',
    fontWeight: '500',
  },
  statusOptionTextDanger: {
    color: '#EF4444',
  },
  statusOptionTextDisabled: {
    color: '#9CA3AF',
  },
  modalSubmitButton: {
    backgroundColor: '#00BCD4',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
