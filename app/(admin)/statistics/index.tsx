import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/services/supabase';
import { AdminBottomNav } from '../../../src/components/admin/AdminBottomNav';

type Period = 'Ngày' | 'Tuần' | 'Tháng' | 'Năm';

const periods: Period[] = ['Ngày', 'Tuần', 'Tháng', 'Năm'];

const COMPLETED_STATUSES = ['completed', 'delivered', 'success'];

type Order = {
  id: string;
  status: string | null;
  total_amount: number | null;
  created_at: string;
};

type OrderItem = {
  order_id: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  line_total: number | null;
};

type ProductStat = {
  id: string;
  name: string;
  sold: number;
  revenue: number;
};

type ChartItem = {
  label: string;
  value: number;
};

const formatMoney = (value: number) =>
  `${Math.round(value).toLocaleString('vi-VN')} đ`;

const normalizeStatus = (status?: string | null) =>
  (status ?? '').trim().toLowerCase();

const isCompleted = (status?: string | null) =>
  COMPLETED_STATUSES.includes(normalizeStatus(status));

const getPeriodStart = (period: Period) => {
  const now = new Date();
  const start = new Date(now);

  if (period === 'Ngày') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'Tuần') {
    start.setHours(0, 0, 0, 0);

    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;

    start.setDate(start.getDate() - diff);
  } else if (period === 'Tháng') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }

  return start;
};

const getPreviousPeriodStart = (period: Period) => {
  const start = getPeriodStart(period);

  if (period === 'Ngày') {
    start.setDate(start.getDate() - 1);
  } else if (period === 'Tuần') {
    start.setDate(start.getDate() - 7);
  } else if (period === 'Tháng') {
    start.setMonth(start.getMonth() - 1);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }

  return start;
};

const getChartData = (
  orders: Order[],
  period: Period,
): ChartItem[] => {
  const now = new Date();
  const result: ChartItem[] = [];

  if (period === 'Ngày') {
    for (let hour = 8; hour <= 20; hour += 2) {
      const revenue = orders
        .filter(order => {
          const date = new Date(order.created_at);

          return (
            isCompleted(order.status) &&
            date.getHours() >= hour &&
            date.getHours() < hour + 2
          );
        })
        .reduce(
          (sum, order) => sum + Number(order.total_amount ?? 0),
          0,
        );

      result.push({
        label: `${hour}h`,
        value: revenue,
      });
    }
  } else if (period === 'Tuần') {
    const monday = getPeriodStart('Tuần');

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);

      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const revenue = orders
        .filter(order => {
          const date = new Date(order.created_at);

          return (
            isCompleted(order.status) &&
            date >= day &&
            date < nextDay
          );
        })
        .reduce(
          (sum, order) => sum + Number(order.total_amount ?? 0),
          0,
        );

      result.push({
        label: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i],
        value: revenue,
      });
    }
  } else if (period === 'Tháng') {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const points = [
      1,
      Math.ceil(daysInMonth * 0.17),
      Math.ceil(daysInMonth * 0.34),
      Math.ceil(daysInMonth * 0.5),
      Math.ceil(daysInMonth * 0.67),
      Math.ceil(daysInMonth * 0.84),
      daysInMonth,
    ];

    points.forEach((day, index) => {
      const start = new Date(year, month, day);
      const end = new Date(
        year,
        month,
        points[index + 1] ?? daysInMonth + 1,
      );

      const revenue = orders
        .filter(order => {
          const date = new Date(order.created_at);

          return (
            isCompleted(order.status) &&
            date >= start &&
            date < end
          );
        })
        .reduce(
          (sum, order) => sum + Number(order.total_amount ?? 0),
          0,
        );

      result.push({
        label: String(day),
        value: revenue,
      });
    });
  } else {
    for (let month = 0; month < 12; month++) {
      const start = new Date(now.getFullYear(), month, 1);
      const end = new Date(now.getFullYear(), month + 1, 1);

      const revenue = orders
        .filter(order => {
          const date = new Date(order.created_at);

          return (
            isCompleted(order.status) &&
            date >= start &&
            date < end
          );
        })
        .reduce(
          (sum, order) => sum + Number(order.total_amount ?? 0),
          0,
        );

      result.push({
        label: `T${month + 1}`,
        value: revenue,
      });
    }
  }

  return result;
};

