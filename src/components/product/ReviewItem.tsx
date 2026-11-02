import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/src/constants/colors';
import { Review } from '@/src/types/models';

type ReviewItemProps = {
  review: Review;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: string) => Promise<string | null>;
};

export function ReviewItem({ review, onEdit, onDelete }: ReviewItemProps) {
  const {
    id,
    userName,
    userAvatar,
    rating,
    createdAt,
    isVerifiedBuyer,
    comment,
    images,
    tags,
    isOwner,
  } = review;

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const initial = (userName || 'U').trim().slice(0, 1).toUpperCase();

  const handleConfirmDelete = () => {
    setDeleteError(null);
    setConfirmDeleteVisible(true);
  };

  const confirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError(null);
    const error = await onDelete(id);
    setDeleting(false);
    if (error) {
      setDeleteError(error);
      return;
    }
    setConfirmDeleteVisible(false);
  };

  return (
    <View style={[styles.card, isOwner && styles.ownerCard]}>
      {/* User Header */}
      <View style={styles.headerRow}>
        <View style={styles.userBlock}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}

          <View style={styles.nameBlock}>
            <View style={styles.nameBadgeRow}>
              <Text style={styles.userName}>
                {userName}
                {isOwner ? ' (Bạn)' : ''}
              </Text>
              {isVerifiedBuyer ? (
                <View style={styles.verifiedBadge}>
                  <SymbolView
                    name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                    tintColor={colors.success}
                    size={11}
                  />
                  <Text style={styles.verifiedText}>Đã mua hàng</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.dateText}>{createdAt}</Text>
          </View>
        </View>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <SymbolView
              key={star}
              name={{
                ios: star <= rating ? 'star.fill' : 'star',
                android: star <= rating ? 'star' : 'star_border',
                web: star <= rating ? 'star' : 'star_border',
              }}
              tintColor={star <= rating ? colors.star : '#D8DCE3'}
              size={13}
            />
          ))}
        </View>
      </View>

      {/* Review Content */}
      <Text style={styles.comment}>{comment}</Text>

      {/* Tags */}
      {tags && tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {tags.map((tag, idx) => (
            <View key={idx} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Attached Images */}
      {images && images.length > 0 ? (
        <View style={styles.imagesRow}>
          {images.map((imgUrl, idx) => (
            <Pressable key={idx} onPress={() => setActiveImage(imgUrl)}>
              <Image source={{ uri: imgUrl }} style={styles.reviewImage} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Owner Actions (Edit & Delete) */}
      {isOwner ? (
        <View style={styles.ownerActionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chỉnh sửa đánh giá"
            hitSlop={6}
            onPress={() => onEdit?.(review)}
            style={styles.editActionBtn}
          >
            <SymbolView
              name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
              tintColor={colors.cyan}
              size={13}
            />
            <Text style={styles.editActionText}>Chỉnh sửa</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa đánh giá"
            hitSlop={6}
            onPress={handleConfirmDelete}
            style={styles.deleteActionBtn}
          >
            <SymbolView
              name={{ ios: 'trash', android: 'delete_outline', web: 'delete' }}
              tintColor={colors.danger}
              size={13}
            />
            <Text style={styles.deleteActionText}>Xóa</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Image Zoom Modal */}
      <Modal visible={!!activeImage} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setActiveImage(null)}>
          <View style={styles.modalContent}>
            {activeImage ? (
              <Image source={{ uri: activeImage }} style={styles.fullImage} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.closeBtn} onPress={() => setActiveImage(null)}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                tintColor={colors.white}
                size={20}
              />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={confirmDeleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setConfirmDeleteVisible(false);
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Xóa đánh giá?</Text>
            <Text style={styles.deleteModalMessage}>
              Đánh giá này sẽ bị xóa vĩnh viễn.
            </Text>
            {deleteError ? <Text style={styles.deleteModalError}>{deleteError}</Text> : null}
            <View style={styles.deleteModalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => setConfirmDeleteVisible(false)}
                style={styles.deleteCancelButton}
              >
                <Text style={styles.deleteCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => void confirmDelete()}
                style={styles.deleteConfirmButton}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Xóa</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF1F3',
  },
  ownerCard: {
    borderColor: '#BFEFF7',
    backgroundColor: '#FAFDFE',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F5F7',
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paleCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.cyan,
  },
  nameBlock: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E6F7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
  },
  dateText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  comment: {
    fontSize: 13,
    color: '#344054',
    lineHeight: 20,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  reviewImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F2F4F7',
  },
  ownerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF1F4',
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  editActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.cyan,
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  deleteActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    height: '80%',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  deleteModalTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteModalMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  deleteModalError: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  deleteCancelButton: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F3F5F7',
  },
  deleteCancelText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.danger,
  },
  deleteConfirmText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
