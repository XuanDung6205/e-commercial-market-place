import { supabase } from '../supabase';

// ==================== TYPES ====================

export type AdminReview = {
  id: string;
  productId: string;
  userId: string;
  orderId: string | null;
  rating: number;
  comment: string;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  images: string[];
  productName: string;
  productImage: string | null;
  userName: string;
  userAvatar: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

type RawReviewRow = {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  tags: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
  review_images: { image_url: string }[] | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  products: {
    id: string;
    name: string;
    product_images: { image_url: string }[] | null;
  } | null;
};

function mapRow(row: RawReviewRow): AdminReview {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    orderId: row.order_id,
    rating: row.rating,
    comment: row.comment || '',
    tags: row.tags || [],
    status: row.status || 'pending',
    images: row.review_images?.map((img) => img.image_url) || [],
    productName: row.products?.name || 'Sản phẩm',
    productImage: row.products?.product_images?.[0]?.image_url || null,
    userName: row.profiles?.full_name?.trim() || 'Khách hàng',
    userAvatar: row.profiles?.avatar_url || null,
    moderatedBy: row.moderated_by,
    moderatedAt: row.moderated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== API FUNCTIONS ====================

/**
 * Lấy danh sách tất cả đánh giá từ Supabase với bộ lọc trạng thái
 */
export async function getAdminReviews(
  filter: ReviewStatusFilter = 'all',
): Promise<AdminReview[]> {
  let query = supabase
    .from('reviews')
    .select(`
      id,
      product_id,
      user_id,
      order_id,
      rating,
      comment,
      tags,
      status,
      moderated_by,
      moderated_at,
      created_at,
      updated_at,
      review_images (
        image_url
      ),
      profiles:profiles!reviews_user_id_fkey (
        full_name,
        avatar_url
      ),
      products (
        id,
        name,
        product_images (
          image_url
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getAdminReviews error:', error);
    throw error;
  }

  return (data || []).map((item) => mapRow(item as unknown as RawReviewRow));
}

/**
 * Duyệt đánh giá (chuyển sang approved)
 */
export async function approveReview(reviewId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('reviews')
    .update({
      status: 'approved',
      moderated_by: user?.id ?? null,
      moderated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) {
    console.error('approveReview error:', error);
    throw error;
  }

  return true;
}

/**
 * Ẩn / từ chối đánh giá (chuyển sang rejected)
 */
export async function rejectReview(reviewId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('reviews')
    .update({
      status: 'rejected',
      moderated_by: user?.id ?? null,
      moderated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId);

  if (error) {
    console.error('rejectReview error:', error);
    throw error;
  }

  return true;
}

/**
 * Xóa vĩnh viễn đánh giá
 */
export async function deleteReview(reviewId: string): Promise<boolean> {
  // 1. Xóa ảnh trong review_images (tránh rác dữ liệu)
  await supabase.from('review_images').delete().eq('review_id', reviewId);

  // 2. Xóa bản ghi trong reviews
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);

  if (error) {
    console.error('deleteReview error:', error);
    throw error;
  }

  return true;
}

