import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/src/constants/colors';
import { getMyOrderById } from '@/src/services/order.service';

export default function OrderSuccessScreen() {
  const { orderId, orderNumber, cartCleanupError } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    cartCleanupError?: string;
  }>();
  const [savedOrderNumber, setSavedOrderNumber] = useState(orderNumber ?? '');
  const [orderLoadError, setOrderLoadError] = useState('');

  useEffect(() => {
    if (!orderId || orderNumber) return;
    let active = true;
    void getMyOrderById(orderId).then((order) => {
      if (active && order) setSavedOrderNumber(order.orderNumber);
      if (active && !order) setOrderLoadError('Không tìm thấy đơn hàng trong lịch sử của bạn.');
    }).catch((error: unknown) => {
      if (active) {
        setOrderLoadError(
          error instanceof Error ? error.message : 'Không thể tải thông tin đơn hàng.',
        );
      }
    });
    return () => { active = false; };
  }, [orderId, orderNumber]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <SymbolView
            name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
            tintColor={colors.cyan}
            size={76}
          />
        </View>

        <Text style={styles.title}>Đặt hàng thành công!</Text>
        <Text style={styles.orderNumberText}>
          {savedOrderNumber ? `Mã đơn hàng: #${savedOrderNumber}` : 'Đơn hàng đã được lưu'}
        </Text>
        <Text style={styles.subtitle}>
          Cảm ơn bạn đã mua sắm tại Chợ Mây. Đơn hàng của bạn đang chờ xác nhận.
        </Text>
        {cartCleanupError ? (
          <Text style={styles.warningText}>
            Đơn hàng đã được lưu, nhưng giỏ hàng chưa thể cập nhật: {cartCleanupError}
          </Text>
        ) : null}
        {orderLoadError ? (
          <Text style={styles.warningText}>
            Không thể tải mã đơn hàng: {orderLoadError}
          </Text>
        ) : null}

        <View style={styles.buttonGroup}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (orderId) {
                router.replace({ pathname: '/my-orders/[id]', params: { id: orderId } });
              } else {
                router.replace('/my-orders');
              }
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Xem chi tiết đơn hàng</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)/home')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Tiếp tục mua sắm</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  orderNumberText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.cyan,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  warningText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    height: 50,
    backgroundColor: colors.cyan,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 50,
    backgroundColor: '#F3F5F7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
});
