import { colors } from "@/src/constants/colors";
import { useCart } from "@/src/hooks/useCart";
import { createCustomerOrder } from "@/src/services/order.service";
import { formatCurrency } from "@/src/utils/formatCurrency";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { supabase } from "@/src/services/supabase";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PaymentMethodType = "cod" | "bank_transfer" | "e_wallet";

export default function PaymentScreen() {
  const {
    selectedItems,
    subtotal,
    discount,
    tax,
    shippingFee,
    total,
    voucherCode,
    clearSelectedCart,
  } = useCart();

  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cod");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deliveryInfoValidationAttempted, setDeliveryInfoValidationAttempted] =
    useState(false);

  const missingPhone = !phone.trim();
  const missingAddress = !address.trim();
  const deliveryInfoError = deliveryInfoValidationAttempted
    ? missingPhone && missingAddress
      ? "Vui lòng cập nhật số điện thoại và địa chỉ giao hàng trước khi đặt hàng."
      : missingPhone
        ? "Vui lòng cập nhật số điện thoại trước khi đặt hàng."
        : missingAddress
          ? "Vui lòng cập nhật địa chỉ giao hàng trước khi đặt hàng."
          : ""
    : "";

  useEffect(() => {
    let active = true;

    const loadCustomerProfile = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, address")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;

        setRecipientName(profile?.full_name?.trim() || String(user.user_metadata?.full_name ?? ""));
        setPhone(profile?.phone?.trim() ?? "");
        setAddress(profile?.address?.trim() ?? "");
      } catch (error) {
        if (active) {
          setProfileLoadError(
            error instanceof Error
              ? `Không tải được thông tin tài khoản: ${error.message}`
              : "Không tải được thông tin tài khoản. Vui lòng nhập thông tin giao hàng.",
          );
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    void loadCustomerProfile();
    return () => {
      active = false;
    };
  }, []);

  const handlePlaceOrder = async () => {
    if (selectedItems.length === 0) {
      Alert.alert("Lỗi", "Không có sản phẩm nào được chọn để thanh toán.");
      return;
    }

    setDeliveryInfoValidationAttempted(true);
    if (missingPhone || missingAddress) return;

    if (!recipientName.trim()) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin giao hàng.");
      return;
    }

    setSubmitting(true);
    try {
      const orderId = await createCustomerOrder({
        items: selectedItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          variantLabel: item.variant,
        })),
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        paymentMethod,
        note: note.trim(),
        voucherCode,
      });

      const cartError = await clearSelectedCart();
      setSubmitting(false);
      router.replace({
        pathname: "/order-success",
        params: {
          orderId,
          ...(cartError ? { cartCleanupError: cartError } : {}),
        },
      });
    } catch (error) {
      setSubmitting(false);
      Alert.alert(
        "Không thể đặt hàng",
        error instanceof Error ? error.message : "Đã xảy ra lỗi khi lưu đơn hàng.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            tintColor={colors.ink}
            size={22}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Shipping Address */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.titleWithIcon}>
              <SymbolView
                name={{
                  ios: "mappin.and.ellipse",
                  android: "location_on",
                  web: "location_on",
                }}
                tintColor={colors.cyan}
                size={18}
              />
              <Text style={styles.cardTitle}>Địa chỉ giao hàng</Text>
            </View>
            <Pressable
              hitSlop={6}
              onPress={() => setIsEditingAddress(!isEditingAddress)}
            >
              <Text style={styles.changeActionText}>
                {isEditingAddress ? "Lưu" : "Thay đổi"}
              </Text>
            </Pressable>
          </View>
          {profileLoadError ? (
            <Text style={styles.profileLoadError}>{profileLoadError}</Text>
          ) : null}

          {isEditingAddress ? (
            <View style={styles.addressForm}>
              <TextInput
                style={styles.input}
                placeholder="Họ và tên người nhận"
                value={recipientName}
                onChangeText={setRecipientName}
              />
              <TextInput
                style={styles.input}
                placeholder="Số điện thoại"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Địa chỉ nhận hàng chi tiết"
                multiline
                numberOfLines={2}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          ) : (
            <View style={styles.addressInfo}>
              <Text style={styles.recipientName}>
                {recipientName} · {phone}
              </Text>
              <Text style={styles.addressDetail}>{address}</Text>
            </View>
          )}
        </View>

        {/* Selected Products */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Sản phẩm ({selectedItems.length})
          </Text>
          {selectedItems.map((item) => (
            <View key={item.id} style={styles.productRow}>
              <Image
                source={{ uri: item.product.image }}
                style={styles.productThumb}
                resizeMode="cover"
              />
              <View style={styles.productCopy}>
                <Text numberOfLines={1} style={styles.productName}>
                  {item.product.name}
                </Text>
                {item.variant ? (
                  <Text style={styles.productVariant}>{item.variant}</Text>
                ) : null}
                <Text style={styles.productQuantity}>
                  Số lượng: {item.quantity}
                </Text>
              </View>
              <Text style={styles.productPrice}>
                {formatCurrency(item.product.price * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phương thức thanh toán</Text>

          <Pressable
            onPress={() => setPaymentMethod("cod")}
            style={[
              styles.methodOption,
              paymentMethod === "cod" && styles.methodOptionActive,
            ]}
          >
            <View style={styles.methodLeft}>
              <SymbolView
                name={{ ios: "banknote", android: "payments", web: "payments" }}
                tintColor={paymentMethod === "cod" ? colors.cyan : colors.muted}
                size={20}
              />
              <View>
                <Text style={styles.methodName}>
                  Thanh toán khi nhận hàng (COD)
                </Text>
                <Text style={styles.methodDesc}>
                  Thanh toán tiền mặt cho nhân viên giao hàng
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.radioCircle,
                paymentMethod === "cod" && styles.radioActive,
              ]}
            >
              {paymentMethod === "cod" ? (
                <View style={styles.radioDot} />
              ) : null}
            </View>
          </Pressable>

          <Pressable
            onPress={() => setPaymentMethod("bank_transfer")}
            style={[
              styles.methodOption,
              paymentMethod === "bank_transfer" && styles.methodOptionActive,
            ]}
          >
            <View style={styles.methodLeft}>
              <SymbolView
                name={{
                  ios: "creditcard",
                  android: "credit_card",
                  web: "credit_card",
                }}
                tintColor={
                  paymentMethod === "bank_transfer" ? colors.cyan : colors.muted
                }
                size={20}
              />
              <View>
                <Text style={styles.methodName}>Chuyển khoản ngân hàng</Text>
                <Text style={styles.methodDesc}>
                  Quét mã QR qua app ngân hàng
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.radioCircle,
                paymentMethod === "bank_transfer" && styles.radioActive,
              ]}
            >
              {paymentMethod === "bank_transfer" ? (
                <View style={styles.radioDot} />
              ) : null}
            </View>
          </Pressable>

          <Pressable
            onPress={() => setPaymentMethod("e_wallet")}
            style={[
              styles.methodOption,
              paymentMethod === "e_wallet" && styles.methodOptionActive,
            ]}
          >
            <View style={styles.methodLeft}>
              <SymbolView
                name={{
                  ios: "wallet.pass",
                  android: "account_balance_wallet",
                  web: "account_balance_wallet",
                }}
                tintColor={
                  paymentMethod === "e_wallet" ? colors.cyan : colors.muted
                }
                size={20}
              />
              <View>
                <Text style={styles.methodName}>
                  Ví điện tử (MoMo / ZaloPay)
                </Text>
                <Text style={styles.methodDesc}>
                  Thanh toán tiện lợi, bảo mật
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.radioCircle,
                paymentMethod === "e_wallet" && styles.radioActive,
              ]}
            >
              {paymentMethod === "e_wallet" ? (
                <View style={styles.radioDot} />
              ) : null}
            </View>
          </Pressable>
        </View>

        {/* Note */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ghi chú đơn hàng (Tùy chọn)</Text>
          <TextInput
            placeholder="Lưu ý khi giao hàng, thời gian nhận mong muốn..."
            placeholderTextColor={colors.muted}
            value={note}
            onChangeText={setNote}
            style={styles.noteInput}
          />
        </View>

        {/* Price Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chi tiết hóa đơn</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tạm tính</Text>
            <Text style={styles.priceVal}>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Thuế (10%)</Text>
            <Text style={styles.priceVal}>{formatCurrency(tax)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Phí vận chuyển</Text>
            <Text style={styles.priceVal}>{formatCurrency(shippingFee)}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Giảm giá</Text>
              <Text style={[styles.priceVal, styles.discountVal]}>
                -{formatCurrency(discount)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalVal}>{formatCurrency(total)}</Text>
          </View>
        </View>
      </ScrollView>

      {deliveryInfoError ? (
        <Text accessibilityRole="alert" style={styles.deliveryInfoError}>
          {deliveryInfoError}
        </Text>
      ) : null}

      {/* Bottom Sticky Action */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomLeft}>
          <Text style={styles.bottomTotalLabel}>Tổng thanh toán:</Text>
          <Text style={styles.bottomTotalVal}>{formatCurrency(total)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={submitting || profileLoading}
          onPress={handlePlaceOrder}
          style={[
            styles.submitButton,
            (submitting || profileLoading) && styles.submitButtonDisabled,
          ]}
        >
          <Text style={styles.submitButtonText}>
            {profileLoading ? "Đang tải thông tin..." : submitting ? "Đang đặt hàng..." : "Đặt hàng"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFB",
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EDF1F3",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  headerPlaceholder: {
    width: 36,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EDF1F3",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 12,
  },
  changeActionText: {
    fontSize: 13,
    color: colors.cyan,
    fontWeight: "600",
  },
  addressInfo: {
    paddingTop: 2,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 5,
  },
  addressDetail: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
  profileLoadError: {
    fontSize: 12,
    color: colors.danger,
    lineHeight: 18,
    marginBottom: 10,
  },
  deliveryInfoError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.white,
  },
  addressForm: {
    gap: 8,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#EDF1F3",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: "#FBFCFD",
  },
  multilineInput: {
    height: 60,
    paddingTop: 8,
    textAlignVertical: "top",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.softBg,
    marginRight: 12,
  },
  productCopy: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  productVariant: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  productQuantity: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.cyan,
    marginLeft: 8,
  },
  methodOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EDF1F3",
    marginBottom: 8,
    backgroundColor: "#FBFCFD",
  },
  methodOptionActive: {
    borderColor: colors.cyan,
    backgroundColor: colors.paleCyan,
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  methodName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  methodDesc: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#CED3DC",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  radioActive: {
    borderColor: colors.cyan,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.cyan,
  },
  noteInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#EDF1F3",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: "#FBFCFD",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  priceLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  priceVal: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  discountVal: {
    color: colors.danger,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  totalVal: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.cyan,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: "#EEF0F2",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  bottomLeft: {
    flex: 1,
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  bottomTotalVal: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.cyan,
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: colors.cyan,
    paddingHorizontal: 26,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
