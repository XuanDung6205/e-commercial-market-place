import { RatingSummary } from "@/src/components/product/RatingSummary";
import { ReviewItem } from "@/src/components/product/ReviewItem";
import { colors } from "@/src/constants/colors";
import { ProductService } from "@/src/services/product.service";
import {
  ReviewService,
  ReviewSortOption,
  ReviewStats,
} from "@/src/services/review.service";
import { useCart, useFavorites } from "@/src/store/marketplaceStore";
import { Product, Review } from "@/src/types/models";
import { formatCurrency } from "@/src/utils/formatCurrency";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SORT_TABS: { id: ReviewSortOption; label: string }[] = [
  { id: "newest", label: "Mới nhất" },
  { id: "highest", label: "Điểm cao nhất" },
  { id: "lowest", label: "Điểm thấp nhất" },
];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loadedProduct, setLoadedProduct] = useState<Product | null>(null);
  const [loadedProductId, setLoadedProductId] = useState<string | null>(null);
  const [loadedProductError, setLoadedProductError] = useState<string | null>(
    null,
  );
  const [productLoadAttempt, setProductLoadAttempt] = useState(0);

  const { addToCart, totalQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reviews state from Supabase
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<ReviewSortOption>("newest");
  const [stats, setStats] = useState<ReviewStats>({
    average: 0,
    total: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

  const product = loadedProductId === id ? loadedProduct : null;
  const productError = loadedProductId === id ? loadedProductError : null;
  const loadingProduct = loadedProductId !== id;
  const favorited = product ? isFavorite(product.id) : false;
  const selectedVariant = product?.variant;

  useEffect(() => {
    let active = true;

    if (!id || !isUuid(id)) {
      Promise.resolve().then(() => {
        if (!active) return;
        setLoadedProduct(null);
        setLoadedProductError("Mã sản phẩm không hợp lệ.");
        setLoadedProductId(id ?? "");
      });
      return () => {
        active = false;
      };
    }

    void ProductService.getById(id)
      .then((loadedProduct) => {
        if (!active) return;
        if (!loadedProduct) {
          setLoadedProduct(null);
          setLoadedProductError(
            "Không tìm thấy sản phẩm đang hoạt động trong Supabase.",
          );
          setLoadedProductId(id);
          return;
        }
        setLoadedProduct(loadedProduct);
        setLoadedProductError(null);
        setLoadedProductId(id);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadedProduct(null);
          setLoadedProductError(
            error instanceof Error ? error.message : "Không thể tải sản phẩm.",
          );
          setLoadedProductId(id);
        }
      });

    return () => {
      active = false;
    };
  }, [id, productLoadAttempt]);

  const loadReviews = useCallback(async () => {
    if (!product) {
      setReviews([]);
      setReviewError(null);
      setStats({
        average: 0,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
      setLoadingReviews(false);
      return;
    }

    setLoadingReviews(true);
    setReviewError(null);

    try {
      const reviewsResult = await ReviewService.getReviewsByProduct(
        product.id,
        sortOption,
      );

      if (reviewsResult.error) {
        setReviewError(reviewsResult.error);
        setReviews([]);
      } else {
        const fetchedReviews = reviewsResult.reviews;
        setReviews(fetchedReviews);

        // Calculate real stats from Supabase reviews
        if (fetchedReviews.length > 0) {
          const calculated = ReviewService.calculateStats(fetchedReviews);
          setStats(calculated);
        } else {
          setStats({
            average: 0,
            total: 0,
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          });
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Lỗi kết nối khi tải đánh giá.";
      setReviewError(msg);
    } finally {
      setLoadingReviews(false);
    }
  }, [product, sortOption]);

  // Reload reviews on mount and when screen is focused (e.g. after returning from feedback screen)
  useFocusEffect(
    useCallback(() => {
      void loadReviews();
    }, [loadReviews]),
  );

  const handleAddToCart = async () => {
    if (!product) return;
    setActionError(null);
    const error = await addToCart(product, quantity, selectedVariant);
    if (error) {
      setActionError(error);
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBuyNow = () => {
    if (!product) return;
    setActionError(null);
    router.push({
      pathname: "/payment",
      params: {
        buyNowProductId: product.id,
        buyNowQuantity: String(quantity),
        ...(selectedVariant ? { buyNowVariant: selectedVariant } : {}),
      },
    });
  };

  const handleToggleFavorite = async () => {
    if (!product) return;
    setActionError(null);
    const error = await toggleFavorite(product.id, product);
    if (error) {
      setActionError(error);
    }
  };

  const handleEditReview = (rev: Review) => {
    if (!product) return;
    router.push({
      pathname: "/feedback",
      params: {
        productId: product.id,
        productName: product.name,
        image: product.image,
        ...(selectedVariant ? { variant: selectedVariant } : {}),
        reviewId: rev.id,
        initialRating: String(rev.rating),
        initialComment: rev.comment,
      },
    });
  };

  const handleDeleteReview = async (
    reviewId: string,
  ): Promise<string | null> => {
    const { success, error } = await ReviewService.deleteReview(reviewId);
    if (!success || error) {
      return error || "Đã có lỗi xảy ra khi xóa đánh giá.";
    }

    await loadReviews();
    return null;
  };

  if (loadingProduct) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.productState}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.loadingText}>
            Đang tải sản phẩm từ Supabase...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (productError || !product) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.productState}>
          <Text style={styles.errorText}>
            {productError || "Không tìm thấy sản phẩm."}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setLoadedProductId(null);
              setProductLoadAttempt((attempt) => attempt + 1);
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            tintColor={colors.ink}
            size={22}
          />
        </Pressable>

        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yêu thích"
            hitSlop={10}
            onPress={() => void handleToggleFavorite()}
            style={styles.headerButton}
          >
            <SymbolView
              name={{
                ios: favorited ? "heart.fill" : "heart",
                android: favorited ? "favorite" : "favorite_border",
                web: favorited ? "favorite" : "favorite_border",
              }}
              tintColor={favorited ? "#F04438" : colors.ink}
              size={22}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Giỏ hàng"
            hitSlop={10}
            onPress={() => router.push("/cart")}
            style={styles.headerButton}
          >
            <SymbolView
              name={{
                ios: "cart",
                android: "shopping_cart",
                web: "shopping_cart",
              }}
              tintColor={colors.ink}
              size={22}
            />
            {totalQuantity > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalQuantity > 99 ? "99+" : totalQuantity}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {product.image ? (
            <Image
              source={{ uri: product.image }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={styles.emptySubtitle}>
                Sản phẩm chưa có hình ảnh
              </Text>
            </View>
          )}
          {product.tag ? (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{product.tag}</Text>
            </View>
          ) : null}
        </View>

        {/* Pricing & Rating */}
        <View style={styles.infoCard}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
            {product.compareAtPrice ? (
              <Text style={styles.comparePrice}>
                {formatCurrency(product.compareAtPrice)}
              </Text>
            ) : null}
          </View>

          <Text style={styles.title}>{product.name}</Text>

          <View style={styles.metaRow}>
            <View style={styles.ratingBox}>
              <SymbolView
                name={{ ios: "star.fill", android: "star", web: "star" }}
                tintColor={colors.star}
                size={14}
              />
              <Text style={styles.ratingText}>
                {stats.total > 0
                  ? stats.average.toString().replace(".", ",")
                  : "Chưa có"}
              </Text>
              <Text style={styles.reviewCountText}>
                ({stats.total} đánh giá)
              </Text>
            </View>
            <Text style={styles.stockText}>
              Kho: {product.stock ?? 0} sản phẩm
            </Text>
          </View>
        </View>

        {/* Quantity selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Số lượng</Text>
          <View style={styles.stepperRow}>
            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel="Giảm"
                hitSlop={8}
                disabled={quantity <= 1}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                style={styles.stepBtn}
              >
                <Text
                  style={[
                    styles.stepBtnText,
                    quantity <= 1 && styles.stepBtnDisabled,
                  ]}
                >
                  −
                </Text>
              </Pressable>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <Pressable
                accessibilityLabel="Tăng"
                hitSlop={8}
                onPress={() => setQuantity(quantity + 1)}
                style={styles.stepBtn}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
          <Text style={styles.description}>
            {product.description || "Chưa có mô tả cho sản phẩm này."}
          </Text>
        </View>

        {/* Đánh giá và bình luận của người mua từ Supabase */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <View>
              <Text style={styles.sectionTitle}>Đánh giá & Bình luận</Text>
              <Text style={styles.reviewsSubText}>
                Đánh giá từ đơn hàng đã giao
              </Text>
            </View>
          </View>

          {/* Rating Summary Breakdown from Supabase stats */}
          <RatingSummary
            rating={stats.average}
            totalReviews={stats.total}
            distribution={stats.distribution}
          />

          {/* Sort Tabs */}
          <View style={styles.sortTabsRow}>
            <Text style={styles.sortTitle}>Sắp xếp:</Text>
            {SORT_TABS.map((tab) => {
              const active = sortOption === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setSortOption(tab.id)}
                  style={[styles.sortTab, active && styles.sortTabActive]}
                >
                  <Text
                    style={[
                      styles.sortTabText,
                      active && styles.sortTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Reviews List or State Indicators */}
          {loadingReviews ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.cyan} />
              <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
            </View>
          ) : reviewError ? (
            <View style={styles.errorContainer}>
              <SymbolView
                name={{
                  ios: "exclamationmark.triangle",
                  android: "warning",
                  web: "warning",
                }}
                tintColor={colors.danger}
                size={28}
              />
              <Text style={styles.errorText}>{reviewError}</Text>
              <Pressable
                onPress={() => void loadReviews()}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <SymbolView
                  name={{
                    ios: "bubble.left.and.bubble.right",
                    android: "chat",
                    web: "chat",
                  }}
                  tintColor={colors.cyan}
                  size={32}
                />
              </View>
              <Text style={styles.emptyTitle}>Chưa có đánh giá nào</Text>
              <Text style={styles.emptySubtitle}>
                Đánh giá sẽ hiển thị tại đây sau khi đơn hàng được giao.
              </Text>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((rev) => (
                <ReviewItem
                  key={rev.id}
                  review={rev}
                  onEdit={handleEditReview}
                  onDelete={handleDeleteReview}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        {actionError ? (
          <View style={styles.actionError}>
            <Text style={styles.actionErrorText}>{actionError}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={handleAddToCart}
          style={[styles.addCartBtn, added && styles.addCartBtnSuccess]}
        >
          <SymbolView
            name={{
              ios: added ? "checkmark" : "cart.badge.plus",
              android: added ? "check" : "add_shopping_cart",
              web: added ? "check" : "add_shopping_cart",
            }}
            tintColor={added ? colors.white : colors.cyan}
            size={18}
          />
          <Text
            style={[styles.addCartText, added && styles.addCartTextSuccess]}
          >
            {added ? "Đã thêm vào giỏ" : "Thêm vào giỏ"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handleBuyNow}
          style={styles.buyNowBtn}
        >
          <Text style={styles.buyNowText}>Mua ngay</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  notFoundText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  backText: { color: colors.cyan, fontSize: 14, fontWeight: "700" },
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFB",
  },
  productState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EDF1F3",
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    backgroundColor: "#F04438",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imageContainer: {
    width: "100%",
    height: 320,
    backgroundColor: colors.white,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softBg,
  },
  tagBadge: {
    position: "absolute",
    left: 16,
    bottom: 16,
    backgroundColor: "#F1EAFD",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    color: "#7C5CE0",
    fontSize: 12,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: colors.white,
    padding: 18,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.cyan,
  },
  comparePrice: {
    fontSize: 14,
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 25,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  reviewCountText: {
    fontSize: 12,
    color: colors.muted,
  },
  stockText: {
    fontSize: 12,
    color: colors.muted,
  },
  sectionCard: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 6,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F5F7",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
  },
  stepBtnDisabled: {
    color: "#CED3DC",
  },
  quantityValue: {
    minWidth: 36,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  description: {
    fontSize: 13,
    color: "#4B5565",
    lineHeight: 21,
    marginTop: 4,
  },
  reviewsSection: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 10,
  },
  reviewsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  reviewsSubText: {
    fontSize: 12,
    color: colors.muted,
  },
  sortTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sortTitle: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
    marginRight: 2,
  },
  sortTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F5F7",
  },
  sortTabActive: {
    backgroundColor: colors.paleCyan,
    borderWidth: 1,
    borderColor: "#BFEFF7",
  },
  sortTabText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
  },
  sortTabTextActive: {
    color: colors.cyan,
  },
  reviewsList: {
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
  errorContainer: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FEE4E2",
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  },
  emptyContainer: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paleCyan,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: "#EEF0F2",
  },
  actionError: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: "100%",
    backgroundColor: "#FEE4E2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  actionErrorText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: "center",
  },
  addCartBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    backgroundColor: colors.paleCyan,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addCartBtnSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  addCartText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.cyan,
  },
  addCartTextSuccess: {
    color: colors.white,
  },
  buyNowBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  buyNowText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
});
