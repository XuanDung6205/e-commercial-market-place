import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/src/services/supabase'; // đổi theo đường dẫn thật của bạn

export default function AdminLayout() {
  const [access, setAccess] = useState<'loading' | 'admin' | 'denied'>('loading');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return mounted && setAccess('denied');
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (mounted) setAccess(profile?.role === 'admin' ? 'admin' : 'denied');
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (access === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (access === 'denied') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}