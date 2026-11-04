import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  AdminOrder,
  FilterStatus,
  getAdminOrders,
  SortOrder,
  STATUS_LABELS,
} from '@/src/services/admin.order.service';
import { AdminBottomNav } from '@/src/components/admin/AdminBottomNav';
import { formatCurrency } from '@/src/utils/formatCurrency';

const FILTER_TABS: { id: FilterStatus; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xác nhận' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'delivered', label: 'Đã giao' },
];

export default function AdminOrderManagementScreen() {
  const router = useRouter();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<FilterStatus>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getAdminOrders({
        status: activeStatus,
        search,
        sortBy: sortOrder,
      });
      setOrders(data);
    } catch (error) {
      console.error('Lỗi tải danh sách đơn hàng admin:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStatus, search, sortOrder]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
  };

  const renderStatusBadge = (status: string) => {
    const s = status === 'shipped' ? 'shipping' : status;

    let badgeStyle = styles.badgePending;
    let textStyle = styles.badgeTextPending;

    if (s === 'shipping') {
      badgeStyle = styles.badgeShipping;
      textStyle = styles.badgeTextShipping;
    } else if (s === 'delivered') {
      badgeStyle = styles.badgeDelivered;
      textStyle = styles.badgeTextDelivered;
    } else if (s === 'cancelled') {
      badgeStyle = styles.badgeCancelled;
      textStyle = styles.badgeTextCancelled;
    } else if (s === 'confirmed') {
      badgeStyle = styles.badgeConfirmed;
      textStyle = styles.badgeTextConfirmed;
    }

    const label = STATUS_LABELS[s] || s;

    return (
      <View style={[styles.badge, badgeStyle]}>
        <Text style={[styles.badgeText, textStyle]}>{label}</Text>
      </View>
    );
  };

  const renderOrderItem = ({ item }: { item: AdminOrder }) => {
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/(admin)/orders/${item.id}` as any)}
      >
        {/* Row 1: Order ID and Status */}
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>{item.displayId}</Text>
          {renderStatusBadge(item.status)}
        </View>

        {/* Row 2: Customer and Date */}
        <View style={styles.cardMeta}>
          <View style={styles.customerGroup}>
            <Ionicons name="person-outline" size={15} color="#9CA3AF" />
            <Text style={styles.customerName} numberOfLines={1}>
              {item.recipientName}
            </Text>
          </View>
          <Text style={styles.orderDate}>{item.date}</Text>
        </View>

        {/* Row 3: Total amount and Detail link */}
        <View style={styles.cardFooter}>
          <Text style={styles.totalAmount}>{formatCurrency(item.total)}</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/(admin)/orders/${item.id}` as any)}
          >
            <Text style={styles.detailLink}>Xem chi tiết</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý đơn hàng</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo mã đơn hàng"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS !== 'ios' && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Count & Sort Bar */}
      <View style={styles.countAndSortBar}>
        <Text style={styles.countText}>{orders.length} đơn hàng</Text>
        <TouchableOpacity
          style={styles.sortButton}
          activeOpacity={0.7}
          onPress={toggleSort}
        >
          <Ionicons name="calendar-outline" size={15} color="#00BCD4" style={{ marginRight: 4 }} />
          <Text style={styles.sortText}>
            {sortOrder === 'newest' ? 'Mới nhất' : 'Cũ nhất'}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#6B7280" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      {/* Status Filter Chips */}
      <View style={styles.filterTabsWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_TABS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filterTabsContent}
          renderItem={({ item }) => {
            const isActive = activeStatus === item.id;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveStatus(item.id)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Order List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>Đang tải danh sách đơn hàng...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Không có đơn hàng</Text>
          <Text style={styles.emptySubtitle}>
            Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadOrders(true)}
              tintColor="#00BCD4"
              colors={['#00BCD4']}
            />
          }
        />
      )}

      {/* Bottom Navigation */}
      <AdminBottomNav activeTab="orders" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E242B',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  countAndSortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    fontSize: 13,
    color: '#1E242B',
    fontWeight: '500',
  },
  filterTabsWrapper: {
    marginBottom: 14,
  },
  filterTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: {
    backgroundColor: '#E0F7FA',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#00BCD4',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextPending: {
    color: '#B45309',
  },
  badgeConfirmed: {
    backgroundColor: '#E0F2FE',
  },
  badgeTextConfirmed: {
    color: '#0284C7',
  },
  badgeShipping: {
    backgroundColor: '#E0F7FA',
  },
  badgeTextShipping: {
    color: '#00BCD4',
  },
  badgeDelivered: {
    backgroundColor: '#DCFCE7',
  },
  badgeTextDelivered: {
    color: '#16A34A',
  },
  badgeCancelled: {
    backgroundColor: '#FEE2E2',
  },
  badgeTextCancelled: {
    color: '#DC2626',
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  customerName: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 6,
    fontWeight: '400',
  },
  orderDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00BCD4',
  },
  detailLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00BCD4',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
