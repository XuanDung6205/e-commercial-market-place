import {
  C,
  currency,
  Header,
  Icon,
} from "@/src/components/customer/CustomerUI";
import { supabase } from "@/src/services/supabase";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Recommendation = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: { name: string } | null;
};
type ChatMessage = {
  id: string;
  role: "user" | "model";
  content: string;
  products?: Recommendation[];
};

const greeting: ChatMessage = {
  id: "greeting",
  role: "model",
  content:
    "Xin chào! Bạn đang cần tìm sản phẩm nào? Hãy cho mình biết nhu cầu hoặc ngân sách để mình gợi ý nhé.",
};

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const send = async () => {
    const content = input.trim();
    if (!content || loading) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      Alert.alert(
        "Cần đăng nhập",
        "Đăng nhập để trò chuyện với trợ lý tư vấn sản phẩm.",
        [
          { text: "Để sau", style: "cancel" },
          { text: "Đăng nhập", onPress: () => router.push("/(auth)/login") },
        ],
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}`,
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "product-assistant",
        {
          body: {
            messages: nextMessages
              .filter((message) => message.id !== "greeting")
              .slice(-10)
              .map(({ role, content: messageContent }) => ({
                role,
                content: messageContent,
              })),
          },
        },
      );
      if (error) throw error;
      if (typeof data?.message !== "string")
        throw new Error("Phản hồi từ trợ lý không hợp lệ.");
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "model",
          content: data.message,
          products: Array.isArray(data.products)
            ? (data.products as Recommendation[])
            : [],
        },
      ]);
    } catch (error) {
      let message =
        error instanceof Error
          ? error.message
          : "Không gửi được tin nhắn. Vui lòng thử lại.";
      if (error && typeof error === "object" && "context" in error) {
        const context = (error as { context?: unknown }).context;
        if (context && typeof context === "object") {
          try {
            const response = context as {
              status?: number;
              json?: () => Promise<unknown>;
              clone?: () => { json?: () => Promise<unknown> };
            };
            const readable = response.clone?.() ?? response;
            if (readable.json) {
              const payload = (await readable.json()) as { error?: string };
              if (payload.error) message = payload.error;
            }
            if (
              message === "Edge Function returned a non-2xx status code" &&
              response.status
            ) {
              message = `Edge Function trả về lỗi HTTP ${response.status}.`;
            }
          } catch {
            // Use the SDK error message when the function response is not JSON.
          }
        }
      }
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "model",
          content: message.includes("Failed to send a request")
            ? "Chưa kết nối được với trợ lý. Hãy kiểm tra Edge Function đã được deploy và thử lại."
            : message,
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Header title="Trợ lý tư vấn Chợ Mây" back={() => router.back()} />
          <Text style={styles.notice}>
            Gợi ý dựa trên sản phẩm đang bán. Giá và tồn kho được lấy từ cửa
            hàng.
          </Text>
          <ScrollView
            ref={scrollRef}
            style={styles.chat}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.role === "user" && styles.userRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    message.role === "user"
                      ? styles.userBubble
                      : styles.assistantBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.role === "user" && styles.userText,
                    ]}
                  >
                    {message.content}
                  </Text>
                </View>
                {message.products?.map((product) => (
                  <Pressable
                    key={product.id}
                    style={styles.productCard}
                    onPress={() => router.push(`/product/${product.id}`)}
                  >
                    {product.image_url ? (
                      <Image
                        source={{ uri: product.image_url }}
                        style={styles.productImage}
                      />
                    ) : (
                      <View style={[styles.productImage, styles.imageFallback]}>
                        <Icon name="package" size={20} color={C.cyan} />
                      </View>
                    )}
                    <View style={styles.productInfo}>
                      {product.category?.name ? (
                        <Text style={styles.category}>
                          {product.category.name}
                        </Text>
                      ) : null}
                      <Text numberOfLines={2} style={styles.productName}>
                        {product.name}
                      </Text>
                      <Text style={styles.price}>
                        {currency(product.price)}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            {loading ? (
              <View
                style={[styles.bubble, styles.assistantBubble, styles.typing]}
              >
                <ActivityIndicator color={C.cyan} />
                <Text style={styles.muted}>Đang tìm gợi ý...</Text>
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ví dụ: quà tặng dưới 500.000đ..."
              placeholderTextColor="#9298A2"
              style={styles.input}
              multiline
              maxLength={1200}
              editable={!loading}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
              disabled={!input.trim() || loading}
              onPress={() => void send()}
              style={[
                styles.sendButton,
                (!input.trim() || loading) && styles.sendDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="chat" color="#fff" size={20} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 18, paddingBottom: 8 },
  notice: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -8,
    marginBottom: 8,
  },
  chat: { flex: 1 },
  messages: { gap: 14, paddingVertical: 12 },
  messageRow: { alignItems: "flex-start", gap: 8 },
  userRow: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  assistantBubble: { backgroundColor: "#F1F3F5", borderTopLeftRadius: 5 },
  userBubble: { backgroundColor: C.cyan, borderTopRightRadius: 5 },
  messageText: { color: C.ink, fontSize: 14, lineHeight: 20 },
  userText: { color: "#fff" },
  productCard: {
    width: "88%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 9,
    gap: 10,
  },
  productImage: {
    width: 62,
    height: 62,
    borderRadius: 8,
    backgroundColor: C.soft,
  },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  productInfo: { flex: 1, gap: 3 },
  category: { color: C.muted, fontSize: 10 },
  productName: { color: C.ink, fontSize: 12, fontWeight: "600" },
  price: { color: C.red, fontSize: 12, fontWeight: "700" },
  chevron: { color: C.muted, fontSize: 24 },
  typing: { flexDirection: "row", alignItems: "center", gap: 8 },
  muted: { color: C.muted, fontSize: 12 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 10,
    color: C.ink,
    fontSize: 13,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
});
