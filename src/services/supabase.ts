import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "react-native-url-polyfill/auto";

const DEFAULT_SUPABASE_URL = "https://ggoaesupdakpbtfeegnv.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "sb_publishable_RWeQwxxPVuzQqwSU3yHjRQ_7MEkm07o";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  DEFAULT_SUPABASE_ANON_KEY;

if (
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  !(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )
) {
  console.warn(
    "[Supabase] Environment variables missing; using fallback credentials."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
