import { Platform } from "react-native";
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

// SSR-safe storage adapter for Supabase Auth across Android, iOS, Web, and Node.js bundling
const ExpoSupabaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      if (
        typeof window === "undefined" ||
        typeof window.localStorage === "undefined"
      ) {
        return null;
      }
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (
        typeof window === "undefined" ||
        typeof window.localStorage === "undefined"
      ) {
        return;
      }
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (
        typeof window === "undefined" ||
        typeof window.localStorage === "undefined"
      ) {
        return;
      }
      window.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: ExpoSupabaseStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
