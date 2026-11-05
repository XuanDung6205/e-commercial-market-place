import { supabase } from '@/src/services/supabase';
import { Review } from '@/src/types/models';

export type ReviewSortOption = 'newest' | 'highest' | 'lowest';

export type ReviewStats = {
  average: number;
  total: number;
  distribution: { [star: number]: number };
};

type ProfileJoin = {
  full_name: string | null;
  avatar_url: string | null;
};

type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  review_images: {
    image_url: string;
  }[] | null;
  tags: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: ProfileJoin | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function mapRowToReview(row: ReviewRow, currentUserId: string | null): Review {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    orderId: row.order_id,
    userName: row.profiles?.full_name?.trim() || 'Người dùng Chợ Mây',
    userAvatar: row.profiles?.avatar_url || null,
    rating: row.rating,
    comment: row.comment || '',
    images: row.review_images?.map((image) => image.image_url) || [],
    tags: row.tags || [],
    createdAt: formatDate(row.created_at),
    updatedAt: row.updated_at,
    isVerifiedBuyer: Boolean(row.order_id),
    isOwner: Boolean(currentUserId && currentUserId === row.user_id),
  };
}

async function replaceReviewImages(
  reviewId: string,
  imageUrls: string[]
): Promise<string | null> {
  // Xóa ảnh cũ khi cập nhật review
  const { error: deleteError } = await supabase
    .from('review_images')
    .delete()
    .eq('review_id', reviewId);

  if (deleteError) return deleteError.message;

  if (imageUrls.length === 0) return null;

  // Lưu URL ảnh mới
  const { error: insertError } = await supabase
    .from('review_images')
    .insert(
      imageUrls.map((imageUrl) => ({
        review_id: reviewId,
        image_url: imageUrl,
      }))
    );

  if (insertError) return insertError.message;

  return null;
}

