
import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  SafeAreaView,
} from 'react-native';

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../src/services/supabase';

type DiscountType = 'percentage' | 'fixed';

export default function AddVoucherScreen() {
  const router = useRouter();

  // ==================== FORM STATE ====================

  const [code, setCode] = useState('');

  const [discountType, setDiscountType] =
    useState<DiscountType>('percentage');

  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minOrder, setMinOrder] = useState('');

  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // ==================== SHOW MESSAGE ====================

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

  // ==================== DATE FORMAT ====================

  // Người dùng nhập dd/mm/yyyy.
  // Chuyển sang ISO string để lưu vào PostgreSQL timestamptz.

  const convertDate = (
    date: string,
    isEndDate: boolean = false,
  ): string | null => {
    const trimmedDate = date.trim();

    if (!trimmedDate) {
      return null;
    }

    const parts = trimmedDate.split('/');

    if (parts.length !== 3) {
      return null;
    }

    const [day, month, year] = parts;

    if (
      !day ||
      !month ||
      !year ||
      day.length !== 2 ||
      month.length !== 2 ||
      year.length !== 4
    ) {
      return null;
    }

    const dayNumber = Number(day);
    const monthNumber = Number(month);
    const yearNumber = Number(year);

    const parsedDate = new Date(
      yearNumber,
      monthNumber - 1,
      dayNumber,
    );

    // Kiểm tra ngày có tồn tại thực tế.
    if (
      parsedDate.getFullYear() !== yearNumber ||
      parsedDate.getMonth() !== monthNumber - 1 ||
      parsedDate.getDate() !== dayNumber
    ) {
      return null;
    }

    if (isEndDate) {
      // Ngày hết hạn bao gồm toàn bộ ngày đó.
      parsedDate.setHours(23, 59, 59, 999);
    } else {
      // Ngày bắt đầu từ 00:00:00.
      parsedDate.setHours(0, 0, 0, 0);
    }

    return parsedDate.toISOString();
  };

  // ==================== SAVE VOUCHER ====================

  const handleSave = async () => {
    if (saving) {
      return;
    }

    const normalizedCode = code.trim().toUpperCase();

    // Kiểm tra mã voucher.
    if (!normalizedCode) {
      showMessage(
        'Thiếu thông tin',
        'Vui lòng nhập mã voucher.',
      );
      return;
    }

    // Chỉ cho phép chữ in hoa và số.
    if (!/^[A-Z0-9]+$/.test(normalizedCode)) {
      showMessage(
        'Mã voucher không hợp lệ',
        'Mã voucher chỉ được chứa chữ in hoa và số, không có khoảng trắng.',
      );
      return;
    }

    // Kiểm tra giá trị giảm.
    const discountValue = Number(value);

    if (
      !value.trim() ||
      !Number.isFinite(discountValue) ||
      discountValue <= 0
    ) {
      showMessage(
        'Giá trị không hợp lệ',
        'Vui lòng nhập giá trị giảm lớn hơn 0.',
      );
      return;
    }

    // Giảm phần trăm không được vượt quá 100%.
    if (
      discountType === 'percentage' &&
      discountValue > 100
    ) {
      showMessage(
        'Giá trị không hợp lệ',
        'Mức giảm phần trăm không được vượt quá 100%.',
      );
      return;
    }

    // Chuyển đổi ngày.
    const formattedStartDate = convertDate(
      startDate,
      false,
    );

    const formattedEndDate = convertDate(
      endDate,
      true,
    );

    if (!formattedStartDate) {
      showMessage(
        'Ngày bắt đầu không hợp lệ',
        'Vui lòng nhập ngày bắt đầu theo định dạng dd/mm/yyyy.',
      );
      return;
    }

    if (!formattedEndDate) {
      showMessage(
        'Ngày hết hạn không hợp lệ',
        'Vui lòng nhập ngày hết hạn theo định dạng dd/mm/yyyy.',
      );
      return;
    }

    // Kiểm tra ngày kết thúc phải sau hoặc bằng ngày bắt đầu.
    const startTimestamp = new Date(
      formattedStartDate,
    ).getTime();

    const endTimestamp = new Date(
      formattedEndDate,
    ).getTime();

    if (endTimestamp < startTimestamp) {
      showMessage(
        'Ngày không hợp lệ',
        'Ngày hết hạn phải lớn hơn hoặc bằng ngày bắt đầu.',
      );
      return;
    }

    // Kiểm tra đơn tối thiểu.
    const normalizedMinOrder = minOrder
      .trim()
      .replace(/\./g, '')
      .replace(/,/g, '');

    const minimumOrderValue = Number(
      normalizedMinOrder,
    );

    if (
      !normalizedMinOrder ||
      !Number.isFinite(minimumOrderValue) ||
      minimumOrderValue < 0
    ) {
      showMessage(
        'Đơn tối thiểu không hợp lệ',
        'Vui lòng nhập giá trị đơn hàng tối thiểu hợp lệ.',
      );
      return;
    }

    try {
      setSaving(true);

      // Lưu voucher vào Supabase.
      // Các tên cột đã khớp với bảng vouchers.

      const { error } = await supabase
        .from('vouchers')
        .insert({
          code: normalizedCode,

          discount_type: discountType,

          discount_value: discountValue,

          starts_at: formattedStartDate,

          expires_at: formattedEndDate,

          min_order_amount: minimumOrderValue,

          is_active: isActive,
        });

      if (error) {
        throw error;
      }

      showMessage(
        'Thành công',
        'Voucher đã được tạo thành công.',
      );

      // Quay về trang quản lý voucher.
      router.replace('/(admin)/vouchers');
    } catch (error: any) {
      console.error(
        'Save voucher error:',
        error,
      );

      showMessage(
        'Lỗi',
        error?.message ||
          'Không thể lưu voucher. Vui lòng thử lại.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ==================== MAIN UI ====================

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color="#333"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Thêm voucher
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* INFORMATION BANNER */}

          <View style={styles.infoBanner}>
            <Ionicons
              name="ticket-outline"
              size={22}
              color="#7c3aed"
              style={styles.bannerIcon}
            />

            <Text style={styles.bannerText}>
              Tạo ưu đãi mới để khách hàng mua sắm nhiều hơn.
            </Text>
          </View>

          {/* VOUCHER CODE */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Mã voucher
            </Text>

            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(text) =>
                setCode(text.toUpperCase())
              }
              placeholder="Nhập mã voucher"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.helperText}>
              Chỉ dùng chữ in hoa và số, không có khoảng trắng.
            </Text>
          </View>

          {/* DISCOUNT TYPE */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Loại giảm
            </Text>

            <View style={styles.discountTypeRow}>
              <TouchableOpacity
                style={[
                  styles.discountTypeButton,
                  discountType === 'percentage' &&
                    styles.discountTypeButtonActive,
                ]}
                onPress={() =>
                  setDiscountType('percentage')
                }
              >
                <Text
                  style={[
                    styles.discountTypeText,
                    discountType === 'percentage' &&
                      styles.discountTypeTextActive,
                  ]}
                >
                  Phần trăm (%)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.discountTypeButton,
                  discountType === 'fixed' &&
                    styles.discountTypeButtonActive,
                ]}
                onPress={() =>
                  setDiscountType('fixed')
                }
              >
                <Text
                  style={[
                    styles.discountTypeText,
                    discountType === 'fixed' &&
                      styles.discountTypeTextActive,
                  ]}
                >
                  Số tiền (đ)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DISCOUNT VALUE */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Giá trị giảm
            </Text>

            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={
                discountType === 'percentage'
                  ? 'Nhập phần trăm giảm'
                  : 'Nhập số tiền giảm'
              }
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />

            <Text style={styles.helperText}>
              {discountType === 'percentage'
                ? 'Ví dụ: 15 tương ứng giảm 15%.'
                : 'Nhập số tiền giảm bằng VNĐ.'}
            </Text>
          </View>

          {/* START DATE */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Ngày bắt đầu
            </Text>

            <View style={styles.dateInputContainer}>
              <TextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="dd/mm/yyyy"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              <Ionicons
                name="calendar-outline"
                size={18}
                color="#888"
              />
            </View>
          </View>

          {/* END DATE */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Ngày hết hạn
            </Text>

            <View style={styles.dateInputContainer}>
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="dd/mm/yyyy"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              <Ionicons
                name="calendar-outline"
                size={18}
                color="#888"
              />
            </View>
          </View>

          {/* MINIMUM ORDER */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Đơn tối thiểu
            </Text>

            <View style={styles.currencyInputContainer}>
              <TextInput
                style={styles.currencyInput}
                value={minOrder}
                onChangeText={setMinOrder}
                placeholder="Nhập đơn tối thiểu"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              <Text style={styles.currencySymbol}>
                đ
              </Text>
            </View>
          </View>

          {/* ACTIVE SWITCH */}

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>
                Kích hoạt ngay
              </Text>

              <Text style={styles.switchDescription}>
                Cho phép khách hàng sử dụng voucher.
              </Text>
            </View>

            <Switch
              trackColor={{
                false: '#e2e8f0',
                true: '#00c4cc',
              }}
              thumbColor={
                isActive ? '#ffffff' : '#f4f3f4'
              }
              onValueChange={setIsActive}
              value={isActive}
            />
          </View>
        </ScrollView>

        {/* FOOTER */}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <Text style={styles.saveButtonText}>
                Lưu voucher
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  backButton: {
    paddingRight: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },

  // SCROLL
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // INFO BANNER
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginVertical: 12,
  },

  bannerIcon: {
    marginRight: 10,
  },

  bannerText: {
    flex: 1,
    color: '#7e22ce',
    fontSize: 13,
    lineHeight: 18,
  },

  // INPUT GROUP
  inputGroup: {
    marginTop: 14,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#FFFFFF',
  },

  helperText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },

  // DISCOUNT TYPE
  discountTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },

  discountTypeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  discountTypeButtonActive: {
    backgroundColor: '#e0fafa',
    borderColor: '#00c4cc',
  },

  discountTypeText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  discountTypeTextActive: {
    color: '#00aab2',
    fontWeight: '700',
  },

  // DATE
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
  },

  dateInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },

  // CURRENCY
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
  },

  currencyInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },

  currencySymbol: {
    fontSize: 15,
    color: '#64748b',
  },

  // SWITCH
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },

  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },

  switchDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },

  // FOOTER
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#FFFFFF',
  },

  saveButton: {
    backgroundColor: '#00c4cc',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },

  saveButtonDisabled: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
