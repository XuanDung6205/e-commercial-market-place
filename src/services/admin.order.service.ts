import { supabase } from '@/src/services/supabase';
import type { OrderStatus } from '@/src/types/models';

export type AdminOrderItem = {
  id: string;
  productId: string;
  productName: string;
  variant?: string;
  quantity: number;
  price: number;
  image: string;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  displayId: string;
  date: string;
  time?: string;
  rawCreatedAt: string;
  status: OrderStatus;
  items: AdminOrderItem[];
  subtotal: number;
  tax: number;
  shippingFee: number;
  discount: number;
  total: number;
  recipientName: string;
  phone: string;
  address: string;
  paymentMethod: 'cod' | 'bank_transfer' | 'e_wallet';
  paymentMethodLabel: string;
  paymentStatus: string;
  isPaid: boolean;
  customerNote?: string;
};

export type FilterStatus = 'all' | 'pending' | 'shipping' | 'delivered';
export type SortOrder = 'newest' | 'oldest';

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Thanh toán khi nhận hàng',
  bank_transfer: 'Chuyển khoản ngân hàng',
  e_wallet: 'Ví điện tử',
};

export const ALLOWED_STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function normalizeStatus(status: string): OrderStatus {
  const s = status.toLowerCase();
  if (s === 'shipped') return 'shipping';
  return s as OrderStatus;
}

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  const normFrom = from === 'shipped' ? 'shipping' : from;
  const normTo = to === 'shipped' ? 'shipping' : to;

  if (normFrom === normTo) return false;
  const allowed = ALLOWED_STATUS_TRANSITIONS[normFrom] ?? [];
  return allowed.includes(normTo);
}

export function validateStatusTransition(from: OrderStatus, to: OrderStatus): void {
  const normFrom = from === 'shipped' ? 'shipping' : from;
  const normTo = to === 'shipped' ? 'shipping' : to;

  if (normFrom === normTo) {
    throw new Error('Trạng thái mới phải khác trạng thái hiện tại.');
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[normFrom] ?? [];
  if (!allowed.includes(normTo)) {
    const fromLabel = STATUS_LABELS[normFrom] || normFrom;
    const toLabel = STATUS_LABELS[normTo] || normTo;
    throw new Error(`Không thể chuyển trạng thái từ "${fromLabel}" sang "${toLabel}".`);
  }
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString;
  }
}

function formatDisplayId(orderNumber: string, id: string): string {
  if (orderNumber) {
    if (orderNumber.startsWith('#')) return orderNumber;
    if (orderNumber.startsWith('ORD-')) {
      return `#${orderNumber.replace('ORD-', '').slice(0, 4).toUpperCase()}`;
    }
    return `#${orderNumber}`;
  }
  return `#${id.slice(0, 4).toUpperCase()}`;
}

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_method: 'cod' | 'bank_transfer' | 'e_wallet';
  payment_status: string;
  subtotal: number | string;
  discount_amount: number | string;
  shipping_fee: number | string;
  total_amount: number | string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  customer_note?: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  order_items?: {
    id: string;
    product_id: string | null;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price: number | string;
    products?: { product_images?: { image_url: string }[] | null } | null;
  }[];
};

function mapRowToAdminOrder(row: OrderRow): AdminOrder {
  const subtotal = Number(row.subtotal) || 0;
  const items: AdminOrderItem[] = (row.order_items ?? []).map((item) => ({
    id: item.id,
    productId: item.product_id ?? '',
    productName: item.product_name,
    variant: item.variant_label ?? undefined,
    quantity: item.quantity,
    price: Number(item.unit_price) || 0,
    image: item.products?.product_images?.[0]?.image_url ?? '',
  }));

  const createdAt = new Date(row.created_at);
  const time = isNaN(createdAt.getTime())
    ? ''
    : createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const rawStatus = row.status ?? 'pending';
  const status: OrderStatus = rawStatus === 'shipped' ? 'shipping' : rawStatus;

  return {
    id: row.id,
    orderNumber: row.order_number,
    displayId: formatDisplayId(row.order_number, row.id),
    date: formatDate(row.created_at),
    time,
    rawCreatedAt: row.created_at,
    status,
    items,
    subtotal,
    tax: Math.round(subtotal * 0.1),
    shippingFee: Number(row.shipping_fee) || 0,
    discount: Number(row.discount_amount) || 0,
    total: Number(row.total_amount) || 0,
    recipientName: row.profiles?.full_name?.trim() || row.recipient_name,
    phone: row.profiles?.phone?.trim() || row.recipient_phone,
    address: row.profiles?.address?.trim() || row.delivery_address,
    paymentMethod: row.payment_method,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[row.payment_method] || 'Thanh toán khi nhận hàng',
    paymentStatus: row.payment_status,
    isPaid: row.payment_status === 'paid',
    customerNote: row.customer_note ?? undefined,
  };
}