export const ReviewService = {
  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      return user;
    } catch {
      return null;
    }
  },

  /**
   * Fetch all approved reviews for a given product from Supabase
   */
  async getReviewsByProduct(
    productId: string,
    sort: ReviewSortOption = 'newest'
  ): Promise<{ reviews: Review[]; error: string | null }> {
    if (!isUuid(productId)) return { reviews: [], error: null };

    try {
      const currentUser = await this.getCurrentUser();
      const currentUserId = currentUser?.id ?? null;

      let query = supabase
        .from('reviews')
        .select(`
          id,
          product_id,
          user_id,
          order_id,
          rating,
          comment,
          review_images (
            image_url
          ),
          tags,
          status,
          created_at,
          updated_at,
          profiles:profiles!reviews_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('product_id', productId);

      if (sort === 'highest') {
        query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
      } else if (sort === 'lowest') {
        query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ReviewService] getReviewsByProduct failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        return { reviews: [], error: error.message };
      }

      const rows = (data || []) as unknown as ReviewRow[];
      const reviews = rows.map((r) => mapRowToReview(r, currentUserId));

      return { reviews, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách đánh giá.';
      return { reviews: [], error: message };
    }
  },

  /**
   * Calculate average rating, total count, and 1-5 star distribution from Supabase reviews
   */
  calculateStats(reviews: Review[]): ReviewStats {
    const total = reviews.length;
    if (total === 0) {
      return {
        average: 0,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    const average = Number((sum / total).toFixed(1));

    const counts: { [star: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[star] = (counts[star] || 0) + 1;
    }

    const distribution: { [star: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const star of [1, 2, 3, 4, 5]) {
      distribution[star] = Math.round((counts[star] / total) * 100);
    }

    return { average, total, distribution };
  },

  /**
   * Check if current user has already reviewed the product
   */
  async getUserReviewForProduct(
    productId: string
  ): Promise<{ review: Review | null; error: string | null }> {
    if (!isUuid(productId)) return { review: null, error: null };

    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) return { review: null, error: null };

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          product_id,
          user_id,
          order_id,
          rating,
          comment,
          review_images (
            image_url
          ),
          tags,
          status,
          created_at,
          updated_at,
          profiles:profiles!reviews_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('product_id', productId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        return { review: null, error: error.message };
      }

      if (!data) return { review: null, error: null };

      const row = data as unknown as ReviewRow;
      return { review: mapRowToReview(row, currentUser.id), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi khi kiểm tra đánh giá.';
      return { review: null, error: message };
    }
  },

  async getUserReviewsForProducts(
    productIds: string[]
  ): Promise<{ reviews: Record<string, Review>; error: string | null }> {
    const validProductIds = [...new Set(productIds.filter(isUuid))];
    if (validProductIds.length === 0) return { reviews: {}, error: null };

    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { reviews: {}, error: 'Vui lòng đăng nhập để xem đánh giá của bạn.' };
      }

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          product_id,
          user_id,
          order_id,
          rating,
          comment,
          review_images (image_url),
          tags,
          status,
          created_at,
          updated_at,
          profiles:profiles!reviews_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', currentUser.id)
        .in('product_id', validProductIds);

      if (error) return { reviews: {}, error: error.message };

      const rows = (data ?? []) as unknown as ReviewRow[];
      const reviews = rows.reduce<Record<string, Review>>((result, row) => {
        result[row.product_id] = mapRowToReview(row, currentUser.id);
        return result;
      }, {});
      return { reviews, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi khi tải đánh giá của bạn.';
      return { reviews: {}, error: message };
    }
  },

  /**
   * Create a new review in Supabase
   */

  async createReview(params: {
    productId: string;
    rating: number;
    comment: string;
    tags?: string[];
    images?: string[];
    orderId: string;
  }): Promise<{ review: Review | null; error: string | null }> {
    if (!isUuid(params.productId)) {
      return { review: null, error: 'Mã sản phẩm không hợp lệ.' };
    }
    if (!isUuid(params.orderId)) {
      return { review: null, error: 'Chỉ có thể đánh giá sản phẩm từ đơn hàng đã giao.' };
    }

    try {
      const currentUser = await this.getCurrentUser();

      if (!currentUser) {
        return { review: null, error: 'Vui lòng đăng nhập để đánh giá sản phẩm.' };
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', params.orderId)
        .eq('user_id', currentUser.id)
        .eq('status', 'delivered')
        .maybeSingle();

      if (orderError) return { review: null, error: orderError.message };
      if (!order) {
        return {
          review: null,
          error: 'Bạn chỉ có thể đánh giá sản phẩm từ đơn hàng đã giao của mình.',
        };
      }

      const { data: purchasedItem, error: itemError } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', order.id)
        .eq('product_id', params.productId)
        .limit(1)
        .maybeSingle();

      if (itemError) return { review: null, error: itemError.message };
      if (!purchasedItem) {
        return {
          review: null,
          error: 'Sản phẩm này không thuộc đơn hàng đã giao được chọn.',
        };
      }

      const { review: existingReview } =
        await this.getUserReviewForProduct(params.productId);

      if (existingReview) {
        return {
          review: existingReview,
          error: 'Bạn đã đánh giá sản phẩm này rồi. Bạn có thể chỉnh sửa đánh giá hiện tại.',
        };
      }

      const cleanRating = Math.min(5, Math.max(1, Math.round(params.rating)));

      // Tạo review trước
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          product_id: params.productId,
          user_id: currentUser.id,
          order_id: params.orderId,
          rating: cleanRating,
          comment: params.comment.trim(),
          tags: params.tags || [],
          status: 'pending',
        })
        .select(`
        id,
        product_id,
        user_id,
        order_id,
        rating,
        comment,
        tags,
        status,
        created_at,
        updated_at,
        profiles:profiles!reviews_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
        .single();

      if (error) {
        if (error.code === '23505') {
          return {
            review: null,
            error: 'Bạn đã đánh giá sản phẩm này rồi. Hãy chỉnh sửa đánh giá của bạn.',
          };
        }

        return { review: null, error: error.message };
      }

      // Lưu ảnh vào bảng review_images
      const imageUrls = params.images || [];

      if (imageUrls.length > 0) {
        const { error: imageError } = await supabase
          .from('review_images')
          .insert(
            imageUrls.map((imageUrl) => ({
              review_id: data.id,
              image_url: imageUrl,
            }))
          );

        if (imageError) {
          // Xóa review nếu lưu ảnh thất bại
          await supabase
            .from('reviews')
            .delete()
            .eq('id', data.id)
            .eq('user_id', currentUser.id);

          return { review: null, error: imageError.message };
        }
      }

      const row = {
        ...(data as unknown as ReviewRow),
        review_images: imageUrls.map((image_url) => ({ image_url })),
      };

      return {
        review: mapRowToReview(row, currentUser.id),
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể lưu đánh giá.';
      return { review: null, error: message };
    }
  },


  /**
   * Update an existing review in Supabase
   */

  async updateReview(
    reviewId: string,
    params: {
      rating: number;
      comment: string;
      tags?: string[];
      images?: string[];
    }
  ): Promise<{ review: Review | null; error: string | null }> {
    try {
      const currentUser = await this.getCurrentUser();

      if (!currentUser) {
        return { review: null, error: 'Vui lòng đăng nhập để chỉnh sửa đánh giá.' };
      }

      const cleanRating = Math.min(5, Math.max(1, Math.round(params.rating)));

      // Cập nhật nội dung review
      const { data, error } = await supabase
        .from('reviews')
        .update({
          rating: cleanRating,
          comment: params.comment.trim(),
          tags: params.tags || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .eq('user_id', currentUser.id)
        .select(`
        id,
        product_id,
        user_id,
        order_id,
        rating,
        comment,
        tags,
        status,
        created_at,
        updated_at,
        profiles:profiles!reviews_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
        .single();

      if (error) {
        return { review: null, error: error.message };
      }

      // Xóa danh sách ảnh cũ
      const { error: deleteError } = await supabase
        .from('review_images')
        .delete()
        .eq('review_id', reviewId);

      if (deleteError) {
        return { review: null, error: deleteError.message };
      }

      // Thêm danh sách ảnh mới
      const imageUrls = params.images || [];

      if (imageUrls.length > 0) {
        const { error: imageError } = await supabase
          .from('review_images')
          .insert(
            imageUrls.map((imageUrl) => ({
              review_id: reviewId,
              image_url: imageUrl,
            }))
          );

        if (imageError) {
          return { review: null, error: imageError.message };
        }
      }

      const row = {
        ...(data as unknown as ReviewRow),
        review_images: imageUrls.map((image_url) => ({ image_url })),
      };

      return {
        review: mapRowToReview(row, currentUser.id),
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể cập nhật đánh giá.';
      return { review: null, error: message };
    }
  },


  /**
   * Delete an existing review from Supabase
   */
  async deleteReview(reviewId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'Vui lòng đăng nhập để xóa đánh giá.' };
      }

      const { data, error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', currentUser.id)
        .select('id')
        .maybeSingle();

      if (error) {
        return { success: false, error: error.message };
      }
      if (!data) {
        return {
          success: false,
          error: 'Không thể xóa đánh giá này. Có thể bạn không có quyền hoặc đánh giá đã bị xóa.',
        };
      }

      return { success: true, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể xóa đánh giá.';
      return { success: false, error: message };
    }
  },
};
