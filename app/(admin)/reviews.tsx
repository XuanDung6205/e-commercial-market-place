import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AdminBottomNav } from '@/src/components/admin/AdminBottomNav';
import {
  AdminReview,
  ReviewStatusFilter,
  approveReview,
  deleteReview,
  getAdminReviews,
  rejectReview,
} from '@/src/services/admin/reviewService';

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState<ReviewStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // ==================== LOAD REVIEWS ====================

  const loadReviews = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await getAdminReviews('all');
      setReviews(data);
    } catch (error: any) {
      console.error('Load reviews error:', error);
      showMessage(
        'Lỗi tải đánh giá',
        error?.message || 'Không thể tải danh sách đánh giá từ máy chủ.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  // ==================== COUNTS & FILTERING ====================

  const pendingCount = useMemo(
    () => reviews.filter((r) => r.status === 'pending').length,
    [reviews],
  );

  const approvedCount = useMemo(
    () => reviews.filter((r) => r.status === 'approved').length,
    [reviews],
  );

  const rejectedCount = useMemo(
    () => reviews.filter((r) => r.status === 'rejected').length,
    [reviews],
  );

  const filteredReviews = useMemo(() => {
    if (filter === 'all') return reviews;
    return reviews.filter((review) => review.status === filter);
  }, [reviews, filter]);

  // ==================== ACTION HANDLERS ====================

  const handleApprove = (review: AdminReview) => {
    const execute = async () => {
      try {
        setProcessingId(review.id);
        await approveReview(review.id);
        setReviews((prev) =>
          prev.map((r) =>
            r.id === review.id ? { ...r, status: 'approved' } : r,
          ),
        );
        showMessage('Thành công', 'Đã duyệt đánh giá và hiển thị công khai.');
      } catch (error: any) {
        console.error('Approve error:', error);
        showMessage('Lỗi', error?.message || 'Không thể duyệt đánh giá.');
      } finally {
        setProcessingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Bạn có chắc chắn muốn duyệt đánh giá này không?')) {
        void execute();
      }
    } else {
      Alert.alert(
        'Duyệt đánh giá',
        'Đánh giá sẽ được hiển thị công khai trên trang sản phẩm.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Duyệt', onPress: () => void execute() },
        ],
      );
    }
  };

  const handleReject = (review: AdminReview) => {
    const execute = async () => {
      try {
        setProcessingId(review.id);
        await rejectReview(review.id);
        setReviews((prev) =>
          prev.map((r) =>
            r.id === review.id ? { ...r, status: 'rejected' } : r,
          ),
        );
        showMessage('Thành công', 'Đã ẩn đánh giá khỏi trang sản phẩm.');
      } catch (error: any) {
        console.error('Reject error:', error);
        showMessage('Lỗi', error?.message || 'Không thể ẩn đánh giá.');
      } finally {
        setProcessingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Bạn có chắc chắn muốn ẩn đánh giá này không?')) {
        void execute();
      }
    } else {
      Alert.alert(
        'Ẩn đánh giá',
        'Đánh giá này sẽ bị ẩn và không hiển thị cho người dùng.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Ẩn', style: 'destructive', onPress: () => void execute() },
        ],
      );
    }
  };

  const handleDelete = (review: AdminReview) => {
    const execute = async () => {
      try {
        setProcessingId(review.id);
        await deleteReview(review.id);
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        showMessage('Thành công', 'Đã xóa vĩnh viễn đánh giá.');
      } catch (error: any) {
        console.error('Delete error:', error);
        showMessage('Lỗi', error?.message || 'Không thể xóa đánh giá.');
      } finally {
        setProcessingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (
        window.confirm(
          'Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này? Hành động này không thể hoàn tác.',
        )
      ) {
        void execute();
      }
    } else {
      Alert.alert(
        'Xóa đánh giá',
        'Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này? Dữ liệu không thể khôi phục.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Xóa', style: 'destructive', onPress: () => void execute() },
        ],
      );
    }
  };

  // ==================== FILTER TAB BUTTON ====================

  const renderFilterButton = (
    label: string,
    value: ReviewStatusFilter,
    count: number,
  ) => {
    const active = filter === value;
    return (
      <TouchableOpacity
        key={value}
        style={[styles.filterButton, active && styles.activeFilter]}
        onPress={() => setFilter(value)}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterText, active && styles.activeFilterText]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Kiểm duyệt đánh giá</Text>
          <Text style={styles.headerSubtitle}>
            {reviews.length} đánh giá
            {pendingCount > 0 ? ` • ${pendingCount} chờ duyệt` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void loadReviews(true)}
          disabled={loading || refreshing}
        >
          <Ionicons name="reload-outline" size={18} color="#00BCD4" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {renderFilterButton('Tất cả', 'all', reviews.length)}
        {renderFilterButton('Chờ duyệt', 'pending', pendingCount)}
        {renderFilterButton('Đã duyệt', 'approved', approvedCount)}
        {renderFilterButton('Đã ẩn', 'rejected', rejectedCount)}
      </View>

      {/* Reviews List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>Đang tải đánh giá từ hệ thống...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadReviews(true)}
              colors={['#00BCD4']}
            />
          }
        >
          {filteredReviews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>Không có đánh giá nào</Text>
              <Text style={styles.emptyText}>
                {filter === 'pending'
                  ? 'Hiện không có đánh giá nào đang chờ kiểm duyệt.'
                  : filter === 'approved'
                    ? 'Chưa có đánh giá nào được duyệt.'
                    : filter === 'rejected'
                      ? 'Chưa có đánh giá nào bị ẩn.'
                      : 'Hệ thống chưa có đánh giá nào từ khách hàng.'}
              </Text>
            </View>
          ) : (
            filteredReviews.map((review) => {
              const isProcessing = processingId === review.id;

              return (
                <View key={review.id} style={styles.reviewCard}>
                  {/* Reviewer Header */}
                  <View style={styles.reviewerRow}>
                    {review.userAvatar ? (
                      <Image
                        source={{ uri: review.userAvatar }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitial}>
                          {review.userName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.reviewerInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.reviewerName} numberOfLines={1}>
                          {review.userName}
                        </Text>
                        {/* Rating stars */}
                        <View style={styles.starRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={
                                star <= review.rating ? 'star' : 'star-outline'
                              }
                              size={13}
                              color={star <= review.rating ? '#FBBF24' : '#D1D5DB'}
                            />
                          ))}
                        </View>
                      </View>

                      <Text style={styles.reviewDate}>
                        {formatDate(review.createdAt)}
                      </Text>
                    </View>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        review.status === 'approved'
                          ? styles.statusApproved
                          : review.status === 'rejected'
                            ? styles.statusRejected
                            : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          review.status === 'approved'
                            ? styles.textApproved
                            : review.status === 'rejected'
                              ? styles.textRejected
                              : styles.textPending,
                        ]}
                      >
                        {review.status === 'approved'
                          ? 'Đã duyệt'
                          : review.status === 'rejected'
                            ? 'Đã ẩn'
                            : 'Chờ duyệt'}
                      </Text>
                    </View>
                  </View>

                  {/* Review Comment */}
                  {review.comment ? (
                    <Text style={styles.reviewContent}>{review.comment}</Text>
                  ) : (
                    <Text style={styles.noCommentText}>
                      (Khách hàng không để lại nhận xét bằng lời)
                    </Text>
                  )}

                  {/* Tags */}
                  {review.tags && review.tags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {review.tags.map((tag, idx) => (
                        <View key={idx} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Review Images */}
                  {review.images && review.images.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.imageScroll}
                    >
                      {review.images.map((imgUrl, idx) => (
                        <Image
                          key={idx}
                          source={{ uri: imgUrl }}
                          style={styles.reviewImageThumb}
                        />
                      ))}
                    </ScrollView>
                  ) : null}

                  {/* Product Info Box */}
                  <View style={styles.productBox}>
                    {review.productImage ? (
                      <Image
                        source={{ uri: review.productImage }}
                        style={styles.productImageThumb}
                      />
                    ) : (
                      <View style={styles.productPlaceholder}>
                        <Ionicons
                          name="cube-outline"
                          size={16}
                          color="#00BCD4"
                        />
                      </View>
                    )}

                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {review.productName}
                      </Text>
                      {review.orderId ? (
                        <Text style={styles.productOrderCode}>
                          Đơn hàng: #{review.orderId.slice(0, 8)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionRow}>
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#00BCD4" />
                    ) : (
                      <>
                        {review.status !== 'approved' ? (
                          <TouchableOpacity
                            style={styles.approveButton}
                            onPress={() => handleApprove(review)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#00BCD4"
                            />
                            <Text style={styles.approveButtonText}>
                              {review.status === 'rejected'
                                ? 'Duyệt lại'
                                : 'Duyệt'}
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                        {review.status !== 'rejected' ? (
                          <TouchableOpacity
                            style={styles.hideButton}
                            onPress={() => handleReject(review)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="eye-off-outline"
                              size={14}
                              color="#F59E0B"
                            />
                            <Text style={styles.hideButtonText}>Ẩn</Text>
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDelete(review)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color="#EF4444"
                          />
                          <Text style={styles.deleteButtonText}>Xóa</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <AdminBottomNav activeTab="reviews" />
    </SafeAreaView>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },

  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },

  activeFilter: {
    backgroundColor: '#E0F7FA',
  },

  filterText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },

  activeFilterText: {
    color: '#00838F',
    fontWeight: '700',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },

  list: {
    flex: 1,
  },

  listContent: {
    padding: 14,
    paddingBottom: 24,
  },

  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#E2E8F0',
  },

  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#00838F',
  },

  reviewerInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: 150,
  },

  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },

  reviewDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  statusPending: {
    backgroundColor: '#FEF3C7',
  },

  statusApproved: {
    backgroundColor: '#DCFCE7',
  },

  statusRejected: {
    backgroundColor: '#FEE2E2',
  },

  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  textPending: {
    color: '#D97706',
  },

  textApproved: {
    color: '#16A34A',
  },

  textRejected: {
    color: '#DC2626',
  },

  reviewContent: {
    fontSize: 12,
    lineHeight: 18,
    color: '#334155',
    marginBottom: 10,
  },

  noCommentText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#94A3B8',
    marginBottom: 10,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },

  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },

  tagChipText: {
    fontSize: 10,
    color: '#475569',
  },

  imageScroll: {
    gap: 8,
    marginBottom: 10,
  },

  reviewImageThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },

  productBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
    gap: 10,
  },

  productImageThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },

  productPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#E0F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  productInfo: {
    flex: 1,
  },

  productName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },

  productOrderCode: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },

  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00BCD4',
    backgroundColor: '#E0F7FA',
  },

  approveButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00838F',
  },

  hideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },

  hideButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },

  deleteButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },

  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
