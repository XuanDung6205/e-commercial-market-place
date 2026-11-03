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
  order_items?: {
    id: string;
    product_id: string | null;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price: number | string;
    products: { product_images?: { image_url: string }[] } | null;
  }[];
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

function mapOrder(row: OrderRow): Order {
  const subtotal = Number(row.subtotal);
  const items: OrderItem[] = (row.order_items ?? []).map((item) => ({
    id: item.id,
    productId: item.product_id ?? '',
    productName: item.product_name,
    variant: item.variant_label ?? undefined,
    quantity: item.quantity,
    price: Number(item.unit_price),
    image: item.products?.product_images?.[0]?.image_url ?? '',
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
  recipient_name, recipient_phone, delivery_address, created_at,
  order_items (
    id, product_id, product_name, variant_label, quantity, unit_price,
    products (product_images (image_url))
  )
`;

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
  if (error) throw error;
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
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
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
  return data ? mapOrder(data as unknown as OrderRow) : null;
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
