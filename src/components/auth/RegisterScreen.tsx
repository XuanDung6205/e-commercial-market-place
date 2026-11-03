import { Link, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { signUpWithEmail } from "@/src/services/auth.service";

const colors = {
  ink: "#2B2F3A",
  muted: "#8A8F9C",
  border: "#E3E5EA",
  cyan: "#00BCD4",
  paleCyan: "#E6F9FC",
  white: "#FFFFFF",
  danger: "#D92D20",
  success: "#16803C",
};

type RegisterFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoComplete: "name" | "email" | "new-password";
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
  returnKeyType?: "next" | "done";
};

function RegisterField({
  label,
  value,
  onChangeText,
  placeholder,
  autoComplete,
  keyboardType = "default",
  secureTextEntry = false,
  returnKeyType = "next",
}: RegisterFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoComplete === "name" ? "words" : "none"}
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType={returnKeyType}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMessage("Vui lòng nhập họ và tên.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (confirmation !== password) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await signUpWithEmail(cleanName, cleanEmail, password);
      if (error) {
        setErrorMessage(
          error.message.toLowerCase().includes("already registered") ||
            error.message.toLowerCase().includes("already exists")
            ? "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác."
            : error.message,
        );
        return;
      }

      if (data.session) {
        router.replace("/(tabs)/home");
        return;
      }

      setSuccessMessage(
        `Tài khoản đã được tạo. Hãy kiểm tra email ${cleanEmail} để xác nhận trước khi đăng nhập.`,
      );
    } catch {
      setErrorMessage("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>+</Text>
          </View>
          <View style={styles.welcomeBlock}>
            <Text style={styles.eyebrow}>CHỢ MÂY</Text>
            <Text style={styles.title}>Tạo tài khoản</Text>
            <Text style={styles.subtitle}>Điền thông tin để bắt đầu mua sắm</Text>
          </View>

          <View style={styles.formCard}>
            <RegisterField
              label="Họ và tên"
              autoComplete="name"
              onChangeText={setName}
              placeholder="Nhập họ và tên"
              value={name}
            />
            <RegisterField
              label="Email"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Nhập địa chỉ email"
              value={email}
            />
            <RegisterField
              label="Mật khẩu"
              autoComplete="new-password"
              onChangeText={setPassword}
              placeholder="Ít nhất 8 ký tự"
              secureTextEntry
              value={password}
            />
            <RegisterField
              label="Xác nhận mật khẩu"
              autoComplete="new-password"
              onChangeText={setConfirmation}
              placeholder="Nhập lại mật khẩu"
              returnKeyType="done"
              secureTextEntry
              value={confirmation}
            />

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorMessage}>
                {errorMessage}
              </Text>
            ) : null}
            {successMessage ? (
              <Text accessibilityRole="alert" style={styles.successMessage}>
                {successMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleRegister}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !isSubmitting ? styles.submitButtonPressed : null,
                isSubmitting ? styles.submitButtonDisabled : null,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Đăng ký</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Đã có tài khoản? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <Text style={styles.loginLink}>Đăng nhập</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F8FA" },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: 28, paddingHorizontal: 22, paddingBottom: 28 },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.paleCyan,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  brandMarkText: { color: colors.cyan, fontSize: 34, fontWeight: "500", lineHeight: 40 },
  welcomeBlock: { marginBottom: 22 },
  eyebrow: { color: colors.cyan, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 27, lineHeight: 35, fontWeight: "700", marginTop: 7 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  formCard: {
    width: "100%",
    padding: 17,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EDF1F3",
    shadowColor: "#162B36",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  fieldGroup: { marginBottom: 15 },
  label: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "500", marginBottom: 7 },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    color: colors.ink,
    fontSize: 14,
    backgroundColor: "#FBFCFD",
  },
  errorMessage: { color: colors.danger, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  successMessage: { color: colors.success, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  submitButton: {
    height: 52,
    width: "100%",
    borderRadius: 10,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonPressed: { opacity: 0.86 },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: colors.white, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  loginRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 23 },
  loginPrompt: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  loginLink: { color: colors.cyan, fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
