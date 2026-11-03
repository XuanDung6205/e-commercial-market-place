import { supabase } from '@/src/services/supabase';

export async function uploadProfileAvatar(uri: string, mimeType?: string | null) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Vui lòng đăng nhập để cập nhật ảnh đại diện.');

  const response = await fetch(uri);
  if (!response.ok) throw new Error('Không đọc được ảnh đã chọn.');
  const body = await response.arrayBuffer();
  if (body.byteLength > 5 * 1024 * 1024) throw new Error('Ảnh đại diện phải nhỏ hơn 5 MB.');

  const contentType = mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    ? mimeType
    : 'image/jpeg';
  const extension = contentType.split('/')[1];
  const path = `${user.id}/${Date.now()}.${extension}`;
  const { data, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, body, { contentType, cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(data.path);
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (profileError) {
    await supabase.storage.from('avatars').remove([data.path]);
    throw profileError;
  }
  return publicUrl.publicUrl;
}
