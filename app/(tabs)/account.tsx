import {
  C,
  Header,
  Icon,
  Page,
  Row,
} from "@/src/components/customer/CustomerUI";
import { supabase } from "@/src/services/supabase";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

type Profile = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
};

export default function AccountScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const loadProfile = useCallback(async () => {
    setError("");
    setProfile(null);
    setEmail("");
    setIsAuthenticated(null);
    let authStatusLoaded = false;
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      setIsAuthenticated(Boolean(user));
      if (user) {
        setEmail(user.email ?? "");
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, address, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        setProfile(
          data ?? {
            full_name: String(
              user.user_metadata?.full_name ?? "Nguyễn Minh Anh",
            ),
          },
        );
      } else {
        setEmail("");
        setProfile(null);
      }
    } catch (loadError) {
      if (!authStatusLoaded) setIsAuthenticated(false);
      setProfile(null);
      setEmail("");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được thông tin tài khoản.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const logout = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setIsAuthenticated(false);
      setProfile(null);
      setEmail("");
      router.replace("/(auth)/login");
    } catch (signOutError) {
      Alert.alert(
        "Không thể đăng xuất",
        signOutError instanceof Error
          ? signOutError.message
          : "Vui lòng thử lại.",
      );
    }
  };

  return (
    <Page>
      <Header title="Tài khoản" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.initials}>
              {(profile?.full_name || email || "N")
                .trim()
                .slice(0, 1)
                .toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.name}>
            {profile?.full_name?.trim() || "Guest"}
          </Text>
          <Text style={styles.email}>{email}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/profile/edit")}
          style={styles.editButton}
        >
          <Icon name="edit" color={C.cyan} size={16} />
          <Text style={styles.editLabel}>Chỉnh sửa</Text>
        </Pressable>
      </View>
      <View style={styles.menu}>
        <Row
          icon="orders"
          title="Đơn hàng của tôi"
          subtitle="Theo dõi và quản lý đơn hàng"
          onPress={() => router.push("/my-orders")}
        />
        <Row
          icon="heart"
          title="Sản phẩm yêu thích"
          onPress={() => router.push("/(tabs)/favorites")}
        />
        <Row
          icon="pin"
          title="Địa chỉ giao hàng"
          subtitle={profile?.address?.trim() || "Chưa cập nhật địa chỉ"}
          onPress={() => router.push("/profile/edit")}
        />
        <Row
          icon="card"
          title="Phương thức thanh toán"
          subtitle="COD, Chuyển khoản, Ví điện tử"
          onPress={() =>
            Alert.alert(
              "Thanh toán",
              "Phương thức thanh toán được chọn khi đặt hàng.",
            )
          }
        />
        <Row
          icon="bell"
          title="Thông báo"
          onPress={() => router.push("/(tabs)/inbox")}
        />
        <Row
          icon="help"
          title="Trợ giúp và hỗ trợ"
          onPress={() =>
            Alert.alert("Trợ giúp", "Liên hệ Chợ Mây qua hotline: 1900 6868")
          }
        />
      </View>
      {isAuthenticated === null ? null : isAuthenticated ? (
        <Pressable
          accessibilityRole="button"
          style={styles.logout}
          onPress={() => void logout()}
        >
          <Icon name="logout" color={C.red} size={18} />
          <Text style={styles.logoutText}>{"\u0110\u0103ng xu\u1ea5t"}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          style={[styles.logout, styles.login]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Icon name="login" color={C.cyan} size={18} />
          <Text style={styles.loginText}>{"\u0110\u0103ng nh\u1eadp"}</Text>
        </Pressable>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#DDF7FA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  initials: { color: "#008C9E", fontWeight: "700", fontSize: 24 },
  profileCopy: { flex: 1 },
  name: { fontSize: 16, color: C.ink, fontWeight: "700" },
  email: { fontSize: 12, color: C.muted, marginTop: 4 },
  editButton: {
    borderWidth: 1,
    borderColor: C.cyan,
    borderRadius: 6,
    height: 36,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editLabel: { color: C.cyan, fontSize: 11, fontWeight: "600" },
  menu: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  logout: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: "#F1B9B7",
    borderRadius: 7,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { fontSize: 14, color: C.red, fontWeight: "700" },
  login: { borderColor: C.cyan },
  loginText: { fontSize: 14, color: C.cyan, fontWeight: "700" },
  error: { color: C.red, fontSize: 13, marginBottom: 12 },
});
