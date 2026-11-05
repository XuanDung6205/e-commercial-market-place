import { supabase } from '@/src/services/supabase';

export type UserRole = 'customer' | 'admin';

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: fullName.trim() },
    },
  });
}

export async function getCurrentUserRole(): Promise<UserRole> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error('Không tìm thấy tài khoản đã đăng nhập.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', userData.user.id)
    .single();

  if (profileError) throw new Error(profileError.message);
  if (profile.account_status !== 'active') {
    throw new Error('Tài khoản của bạn hiện không hoạt động.');
  }
  if (profile.role !== 'customer' && profile.role !== 'admin') {
    throw new Error('Vai trò tài khoản không hợp lệ.');
  }

  return profile.role;
}

export function getAuthenticatedRoute(role: UserRole) {
  return role === 'admin' ? '/(admin)/products' : '/(tabs)/home';
}