export default function StatisticsScreen() {
  const router = useRouter();

  const [selectedPeriod, setSelectedPeriod] =
    useState<Period>('Tuần');

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerCount, setCustomerCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadStatistics = useCallback(async () => {
    try {
      setErrorMessage('');

      const [
        ordersResult,
        itemsResult,
        customersResult,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, total_amount, created_at')
          .order('created_at', { ascending: false }),

        supabase
          .from('order_items')
          .select(
            'order_id, product_id, product_name, quantity, line_total',
          ),

        supabase
          .from('profiles')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('role', 'customer'),
      ]);

      if (ordersResult.error) {
        throw ordersResult.error;
      }

      if (itemsResult.error) {
        throw itemsResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      setOrders((ordersResult.data ?? []) as Order[]);
      setOrderItems((itemsResult.data ?? []) as OrderItem[]);
      setCustomerCount(customersResult.count ?? 0);
    } catch (error: any) {
      console.error('Load statistics error:', error);

      setErrorMessage(
        error?.message ??
          'Không thể tải dữ liệu thống kê.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStatistics();
  };

  const periodStart = getPeriodStart(selectedPeriod);
  const previousPeriodStart =
    getPreviousPeriodStart(selectedPeriod);

  const currentOrders = orders.filter(order => {
    return new Date(order.created_at) >= periodStart;
  });

  const previousOrders = orders.filter(order => {
    const date = new Date(order.created_at);

    return (
      date >= previousPeriodStart &&
      date < periodStart
    );
  });

  const completedOrders = currentOrders.filter(order =>
    isCompleted(order.status),
  );

  const previousCompletedOrders = previousOrders.filter(order =>
    isCompleted(order.status),
  );

  const totalRevenue = completedOrders.reduce(
    (sum, order) =>
      sum + Number(order.total_amount ?? 0),
    0,
  );

  const previousRevenue = previousCompletedOrders.reduce(
    (sum, order) =>
      sum + Number(order.total_amount ?? 0),
    0,
  );

  const revenueGrowth =
    previousRevenue > 0
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
      : totalRevenue > 0
        ? 100
        : 0;

  const totalOrders = currentOrders.length;

  const productsSold = orderItems
    .filter(item =>
      completedOrders.some(order => order.id === item.order_id),
    )
    .reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0,
    );

  const getStatusCount = (status: string) =>
    currentOrders.filter(
      order => normalizeStatus(order.status) === status,
    ).length;

  const pendingOrders = getStatusCount('pending');

  const shippingOrders =
    getStatusCount('shipping') +
    getStatusCount('delivering');

  const cancelledOrders =
    getStatusCount('cancelled') +
    getStatusCount('canceled');

  const chart = getChartData(
    currentOrders,
    selectedPeriod,
  );

  const maxValue = Math.max(
    ...chart.map(item => item.value),
    1,
  );

  const bestSellingProducts: ProductStat[] = (() => {
    const completedOrderIds = new Set(
      completedOrders.map(order => order.id),
    );

    const productMap = new Map<string, ProductStat>();

    orderItems
      .filter(item => completedOrderIds.has(item.order_id))
      .forEach(item => {
        const key =
          item.product_id ??
          item.product_name ??
          'unknown';

        const existing = productMap.get(key);

        const quantity = Number(item.quantity ?? 0);
        const revenue = Number(item.line_total ?? 0);

        if (existing) {
          existing.sold += quantity;
          existing.revenue += revenue;
        } else {
          productMap.set(key, {
            id: key,
            name: item.product_name ?? 'Sản phẩm',
            sold: quantity,
            revenue,
          });
        }
      });

    return Array.from(productMap.values())
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);
  })();

  const StatCard = ({
    title,
    value,
    icon,
    color,
    background,
    note,
  }: {
    title: string;
    value: string;
    icon: string;
    color: string;
    background: string;
    note: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <View
          style={[
            styles.statIcon,
            { backgroundColor: background },
          ]}
        >
          <Text style={{ fontSize: 20 }}>{icon}</Text>
        </View>

        <View style={styles.growthBadge}>
          <Text style={styles.growthText}>
            {revenueGrowth >= 0 ? '↑' : '↓'}{' '}
            {Math.abs(revenueGrowth).toFixed(1)}%
          </Text>
        </View>
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statNote, { color }]}>
        {note}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#123B78"
        />
        <Text style={styles.loadingText}>
          Đang tải thống kê...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            Thống kê cửa hàng
          </Text>

          <Text style={styles.headerSubtitle}>
            Tổng quan tình hình kinh doanh
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={{ fontSize: 19 }}>📊</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <TouchableOpacity
              onPress={loadStatistics}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>
                Thử lại
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* FILTER */}
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>
            Tổng quan kinh doanh
          </Text>

          <Text style={styles.currentDate}>
            {new Date().getFullYear()}
          </Text>
        </View>

        <View style={styles.periodContainer}>
          {periods.map(period => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={[
                styles.periodButton,
                selectedPeriod === period &&
                  styles.periodButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === period &&
                    styles.periodTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* STAT CARDS */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Tổng doanh thu"
            value={formatMoney(totalRevenue)}
            icon="💰"
            color="#16A34A"
            background="#DCFCE7"
            note="So với kỳ trước"
          />

          <StatCard
            title="Đơn hàng"
            value={String(totalOrders)}
            icon="🛍️"
            color="#2563EB"
            background="#DBEAFE"
            note="Tổng đơn đặt hàng"
          />

          <StatCard
            title="Sản phẩm đã bán"
            value={String(productsSold)}
            icon="📦"
            color="#EA580C"
            background="#FFEDD5"
            note="Đơn hàng hoàn thành"
          />

          <StatCard
            title="Khách hàng"
            value={String(customerCount)}
            icon="👥"
            color="#9333EA"
            background="#F3E8FF"
            note="Tài khoản khách hàng"
          />
        </View>

        {/* REVENUE CHART */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Doanh thu
            </Text>

            <Text style={styles.sectionSubtitle}>
              Biến động doanh thu theo{' '}
              {selectedPeriod.toLowerCase()}
            </Text>
          </View>

          <Text style={styles.chartIcon}>📈</Text>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTotal}>
            {formatMoney(totalRevenue)}
          </Text>

          <Text style={styles.chartCaption}>
            Doanh thu đơn hàng hoàn thành
          </Text>

          <View style={styles.chart}>
            {chart.map((item, index) => (
              <View
                key={`${item.label}-${index}`}
                style={styles.chartColumn}
              >
                <View style={styles.barArea}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${
                          (item.value / maxValue) * 100
                        }%`,
                        backgroundColor:
                          item.value === maxValue
                            ? '#123B78'
                            : '#A8C5F0',
                      },
                    ]}
                  />
                </View>

                <Text style={styles.barLabel}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>
              Doanh thu
            </Text>
          </View>
        </View>

        {/* ORDER STATUS */}
        <Text style={styles.sectionTitle}>
          Tình trạng đơn hàng
        </Text>

        <View style={styles.orderCard}>
          <View style={styles.orderItem}>
            <View
              style={[
                styles.orderIcon,
                { backgroundColor: '#FEF3C7' },
              ]}
            >
              <Text>⏳</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.orderName}>
                Chờ xác nhận
              </Text>

              <Text style={styles.orderDescription}>
                Đơn hàng mới
              </Text>
            </View>

            <Text
              style={[
                styles.orderNumber,
                { color: '#D97706' },
              ]}
            >
              {pendingOrders}
            </Text>
          </View>

          <View style={styles.orderDivider} />

          <View style={styles.orderItem}>
            <View
              style={[
                styles.orderIcon,
                { backgroundColor: '#DBEAFE' },
              ]}
            >
              <Text>🚚</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.orderName}>
                Đang giao
              </Text>

              <Text style={styles.orderDescription}>
                Đơn hàng đang vận chuyển
              </Text>
            </View>

            <Text
              style={[
                styles.orderNumber,
                { color: '#2563EB' },
              ]}
            >
              {shippingOrders}
            </Text>
          </View>

          <View style={styles.orderDivider} />

          <View style={styles.orderItem}>
            <View
              style={[
                styles.orderIcon,
                { backgroundColor: '#DCFCE7' },
              ]}
            >
              <Text>✓</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.orderName}>
                Đã hoàn thành
              </Text>

              <Text style={styles.orderDescription}>
                Giao hàng thành công
              </Text>
            </View>

            <Text
              style={[
                styles.orderNumber,
                { color: '#16A34A' },
              ]}
            >
              {completedOrders.length}
            </Text>
          </View>

          <View style={styles.orderDivider} />

          <View style={styles.orderItem}>
            <View
              style={[
                styles.orderIcon,
                { backgroundColor: '#FEE2E2' },
              ]}
            >
              <Text>✕</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.orderName}>
                Đã hủy
              </Text>

              <Text style={styles.orderDescription}>
                Đơn hàng không thành công
              </Text>
            </View>

            <Text
              style={[
                styles.orderNumber,
                { color: '#DC2626' },
              ]}
            >
              {cancelledOrders}
            </Text>
          </View>
        </View>

        {/* BEST SELLING */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Sản phẩm bán chạy
            </Text>

            <Text style={styles.sectionSubtitle}>
              Top sản phẩm có số lượng bán cao
            </Text>
          </View>

          <Text style={styles.trophy}>🏆</Text>
        </View>

        <View style={styles.productCard}>
          {bestSellingProducts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Chưa có dữ liệu sản phẩm đã bán
              </Text>
            </View>
          ) : (
            bestSellingProducts.map((product, index) => (
              <View key={product.id}>
                <View style={styles.productItem}>
                  <View style={styles.rank}>
                    <Text style={styles.rankText}>
                      {index + 1}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>
                      {product.name}
                    </Text>

                    <Text style={styles.productRevenue}>
                      {formatMoney(product.revenue)}
                    </Text>
                  </View>

                  <View style={styles.soldBox}>
                    <Text style={styles.soldNumber}>
                      {product.sold}
                    </Text>

                    <Text style={styles.soldLabel}>
                      Đã bán
                    </Text>
                  </View>
                </View>

                {index !==
                  bestSellingProducts.length - 1 && (
                  <View style={styles.productDivider} />
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thống kê hoạt động kinh doanh cửa hàng
          </Text>

          <Text style={styles.footerSubtext}>
            Dữ liệu được lấy từ Supabase
          </Text>
        </View>
      </ScrollView>
      <AdminBottomNav activeTab="overview" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF4',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#EAFBF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#0D9488',
    fontSize: 29,
    marginTop: -5,
  },
  headerTitle: {
    color: '#172554',
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 15,
    paddingBottom: 35,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#172554',
  },
  currentDate: {
    color: '#64748B',
    fontSize: 11,
  },
  periodContainer: {
    flexDirection: 'row',
    backgroundColor: '#E9EEF5',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#123B78',
  },
  periodText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 11,
    marginBottom: 23,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 13,
    minHeight: 145,
    borderWidth: 1,
    borderColor: '#EDF0F5',
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statIcon: {
    width: 39,
    height: 39,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  growthText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: 'bold',
  },
  statValue: {
    color: '#172554',
    fontSize: 19,
    fontWeight: 'bold',
    marginTop: 12,
  },
  statTitle: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statNote: {
    fontSize: 10,
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 3,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  chartIcon: {
    fontSize: 23,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 13,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#EDF0F5',
  },
  chartTotal: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#172554',
  },
  chartCaption: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  chart: {
    height: 155,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginTop: 18,
    gap: 8,
  },
  chartColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
  },
  barArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 3,
  },
  barLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 9,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
    gap: 7,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#123B78',
  },
  legendText: {
    color: '#64748B',
    fontSize: 10,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 3,
    marginTop: 12,
    marginBottom: 23,
    borderWidth: 1,
    borderColor: '#EDF0F5',
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 11,
  },
  orderIcon: {
    width: 37,
    height: 37,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderName: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  orderDescription: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 4,
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  trophy: {
    fontSize: 24,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingHorizontal: 14,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#EDF0F5',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 11,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#123B78',
    fontWeight: 'bold',
    fontSize: 12,
  },
  productName: {
    color: '#334155',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productRevenue: {
    color: '#0D9488',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 5,
  },
  soldBox: {
    alignItems: 'center',
    minWidth: 48,
  },
  soldNumber: {
    color: '#172554',
    fontSize: 17,
    fontWeight: 'bold',
  },
  soldLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 3,
  },
  productDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  footerSubtext: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 5,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 9,
    color: '#888888',
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#B91C1C',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 25,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
