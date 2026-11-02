import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/src/constants/colors';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { useCart } from '@/src/hooks/useCart';
import { CartItem } from '@/src/components/cart/CartItem';
import { TotalBar } from '@/src/components/cart/TotalBar';
import { VoucherInput } from '@/src/components/cart/VoucherInput';

export default function CartScreen() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);
  const [clearingCart, setClearingCart] = useState(false);
  const {
    cart,
    selectedItems,
    subtotal,
    discount,
    shippingFee,
    total,
    voucherCode,
    discountRate,
    updateQuantity,
    removeFromCart,
    toggleSelectItem,
    toggleSelectAll,
    applyVoucher,
    removeVoucher,
    clearCart,
    loading,
    error,
    refresh,
  } = useCart();

  const isAllSelected = cart.length > 0 && cart.every((i) => i.selected);

  const handleRemove = (cartItemId: string) => {
    setActionError(null);
    void removeFromCart(cartItemId).then(setActionErrorIfFailed);
  };

  const setActionErrorIfFailed = (message: string | null) => {
    if (message) setActionError(message);
  };

  const handleClearCart = () => {
    setConfirmClearVisible(true);
  };

  const confirmClearCart = async () => {
    setActionError(null);
    setClearingCart(true);
    const errorMessage = await clearCart();
    setClearingCart(false);
    setConfirmClearVisible(false);
    setActionErrorIfFailed(errorMessage);
  };

  const handleUpdateQuantity = (cartItemId: string, quantity: number) => {
    setActionError(null);
    void updateQuantity(cartItemId, quantity).then(setActionErrorIfFailed);
  };

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một sản phẩm để thanh toán');
      return;
    }
    router.push('/payment');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            tintColor={colors.ink}
            size={22}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Giỏ hàng ({cart.length})</Text>
        {cart.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa tất cả sản phẩm trong giỏ hàng"
            disabled={clearingCart}
            hitSlop={8}
            onPress={handleClearCart}
          >
            <Text style={styles.clearAllText}>Xóa tất cả</Text>
          </Pressable>
        ) : (
          <View style={styles.headerRightPlaceholder} />
        )}
      </View>

      {loading && cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.emptySubtitle}>Đang tải giỏ hàng từ Supabase...</Text>
        </View>
      ) : error && cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Không thể tải giỏ hàng</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <Pressable onPress={() => void refresh()} style={styles.exploreButton}>
            <Text style={styles.exploreButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCircle}>
            <SymbolView
              name={{ ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' }}
              tintColor={colors.cyan}
              size={54}
            />
          </View>
          <Text style={styles.emptyTitle}>Giỏ hàng của bạn đang trống</Text>
          <Text style={styles.emptySubtitle}>
            Hãy khám phá các sản phẩm nổi bật và thêm vào giỏ hàng ngay nhé!
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)/home')}
            style={styles.exploreButton}
          >
            <Text style={styles.exploreButtonText}>Mua sắm ngay</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? (
            <Pressable onPress={() => void refresh()} style={styles.errorBanner}>
              <Text style={styles.errorText}>{error} · Chạm để thử lại</Text>
            </Pressable>
          ) : null}
          {actionError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{actionError}</Text>
            </View>
          ) : null}
          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onUpdateQuantity={(q) => {
                  handleUpdateQuantity(item.id, q);
                }}
                onRemove={() => handleRemove(item.id)}
                onToggleSelect={() => toggleSelectItem(item.id)}
              />
            )}
            ListFooterComponent={
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Ưu đãi & Khuyến mãi</Text>
                <VoucherInput
                  appliedVoucher={voucherCode}
                  discountRate={discountRate}
                  onApply={applyVoucher}
                  onRemove={removeVoucher}
                />

                <View style={styles.divider} />

                <Text style={styles.summaryTitle}>Chi tiết thanh toán</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tạm tính ({selectedItems.length} sản phẩm)</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
                </View>
                {discount > 0 ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Giảm giá ({voucherCode})</Text>
                    <Text style={[styles.summaryValue, styles.discountText]}>
                      -{formatCurrency(discount)}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phí giao hàng dự kiến</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(shippingFee)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Tổng ước tính</Text>
                  <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
                </View>
              </View>
            }
          />

          <TotalBar
            isAllSelected={isAllSelected}
            selectedCount={selectedItems.length}
            total={total}
            onToggleSelectAll={() => toggleSelectAll(!isAllSelected)}
            onCheckout={handleCheckout}
          />
        </>
      )}
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!clearingCart) setConfirmClearVisible(false);
        }}
        transparent
        visible={confirmClearVisible}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Xóa toàn bộ giỏ hàng?</Text>
            <Text style={styles.confirmMessage}>
              Tất cả sản phẩm sẽ bị xóa khỏi giỏ hàng của bạn.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                disabled={clearingCart}
                onPress={() => setConfirmClearVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={clearingCart}
                onPress={() => void confirmClearCart()}
                style={styles.confirmButton}
              >
                {clearingCart ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Xóa tất cả</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDF1F3',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  clearAllText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    backgroundColor: colors.white,
  },
  confirmTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    minWidth: 0,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F3F5F7',
  },
  cancelButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    minWidth: 0,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.danger,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  headerRightPlaceholder: {
    width: 36,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  errorBanner: { backgroundColor: '#FEE4E2', marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 8 },
  errorText: { color: colors.danger, fontSize: 12, textAlign: 'center' },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF1F3',
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F5',
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  discountText: {
    color: colors.danger,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.cyan,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.paleCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: colors.cyan,
    paddingHorizontal: 28,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
