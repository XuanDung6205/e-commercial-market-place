import {
  C,
  currency,
  EmptyState,
  Header,
  Icon,
  Page,
} from "@/src/components/customer/CustomerUI";
import { supabase } from "@/src/services/supabase";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Product = {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number | null;
  product_images?: { image_url: string }[];
};

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const search = useCallback(async (term: string) => {
    const cleaned = term.trim();
    const sequence = ++requestSequence.current;
    setLoading(true);
    setSearched(true);
    setError("");
    try {
      let request = supabase
        .from("products")
        .select("id, name, price, compare_at_price, product_images(image_url)")
        .eq("status", "active");
      if (cleaned) {
        request = request.ilike(
          "name",
          "%" + cleaned.replace(/[%_]/g, "\\$&") + "%",
        );
      }
      const { data, error: queryError } = await request
        .order("created_at", { ascending: false })
        .limit(100);
      if (sequence !== requestSequence.current) return;
      if (queryError) {
        setError(
          "T\u00ecm ki\u1ebfm ch\u01b0a kh\u1ea3 d\u1ee5ng. Ki\u1ec3m tra k\u1ebft n\u1ed1i v\u00e0 b\u1ea3ng s\u1ea3n ph\u1ea9m tr\u00ean Supabase.",
        );
        setProducts([]);
      } else {
        setProducts((data ?? []) as Product[]);
      }
    } catch {
      if (sequence === requestSequence.current) {
        setError(
          "Kh\u00f4ng th\u1ec3 k\u1ebft n\u1ed1i \u0111\u1ec3 t\u1ea3i s\u1ea3n ph\u1ea9m. Vui l\u00f2ng th\u1eed l\u1ea1i.",
        );
        setProducts([]);
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!query.trim()) void search("");
    }, [query, search]),
  );

  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      void search(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  const clearSearch = () => {
    setQuery("");
  };

  return (
    <Page>
      <Header title="Tìm kiếm sản phẩm" />
      <View style={styles.searchBox}>
        <Icon name="search" size={19} color={C.muted} />
        <TextInput
          autoCapitalize="none"
          returnKeyType="search"
          value={query}
          onChangeText={(value) => {
            requestSequence.current += 1;
            setQuery(value);
          }}
          placeholder="Bạn đang tìm sản phẩm nào?"
          placeholderTextColor="#9AA0A9"
          style={styles.input}
          onSubmitEditing={() => void search(query)}
        />
        {query ? (
          <Pressable onPress={clearSearch} hitSlop={9}>
            <Icon name="close" color={C.muted} size={17} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        style={styles.assistantButton}
        onPress={() => router.push("/assistant" as never)}
      >
        <View style={styles.assistantIcon}>
          <Icon name="chat" size={18} color={C.cyan} />
        </View>
        <View style={styles.assistantCopy}>
          <Text style={styles.assistantTitle}>
            Nhờ trợ lý Chợ Mây tư vấn chọn sản phẩm
          </Text>
          <Text style={styles.assistantHint}>
            Mô tả nhu cầu, trợ lý sẽ gợi ý từ cửa hàng
          </Text>
        </View>
        <Text style={styles.assistantChevron}>›</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={C.cyan} />
          <Text style={styles.helper}>Đang tìm sản phẩm...</Text>
        </View>
      ) : error ? (
        <EmptyState title="Không thể tìm kiếm" detail={error} />
      ) : searched && products.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sản phẩm"
          detail={`Không có kết quả phù hợp với “${query.trim()}”.`}
        />
      ) : !searched ? (
        <View style={styles.intro}>
          <View style={styles.searchIcon}>
            <Icon name="search" size={25} color={C.cyan} />
          </View>
          <Text style={styles.introTitle}>Tìm sản phẩm yêu thích</Text>
          <Text style={styles.helper}>
            Nhập tên sản phẩm để xem kết quả phù hợp.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>{products.length} kết quả</Text>
          <View style={styles.grid}>
            {products.map((product) => (
              <Pressable
                key={product.id}
                onPress={() => router.push(`/product/${product.id}`)}
                style={styles.productCard}
              >
                {product.product_images?.[0]?.image_url ? (
                  <Image
                    source={{ uri: product.product_images[0].image_url }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.productImage, styles.imageFallback]}>
                    <Icon name="package" size={29} color={C.cyan} />
                  </View>
                )}
                <Text numberOfLines={2} style={styles.productName}>
                  {product.name}
                </Text>
                <Text style={styles.price}>{currency(product.price)}</Text>
                {product.compare_at_price ? (
                  <Text style={styles.compare}>
                    {currency(product.compare_at_price)}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  assistantButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EAFBFC",
    borderRadius: 8,
    padding: 11,
    marginTop: 11,
  },
  assistantIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  assistantCopy: { flex: 1 },
  assistantTitle: { color: C.ink, fontSize: 12, fontWeight: "700" },
  assistantHint: { color: C.muted, fontSize: 10, marginTop: 3 },
  assistantChevron: { color: C.cyan, fontSize: 22 },
  input: { flex: 1, color: C.ink, fontSize: 13, paddingVertical: 10 },
  loading: { paddingTop: 48, alignItems: "center", gap: 10 },
  helper: { color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 18 },
  intro: { alignItems: "center", paddingTop: 76, paddingHorizontal: 25 },
  searchIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#E8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  introTitle: {
    color: C.ink,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 7,
  },
  resultCount: { color: C.muted, fontSize: 12, marginVertical: 14 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 15,
  },
  productCard: {
    width: "48%",
    borderRadius: 8,
    overflow: "hidden",
    paddingBottom: 8,
    borderColor: "#F0F1F3",
    borderWidth: 1,
  },
  productImage: { width: "100%", height: 150, backgroundColor: "#F5F6F8" },
  imageFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFFBFC",
  },
  productName: {
    color: C.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    marginHorizontal: 9,
    marginTop: 9,
    minHeight: 32,
  },
  price: {
    color: C.red,
    fontWeight: "700",
    fontSize: 13,
    marginHorizontal: 9,
    marginTop: 6,
  },
  compare: {
    color: C.muted,
    fontSize: 10,
    textDecorationLine: "line-through",
    marginHorizontal: 9,
    marginTop: 3,
  },
});
