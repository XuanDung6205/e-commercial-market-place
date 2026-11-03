import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, Header, Icon, LoadingState, Page, PrimaryButton } from '@/src/components/customer/CustomerUI';
import { supabase } from '@/src/services/supabase';
import { uploadProfileAvatar } from '@/src/services/storage.service';

export default function EditProfileScreen() {
  const [id, setId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập để chỉnh sửa hồ sơ.');
      router.replace('/(auth)/login');
      setLoading(false);
      return;
    }
    setId(user.id);
    setEmail(user.email ?? '');
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, phone, address, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      Alert.alert('Không tải được hồ sơ', 'Hãy kiểm tra bảng profiles trên Supabase đã có cột address chưa.');
    }
    setName(data?.full_name ?? String(user.user_metadata?.full_name ?? ''));
    setPhone(data?.phone ?? '');
    setAddress(data?.address ?? '');
    setAvatarUrl(data?.avatar_url ?? null);
    setPendingAvatar(null);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const chooseAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Ảnh quá lớn', 'Vui lòng chọn ảnh nhỏ hơn 5 MB.');
        return;
      }
      setPendingAvatar(asset);
    } catch (error) {
      Alert.alert('Không mở được thư viện ảnh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu họ tên', 'Vui lòng nhập họ tên của bạn.');
      return;
    }
    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;
      if (pendingAvatar) {
        nextAvatarUrl = await uploadProfileAvatar(pendingAvatar.uri, pendingAvatar.mimeType);
      }
      const { error } = await supabase.from('profiles').update({
        full_name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        avatar_url: nextAvatarUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      setAvatarUrl(nextAvatarUrl);
      setPendingAvatar(null);
      Alert.alert('Đã lưu', 'Thông tin cá nhân đã được cập nhật.', [{ text: 'Đóng', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Lưu chưa thành công', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Page><Header title="Hồ sơ cá nhân" back={() => router.back()} /><LoadingState /></Page>;
  const visibleAvatar = pendingAvatar?.uri ?? avatarUrl;

  return <Page>
    <Header title="Hồ sơ cá nhân" back={() => router.back()} />
    <Pressable accessibilityRole="button" accessibilityLabel="Chọn ảnh đại diện" onPress={() => void chooseAvatar()} disabled={saving} style={styles.avatarWrap}>
      <View style={styles.avatar}>
        {visibleAvatar ? <Image source={{ uri: visibleAvatar }} style={styles.avatarImage} /> : <Text style={styles.initials}>{name.trim().slice(0, 1).toUpperCase() || 'U'}</Text>}
        <View style={styles.camera}><Icon name="camera" size={13} color="#fff" /></View>
      </View>
      <Text style={styles.changePhoto}>{pendingAvatar ? 'Ảnh mới đã chọn' : 'Thay ảnh đại diện'}</Text>
    </Pressable>
    <Field label="Họ và tên" value={name} onChangeText={setName} placeholder="Nhập họ và tên" />
    <Field label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="Nhập số điện thoại" keyboardType="phone-pad" />
    <Field label="Địa chỉ" value={address} onChangeText={setAddress} placeholder="Nhập địa chỉ giao hàng" multiline />
    <Text style={styles.label}>Email</Text>
    <View style={styles.emailField}><Text style={styles.email}>{email}</Text><Icon name="lock" color={C.muted} size={16} /></View>
    <Text style={styles.hint}>Email được dùng để đăng nhập và không thể chỉnh sửa tại đây.</Text>
    <View style={styles.footer}><PrimaryButton title="Lưu thay đổi" onPress={() => void save()} busy={saving} /></View>
  </Page>;
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; keyboardType?: 'phone-pad' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A1A6AF" keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', marginVertical: 12, marginBottom: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#DDF7FA', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  initials: { color: '#008C9E', fontSize: 34, fontWeight: '700' },
  camera: { position: 'absolute', right: -1, bottom: 1, width: 28, height: 28, borderRadius: 14, backgroundColor: C.cyan, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  changePhoto: { color: C.cyan, fontSize: 13, fontWeight: '600', marginTop: 9 },
  field: { marginBottom: 18 },
  label: { color: C.ink, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 46, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 12, color: C.ink, fontSize: 14, backgroundColor: '#fff' },
  multiline: { minHeight: 88, paddingTop: 12 },
  emailField: { minHeight: 46, paddingHorizontal: 12, borderRadius: 6, backgroundColor: C.soft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  email: { color: C.muted, fontSize: 14 },
  hint: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 7 },
  footer: { marginTop: 28 },
});
