import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/src/constants/colors';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { MOCK_PRODUCTS, useCart, useFavorites } from '@/src/store/marketplaceStore';
import { RatingSummary } from '@/src/components/product/RatingSummary';
import { ReviewItem } from '@/src/components/product/ReviewItem';
import { ReviewService, ReviewSortOption, ReviewStats } from '@/src/services/review.service';
import { supabase } from '@/src/services/supabase';
import { Product, Review } from '@/src/types/models';

const SORT_TABS: { id: ReviewSortOption; label: string }[] = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'highest', label: 'Điểm cao nhất' },
  { id: 'lowest', label: 'Điểm thấp nhất' },
];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // State for product details
  const [product, setProduct] = useState<Product>(() => {
    return MOCK_PRODUCTS.find((p) => p.id === id) || MOCK_PRODUCTS[0];
  });

  const { addToCart, totalQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [quantity, setQuantity] = useState(1);
  const [selectedVariant] = useState(product.variant || 'Mặc định');
  const [added, setAdded] = useState(false);

  // Reviews state from Supabase
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<ReviewSortOption>('newest');
  const [stats, setStats] = useState<ReviewStats>({
    average: product.rating,
    total: product.reviewCount,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

  const favorited = isFavorite(product.id);
  const isPersistedProduct = isUuid(product.id);

  // 1. Fetch product from Supabase if id is a UUID
  useEffect(() => {
    let active = true;
    if (id && isUuid(id)) {
      void (async () => {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('*, product_images(image_url)')
            .eq('id', id)
            .maybeSingle();

          if (!active || error || !data) return;

          const img = data.product_images?.[0]?.image_url || MOCK_PRODUCTS[0].image;
          setProduct({
            id: data.id,
            name: data.name,
            price: Number(data.price),
            compareAtPrice: data.compare_at_price ? Number(data.compare_at_price) : undefined,
            image: img,
            rating: 0,
            reviewCount: 0,
            description: data.description || '',
            stock: data.stock_quantity ?? 50,
          });
        } catch {
          // Fallback product kept
        }
      })();
    }

    return () => {
      active = false;
    };
  }, [id]);

  // 2. Fetch reviews and userReview from Supabase
  const loadReviews = useCallback(async () => {
    if (!product.id) return;
    if (!isUuid(product.id)) {
      setReviews([]);
      setUserReview(null);
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
      const [reviewsResult, userReviewResult] = await Promise.all([
        ReviewService.getReviewsByProduct(product.id, sortOption),
        ReviewService.getUserReviewForProduct(product.id),
      ]);

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

      setUserReview(userReviewResult.review);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi tải đánh giá.';
      setReviewError(msg);
    } finally {
      setLoadingReviews(false);
    }
  }, [product.id, sortOption]);

  // Reload reviews on mount and when screen is focused (e.g. after returning from feedback screen)
  useFocusEffect(
    useCallback(() => {
      void loadReviews();
    }, [loadReviews])
  );

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity, selectedVariant);
    router.push('/payment');
  };

  const handleWriteReview = async () => {
    if (!isPersistedProduct) {
      Alert.alert('Chưa thể đánh giá', 'Sản phẩm mẫu chưa hỗ trợ lưu đánh giá.');
      return;
    }

    const user = await ReviewService.getCurrentUser();
    if (!user) {
      Alert.alert('Chưa đăng nhập', 'Vui lòng đăng nhập để viết đánh giá cho sản phẩm này.', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    if (userReview) {
      // User has already reviewed -> Edit existing review
      router.push({
        pathname: '/feedback',
        params: {
          productId: product.id,
          productName: product.name,
          image: product.image,
          variant: selectedVariant,
          reviewId: userReview.id,
          initialRating: String(userReview.rating),
          initialComment: userReview.comment,
        },
      });
    } else {
      // Write new review
      router.push({
        pathname: '/feedback',
        params: {
          productId: product.id,
          productName: product.name,
          image: product.image,
          variant: selectedVariant,
        },
      });
    }
  };

  const handleEditReview = (rev: Review) => {
    router.push({
      pathname: '/feedback',
      params: {
        productId: product.id,
        productName: product.name,
        image: product.image,
        variant: selectedVariant,
        reviewId: rev.id,
        initialRating: String(rev.rating),
        initialComment: rev.comment,
      },
    });
  };

  const handleDeleteReview = async (reviewId: string) => {
    setLoadingReviews(true);
    const { success, error } = await ReviewService.deleteReview(reviewId);
    if (!success || error) {
      Alert.alert('Không thể xóa', error || 'Đã có lỗi xảy ra.');
      setLoadingReviews(false);
      return;
    }

    Alert.alert('Thành công', 'Đánh giá của bạn đã được xóa.');
    await loadReviews();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
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
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            tintColor={colors.ink}
            size={22}
          />
        </Pressable>

        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yêu thích"
            hitSlop={10}
            onPress={() => toggleFavorite(product.id)}
            style={styles.headerButton}
          >
            <SymbolView
              name={{
                ios: favorited ? 'heart.fill' : 'heart',
                android: favorited ? 'favorite' : 'favorite_border',
                web: favorited ? 'favorite' : 'favorite_border',
              }}
              tintColor={favorited ? '#F04438' : colors.ink}
              size={22}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Giỏ hàng"
            hitSlop={10}
            onPress={() => router.push('/cart')}
            style={styles.headerButton}
          >
            <SymbolView
              name={{ ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' }}
              tintColor={colors.ink}
              size={22}
            />
            {totalQuantity > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalQuantity > 99 ? '99+' : totalQuantity}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
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
              <Text style={styles.comparePrice}>{formatCurrency(product.compareAtPrice)}</Text>
            ) : null}
          </View>

          <Text style={styles.title}>{product.name}</Text>

          <View style={styles.metaRow}>
            <View style={styles.ratingBox}>
              <SymbolView
                name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                tintColor={colors.star}
                size={14}
              />
              <Text style={styles.ratingText}>
                {stats.total > 0 ? stats.average.toString().replace('.', ',') : 'Chưa có'}
              </Text>
              <Text style={styles.reviewCountText}>
                ({stats.total} đánh giá)
              </Text>
            </View>
            <Text style={styles.stockText}>Kho: {product.stock || 50} sản phẩm</Text>
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
                <Text style={[styles.stepBtnText, quantity <= 1 && styles.stepBtnDisabled]}>−</Text>
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
            {product.description ||
              'Sản phẩm chất lượng cao, nguồn gốc xuất xứ rõ ràng. Đảm bảo giao hàng nhanh chóng và chính sách đổi trả thuận tiện.'}
          </Text>
        </View>

        {/* Đánh giá và bình luận của người mua từ Supabase */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <View>
              <Text style={styles.sectionTitle}>Đánh giá & Bình luận</Text>
              <Text style={styles.reviewsSubText}>Nhận xét từ khách hàng thực tế</Text>
            </View>

            {isPersistedProduct ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={userReview ? 'Sửa đánh giá của bạn' : 'Viết đánh giá'}
                hitSlop={8}
                onPress={handleWriteReview}
                style={[styles.writeReviewBtn, userReview && styles.writeReviewBtnActive]}
              >
                <SymbolView
                  name={{ ios: 'square.and.pencil', android: 'edit', web: 'edit' }}
                  tintColor={colors.cyan}
                  size={14}
                />
                <Text style={styles.writeReviewText}>
                  {userReview ? 'Sửa đánh giá' : 'Viết đánh giá'}
                </Text>
              </Pressable>
            ) : null}
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
                  <Text style={[styles.sortTabText, active && styles.sortTabTextActive]}>
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
                name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
                tintColor={colors.danger}
                size={28}
              />
              <Text style={styles.errorText}>{reviewError}</Text>
              <Pressable onPress={() => void loadReviews()} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <SymbolView
                  name={{ ios: 'bubble.left.and.bubble.right', android: 'chat', web: 'chat' }}
                  tintColor={colors.cyan}
                  size={32}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {isPersistedProduct ? 'Chưa có đánh giá nào' : 'Sản phẩm mẫu'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isPersistedProduct
                  ? 'Hãy là người đầu tiên chia sẻ cảm nhận về sản phẩm này!'
                  : 'Sản phẩm mẫu chưa hỗ trợ lưu và hiển thị đánh giá.'}
              </Text>
              {isPersistedProduct ? (
                <Pressable onPress={handleWriteReview} style={styles.emptyWriteBtn}>
                  <Text style={styles.emptyWriteBtnText}>Viết đánh giá ngay</Text>
                </Pressable>
              ) : null}
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
        <Pressable
          accessibilityRole="button"
          onPress={handleAddToCart}
          style={[styles.addCartBtn, added && styles.addCartBtnSuccess]}
        >
          <SymbolView
            name={{
              ios: added ? 'checkmark' : 'cart.badge.plus',
              android: added ? 'check' : 'add_shopping_cart',
              web: added ? 'check' : 'add_shopping_cart',
            }}
            tintColor={added ? colors.white : colors.cyan}
            size={18}
          />
          <Text style={[styles.addCartText, added && styles.addCartTextSuccess]}>
            {added ? 'Đã thêm vào giỏ' : 'Thêm vào giỏ'}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDF1F3',
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    backgroundColor: '#F04438',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imageContainer: {
    width: '100%',
    height: 320,
    backgroundColor: colors.white,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  tagBadge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    backgroundColor: '#F1EAFD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    color: '#7C5CE0',
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: colors.white,
    padding: 18,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.cyan,
  },
  comparePrice: {
    fontSize: 14,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 25,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
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
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F5F7',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  stepBtnDisabled: {
    color: '#CED3DC',
  },
  quantityValue: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  description: {
    fontSize: 13,
    color: '#4B5565',
    lineHeight: 21,
    marginTop: 4,
  },
  reviewsSection: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 10,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  reviewsSubText: {
    fontSize: 12,
    color: colors.muted,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.paleCyan,
    borderWidth: 1,
    borderColor: '#C6F3F9',
  },
  writeReviewBtnActive: {
    backgroundColor: '#E0F7FA',
    borderColor: colors.cyan,
  },
  writeReviewText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.cyan,
  },
  sortTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sortTitle: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
    marginRight: 2,
  },
  sortTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F5F7',
  },
  sortTabActive: {
    backgroundColor: colors.paleCyan,
    borderWidth: 1,
    borderColor: '#BFEFF7',
  },
  sortTabText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  sortTabTextActive: {
    color: colors.cyan,
  },
  reviewsList: {
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
  errorContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE4E2',
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paleCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  emptyWriteBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.cyan,
  },
  emptyWriteBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F2',
  },
  addCartBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    backgroundColor: colors.paleCyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addCartBtnSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  addCartText: {
    fontSize: 14,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
