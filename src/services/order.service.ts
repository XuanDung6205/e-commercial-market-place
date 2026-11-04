import type { Order, OrderItem, OrderStatus } from '@/src/types/models';
import { supabase } from '@/src/services/supabase';

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_method: Order['paymentMethod'];
  payment_status: string;
  subtotal: number | string;
  discount_amount: number | string;
  shipping_fee: number | string;
  total_amount: number | string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number | string;
};

export type CreateCustomerOrderInput = {
  items: { productId: string; quantity: number; variantLabel?: string }[];
  recipientName: string;
  phone: string;
  address: string;
  paymentMethod: Order['paymentMethod'];
  note?: string;
  voucherCode?: string;
};

function mapOrder(row: OrderRow, orderItems: OrderItemRow[], imagesByProductId: Map<string, string>): Order {
  const subtotal = Number(row.subtotal);
  const items: OrderItem[] = orderItems.map((item) => ({
    id: item.id,
    productId: item.product_id ?? '',
    productName: item.product_name,
    variant: item.variant_label ?? undefined,
    quantity: item.quantity,
    price: Number(item.unit_price),
    image: item.product_id ? imagesByProductId.get(item.product_id) ?? '' : '',
  }));
  const createdAt = new Date(row.created_at);

  return {
    id: row.id,
    orderNumber: row.order_number,
    date: createdAt.toLocaleDateString('vi-VN'),
    time: createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    status: row.status,
    items,
    subtotal,
    tax: Math.round(subtotal * 0.1),
    shippingFee: Number(row.shipping_fee),
    discount: Number(row.discount_amount),
    total: Number(row.total_amount),
    recipientName: row.recipient_name,
    phone: row.recipient_phone,
    address: row.delivery_address,
    paymentMethod: row.payment_method,
    isPaid: row.payment_status === 'paid',
  };
}

const orderSelection = `
  id, order_number, status, payment_method, payment_status,
  subtotal, discount_amount, shipping_fee, total_amount,
  recipient_name, recipient_phone, delivery_address, created_at
`;

async function loadOrderItems(orderIds: string[]) {
  if (orderIds.length === 0) return { itemsByOrderId: new Map<string, OrderItemRow[]>(), imagesByProductId: new Map<string, string>() };

  const { data, error } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, product_name, variant_label, quantity, unit_price')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const items = (data ?? []) as unknown as OrderItemRow[];
  const itemsByOrderId = new Map<string, OrderItemRow[]>();
  for (const item of items) {
    const orderItems = itemsByOrderId.get(item.order_id) ?? [];
    orderItems.push(item);
    itemsByOrderId.set(item.order_id, orderItems);
  }

  const productIds = [...new Set(items.flatMap((item) => item.product_id ? [item.product_id] : []))];
  const imagesByProductId = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: imageRows, error: imageError } = await supabase
      .from('product_images')
      .select('product_id, image_url, sort_order')
      .in('product_id', productIds)
      .order('sort_order', { ascending: true });
    // Order history must remain readable even if a product image was removed or hidden.
    if (!imageError) {
      for (const image of imageRows ?? []) {
        if (!imagesByProductId.has(image.product_id)) imagesByProductId.set(image.product_id, image.image_url);
      }
    }
  }
  return { itemsByOrderId, imagesByProductId };
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Vui lòng đăng nhập để quản lý đơn hàng.');
  return data.user.id;
}

export async function createCustomerOrder(input: CreateCustomerOrderInput): Promise<string> {
  await requireUserId();
  const { data, error } = await supabase.rpc('create_customer_order', {
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      variant_label: item.variantLabel ?? null,
    })),
    p_recipient_name: input.recipientName.trim(),
    p_recipient_phone: input.phone.trim(),
    p_delivery_address: input.address.trim(),
    p_payment_method: input.paymentMethod,
    p_customer_note: input.note?.trim() || null,
    p_voucher_code: input.voucherCode?.trim() || null,
  });
  if (error) {
    if (error.code === 'PGRST202' || /create_customer_order.*(not found|schema cache)/i.test(error.message)) {
      throw new Error('Supabase chưa cài hàm đặt hàng. Hãy chạy supabase/migrations/20261103_customer_orders.sql rồi thử lại.');
    }
    throw error;
  }
  if (typeof data !== 'string') throw new Error('Không nhận được mã đơn hàng từ máy chủ.');
  return data;
}

export async function getMyOrders(): Promise<Order[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('orders')
    .select(orderSelection)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as OrderRow[];
  const { itemsByOrderId, imagesByProductId } = await loadOrderItems(rows.map((row) => row.id));
  return rows.map((row) => mapOrder(row, itemsByOrderId.get(row.id) ?? [], imagesByProductId));
}

export async function getMyOrderById(orderId: string): Promise<Order | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('orders')
    .select(orderSelection)
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as OrderRow;
  const { itemsByOrderId, imagesByProductId } = await loadOrderItems([row.id]);
  return mapOrder(row, itemsByOrderId.get(row.id) ?? [], imagesByProductId);
}

export async function cancelMyOrder(orderId: string): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Chỉ có thể hủy đơn đang chờ xác nhận và chưa thanh toán.');
}
