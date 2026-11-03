export type Product = {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  images?: string[];
  rating: number;
  reviewCount: number;
  tag?: string; // "Mua 1 tặng 1", "Giảm 15%"
  category?: string;
  description?: string;
  variant?: string;
  variants?: ProductVariant[];
  stock?: number;
};

export type ProductVariant = {
  id: string;
  color: string | null;
  size: string | null;
  priceOverride: number | null;
  stock: number;
};

export type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  variant?: string;
  variantId?: string | null;
  selected: boolean;
};

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  variant?: string;
  quantity: number;
  price: number;
  image: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  date: string;
  time?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingFee: number;
  discount: number;
  total: number;
  recipientName: string;
  phone: string;
  address: string;
  paymentMethod: 'cod' | 'bank_transfer' | 'e_wallet';
  isPaid: boolean;
  receivedTime?: string;
};

export type Review = {
  id: string;
  orderId?: string | null;
  productId: string;
  productName?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string | null;
  rating: number;
  comment: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  isVerifiedBuyer?: boolean;
  images?: string[];
  isOwner?: boolean;
};