const adminOrderSelection = `
  id, order_number, status, payment_method, payment_status,
  subtotal, discount_amount, shipping_fee, total_amount,
  recipient_name, recipient_phone, delivery_address, customer_note, created_at,
  profiles (full_name, phone, address),
  order_items (
    id, product_id, product_name, variant_label, quantity, unit_price,
    products (product_images (image_url))
  )
`;

// Seed data matching the Figma mock screens when DB is empty in local development
const FALLBACK_ADMIN_ORDERS: AdminOrder[] = [
  {
    id: 'ord-2026',
    orderNumber: '2026',
    displayId: '#2026',
    date: '25/10/2026',
    time: '09:41',
    rawCreatedAt: '2026-10-25T09:41:00Z',
    status: 'pending',
    recipientName: 'Nguyễn Minh Anh',
    phone: '0912 345 678',
    address: '25 Nguyễn Huệ, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'cod',
    paymentMethodLabel: 'Thanh toán khi nhận hàng',
    paymentStatus: 'pending',
    isPaid: false,
    subtotal: 890000,
    tax: 89000,
    shippingFee: 25000,
    discount: 0,
    total: 1004000,
    items: [
      {
        id: 'item-2026-1',
        productId: 'prod-headphone',
        productName: 'Tai nghe không dây Air',
        variant: 'Màu trắng',
        quantity: 1,
        price: 890000,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'ord-2024',
    orderNumber: '2024',
    displayId: '#2024',
    date: '24/10/2026',
    time: '14:20',
    rawCreatedAt: '2026-10-24T14:20:00Z',
    status: 'shipping',
    recipientName: 'Trần Hoàng Nam',
    phone: '0987 654 321',
    address: '120 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'cod',
    paymentMethodLabel: 'Thanh toán khi nhận hàng',
    paymentStatus: 'pending',
    isPaid: false,
    subtotal: 189000,
    tax: 18900,
    shippingFee: 25000,
    discount: 0,
    total: 232900,
    items: [
      {
        id: 'item-2024-1',
        productId: 'prod-shirt',
        productName: 'Áo thun Cotton Basic',
        variant: 'Màu đen - Size L',
        quantity: 1,
        price: 189000,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'ord-2025',
    orderNumber: '2025',
    displayId: '#2025',
    date: '23/10/2026',
    time: '11:15',
    rawCreatedAt: '2026-10-23T11:15:00Z',
    status: 'delivered',
    recipientName: 'Nguyễn Minh Anh',
    phone: '0912 345 678',
    address: '25 Nguyễn Huệ, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'e_wallet',
    paymentMethodLabel: 'Ví điện tử',
    paymentStatus: 'paid',
    isPaid: true,
    subtotal: 890000,
    tax: 89000,
    shippingFee: 25000,
    discount: 0,
    total: 1004000,
    items: [
      {
        id: 'item-2025-1',
        productId: 'prod-watch',
        productName: 'Đồng hồ thông minh Fit S',
        variant: 'Màu đen',
        quantity: 1,
        price: 890000,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
  {
    id: 'ord-2023',
    orderNumber: '2023',
    displayId: '#2023',
    date: '22/10/2026',
    time: '16:45',
    rawCreatedAt: '2026-10-22T16:45:00Z',
    status: 'cancelled',
    recipientName: 'Lê Thu Hà',
    phone: '0903 123 789',
    address: '45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    paymentMethod: 'bank_transfer',
    paymentMethodLabel: 'Chuyển khoản ngân hàng',
    paymentStatus: 'pending',
    isPaid: false,
    subtotal: 189000,
    tax: 18900,
    shippingFee: 25000,
    discount: 0,
    total: 232900,
    items: [
      {
        id: 'item-2023-1',
        productId: 'prod-shirt-2',
        productName: 'Áo thun Cotton Basic',
        variant: 'Màu trắng - Size M',
        quantity: 1,
        price: 189000,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
      },
    ],
  },
];

let inMemoryFallbackOrders = [...FALLBACK_ADMIN_ORDERS];

export async function getAdminOrders(params?: {
  status?: FilterStatus;
  search?: string;
  sortBy?: SortOrder;
}): Promise<AdminOrder[]> {
  try {
    let query = supabase
      .from('orders')
      .select(adminOrderSelection)
      .order('created_at', { ascending: params?.sortBy === 'oldest' });

    const { data, error } = await query;

    if (!error && Array.isArray(data) && data.length > 0) {
      const orders = (data as unknown as OrderRow[]).map(mapRowToAdminOrder);
      return applyFiltersAndSort(orders, params);
    }
  } catch (err) {
    console.warn('Unable to query Supabase orders for admin, falling back to local dataset:', err);
  }

  return applyFiltersAndSort(inMemoryFallbackOrders, params);
}

function applyFiltersAndSort(
  orders: AdminOrder[],
  params?: {
    status?: FilterStatus;
    search?: string;
    sortBy?: SortOrder;
  }
): AdminOrder[] {
  let result = [...orders];

  if (params?.status && params.status !== 'all') {
    const target = params.status;
    result = result.filter((order) => {
      const s = order.status === 'shipped' ? 'shipping' : order.status;
      return s === target;
    });
  }

  if (params?.search && params.search.trim()) {
    const term = params.search.trim().toLowerCase().replace(/^#/, '');
    result = result.filter((order) => {
      const orderNum = order.orderNumber.toLowerCase().replace(/^#/, '');
      const displayId = order.displayId.toLowerCase().replace(/^#/, '');
      const id = order.id.toLowerCase();
      const customer = order.recipientName.toLowerCase();
      return (
        orderNum.includes(term) ||
        displayId.includes(term) ||
        id.includes(term) ||
        customer.includes(term)
      );
    });
  }

  result.sort((a, b) => {
    const dateA = new Date(a.rawCreatedAt).getTime();
    const dateB = new Date(b.rawCreatedAt).getTime();
    return params?.sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
  });

  return result;
}

export async function getAdminOrderById(orderId: string): Promise<AdminOrder | null> {
  const cleanId = orderId.trim();

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(adminOrderSelection)
      .or(`id.eq.${cleanId},order_number.eq.${cleanId}`)
      .maybeSingle();

    if (!error && data) {
      return mapRowToAdminOrder(data as unknown as OrderRow);
    }
  } catch (err) {
    console.warn('getAdminOrderById Supabase error:', err);
  }

  const found = inMemoryFallbackOrders.find(
    (o) => o.id === cleanId || o.orderNumber === cleanId || o.displayId === cleanId
  );
  return found ?? null;
}

export async function updateAdminOrderStatus(
  orderId: string,
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): Promise<AdminOrder> {
  // Validate transition according to business rules
  validateStatusTransition(currentStatus, targetStatus);

  // Map to DB enum (PostgreSQL orders_status_check uses 'shipped')
  const dbStatus = targetStatus === 'shipping' ? 'shipped' : targetStatus;
  const nowIso = new Date().toISOString();

  let updatedFromDb = false;

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: dbStatus,
        updated_at: nowIso,
      })
      .eq('id', orderId)
      .select(adminOrderSelection)
      .maybeSingle();

    if (!error && data) {
      updatedFromDb = true;
      return mapRowToAdminOrder(data as unknown as OrderRow);
    }
  } catch (err) {
    console.warn('updateAdminOrderStatus Supabase update warning:', err);
  }

  // Update in-memory fallback if using fallback or DB update was not returned
  const idx = inMemoryFallbackOrders.findIndex(
    (o) => o.id === orderId || o.orderNumber === orderId || o.displayId === orderId
  );
  if (idx !== -1) {
    const updated = {
      ...inMemoryFallbackOrders[idx],
      status: targetStatus,
    };
    inMemoryFallbackOrders[idx] = updated;
    return updated;
  }

  if (updatedFromDb) {
    const fetched = await getAdminOrderById(orderId);
    if (fetched) return fetched;
  }

  throw new Error('Không tìm thấy đơn hàng để cập nhật trạng thái.');
}
