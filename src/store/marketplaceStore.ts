import { useEffect, useSyncExternalStore } from 'react';
import { CartItem, Order, Product, Review } from '@/src/types/models';
import { ProductService } from '@/src/services/product.service';
import { supabase } from '@/src/services/supabase';

type StoreState = {
  cart: CartItem[];
  favoriteIds: string[];
  favorites: Product[];
  cartLoading: boolean;
  favoritesLoading: boolean;
  cartError: string | null;
  favoritesError: string | null;
  orders: Order[];
  reviews: Review[];
  voucherCode: string;
  discountRate: number; // e.g. 0.1 for 10%
};

const INITIAL_STATE: StoreState = {
  cart: [],
  favoriteIds: [],
  favorites: [],
  cartLoading: true,
  favoritesLoading: true,
  cartError: null,
  favoritesError: null,
  orders: [],
  reviews: [],
  voucherCode: '',
  discountRate: 0,
};

// Keep the cart and order history empty until the signed-in customer loads real backend data.
let state: StoreState = { ...INITIAL_STATE, cart: [], orders: [] };
const listeners = new Set<() => void>();
let authSyncStarted = false;
let loadedUserId: string | null | undefined;
let pendingUserId: string | null | undefined;
let pendingSync: Promise<void> | null = null;
let syncVersion = 0;

function notify() {
  listeners.forEach((listener) => listener());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi khi đồng bộ dữ liệu.';
}

async function getCartItems(userId: string): Promise<CartItem[]> {
  const { data: cart, error: cartError } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (cartError) throw new Error(cartError.message);
  if (!cart) return [];

  const { data: rows, error } = await supabase
    .from('cart_items')
    .select('id, product_id, quantity, variant_id')
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);

  const products = await ProductService.getByIds([
    ...new Set((rows ?? []).map((row) => row.product_id)),
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));

  const missingProduct = (rows ?? []).some((row) => !productsById.has(row.product_id));
  if (missingProduct) {
    throw new Error('Một sản phẩm trong giỏ hàng không còn hoạt động trên Supabase.');
  }

  return (rows ?? []).map((row) => {
    const product = productsById.get(row.product_id);
    if (!product) throw new Error('Không tìm thấy sản phẩm trong giỏ hàng.');
    const variant = product.variants?.find((item) => item.id === row.variant_id);
    const variantLabel = variant
      ? [variant.color, variant.size].filter(Boolean).join(' / ')
      : undefined;
    const cartProduct =
      variant?.priceOverride === null || variant?.priceOverride === undefined
        ? product
        : { ...product, price: variant.priceOverride };

    return {
      id: row.id,
      product: cartProduct,
      quantity: row.quantity,
      variant: variantLabel,
      variantId: row.variant_id,
      selected: true,
    };
  });
}

async function getFavoriteProducts(userId: string): Promise<{ ids: string[]; products: Product[] }> {
  const { data, error } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((favorite) => favorite.product_id);
  const products = await ProductService.getByIds(ids);
  if (products.length !== ids.length) {
    throw new Error('Một sản phẩm yêu thích không còn hoạt động trên Supabase.');
  }
  return { ids, products };
}

async function syncCustomerData(userId: string | null, force = false): Promise<void> {
  if (!force && loadedUserId === userId && !state.cartLoading && !state.favoritesLoading) return;
  if (!force && pendingSync && pendingUserId === userId) return pendingSync;

  const requestVersion = ++syncVersion;
  pendingUserId = userId;

  if (!userId) {
    loadedUserId = null;
    pendingSync = null;
    pendingUserId = undefined;
    state = {
      ...state,
      cart: [],
      favoriteIds: [],
      favorites: [],
      orders: [],
      reviews: [],
      voucherCode: '',
      discountRate: 0,
      cartLoading: false,
      favoritesLoading: false,
      cartError: null,
      favoritesError: null,
    };
    notify();
    return;
  }

  state = {
    ...state,
    cart: loadedUserId === userId ? state.cart : [],
    favoriteIds: loadedUserId === userId ? state.favoriteIds : [],
    favorites: loadedUserId === userId ? state.favorites : [],
    orders: loadedUserId === userId ? state.orders : [],
    reviews: loadedUserId === userId ? state.reviews : [],
    cartLoading: true,
    favoritesLoading: true,
    cartError: null,
    favoritesError: null,
  };
  notify();

  const request = Promise.allSettled([
    getCartItems(userId),
    getFavoriteProducts(userId),
  ]).then(([cartResult, favoritesResult]) => {
    if (requestVersion !== syncVersion) return;

    state = {
      ...state,
      cart: cartResult.status === 'fulfilled' ? cartResult.value : [],
      favorites:
        favoritesResult.status === 'fulfilled' ? favoritesResult.value.products : [],
      favoriteIds:
        favoritesResult.status === 'fulfilled' ? favoritesResult.value.ids : [],
      cartLoading: false,
      favoritesLoading: false,
      cartError: cartResult.status === 'rejected' ? getErrorMessage(cartResult.reason) : null,
      favoritesError:
        favoritesResult.status === 'rejected'
          ? getErrorMessage(favoritesResult.reason)
          : null,
    };
    loadedUserId = userId;
    notify();
  }).finally(() => {
    if (requestVersion === syncVersion) {
      pendingSync = null;
      pendingUserId = undefined;
    }
  });

  pendingSync = request;
  await request;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session?.user) {
    throw new Error('Vui lòng đăng nhập để lưu giỏ hàng và sản phẩm yêu thích.');
  }
  return data.session.user.id;
}

async function getOrCreateCartId(userId: string): Promise<string> {
  const { data: existingCart, error: selectError } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (existingCart) return existingCart.id;

  const { data, error } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

function startCustomerDataSync() {
  if (authSyncStarted) return;
  authSyncStarted = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      void syncCustomerData(null, true);
    } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      setTimeout(() => {
        void syncCustomerData(session?.user.id ?? null);
      }, 0);
    }
  });

  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      state = {
        ...state,
        cartLoading: false,
        favoritesLoading: false,
        cartError: error.message,
        favoritesError: error.message,
      };
      notify();
      return;
    }
    return syncCustomerData(data.session?.user.id ?? null);
  });
}

export const marketplaceStore = {
  getState() {
    return state;
  },

  getServerSnapshot() {
    return INITIAL_STATE;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  refreshCustomerData() {
    return supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        state = {
          ...state,
          cartError: error.message,
          favoritesError: error.message,
          cartLoading: false,
          favoritesLoading: false,
        };
        notify();
        return;
      }
      return syncCustomerData(data.session?.user.id ?? null, true);
    });
  },

  // Shopping Cart Actions
  async addToCart(product: Product, quantity = 1, variant?: string): Promise<string | null> {
    try {
      const userId = await currentUserId();
      await syncCustomerData(userId);
      const cartId = await getOrCreateCartId(userId);
      const productVariant = product.variants?.find((item) => {
        const label = [item.color, item.size].filter(Boolean).join(' / ');
        return variant ? label === variant : item.id === product.variants?.[0]?.id;
      });
      let existingQuery = supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', product.id);
      existingQuery = productVariant
        ? existingQuery.eq('variant_id', productVariant.id)
        : existingQuery.is('variant_id', null);

      const { data: existing, error: existingError } = await existingQuery.maybeSingle();
      if (existingError) throw new Error(existingError.message);

      if (existing) {
        const { data, error } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('id')
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error('Supabase không cho phép cập nhật sản phẩm trong giỏ hàng.');
      } else {
        const { data, error } = await supabase.from('cart_items').insert({
            cart_id: cartId,
            product_id: product.id,
            variant_id: productVariant?.id ?? null,
            quantity,
          })
          .select('id')
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error('Supabase không xác nhận đã thêm sản phẩm vào giỏ hàng.');
      }

      await syncCustomerData(userId, true);
      return null;
    } catch (error) {
      return getErrorMessage(error);
    }
  },

  async updateQuantity(cartItemId: string, quantity: number): Promise<string | null> {
    if (quantity <= 0) {
      return this.removeFromCart(cartItemId);
    }
    const previousCart = state.cart;
    const previousItem = previousCart.find((item) => item.id === cartItemId);
    if (!previousItem) return 'Không tìm thấy sản phẩm trong giỏ hàng.';
    state = {
      ...state,
      cart: state.cart.map((item) => item.id === cartItemId ? { ...item, quantity } : item),
    };
    notify();

    try {
      await currentUserId();
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq('id', cartItemId)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error('Không thể cập nhật số lượng. Vui lòng kiểm tra quyền truy cập giỏ hàng.');
      }
      return null;
    } catch (error) {
      state = { ...state, cart: previousCart };
      notify();
      return getErrorMessage(error);
    }
  },

  async removeFromCart(cartItemId: string): Promise<string | null> {
    const previousCart = state.cart;
    if (!previousCart.some((item) => item.id === cartItemId)) {
      return 'Không tìm thấy sản phẩm trong giỏ hàng.';
    }
    state = { ...state, cart: previousCart.filter((item) => item.id !== cartItemId) };
    notify();

    try {
      await currentUserId();
      const { data, error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error('Không thể xóa sản phẩm. Vui lòng kiểm tra quyền truy cập giỏ hàng.');
      }
      return null;
    } catch (error) {
      state = { ...state, cart: previousCart };
      notify();
      return getErrorMessage(error);
    }
  },

  toggleSelectItem(cartItemId: string) {
    const nextCart = state.cart.map((item) =>
      item.id === cartItemId ? { ...item, selected: !item.selected } : item
    );
    state = { ...state, cart: nextCart };
    notify();
  },

  toggleSelectAll(select: boolean) {
    const nextCart = state.cart.map((item) => ({ ...item, selected: select }));
    state = { ...state, cart: nextCart };
    notify();
  },

  async clearCart(): Promise<string | null> {
    const previousCart = state.cart;
    const itemIds = previousCart.map((item) => item.id);
    if (itemIds.length === 0) return null;
    state = { ...state, cart: [] };
    notify();

    try {
      const userId = await currentUserId();
      const { count, error } = await supabase
        .from('cart_items')
        .delete({ count: 'exact' })
        .in('id', itemIds);
      if (error) throw new Error(error.message);
      if (count !== itemIds.length) {
        await syncCustomerData(userId, true);
        if (state.cart.length > 0) {
          throw new Error('Không thể xóa toàn bộ giỏ hàng. Vui lòng kiểm tra quyền truy cập rồi thử lại.');
        }
      }
      return null;
    } catch (error) {
      state = { ...state, cart: previousCart };
      notify();
      return getErrorMessage(error);
    }
  },

  async clearSelectedCart(): Promise<string | null> {
    const previousCart = state.cart;
    const selectedIds = previousCart.filter((item) => item.selected).map((item) => item.id);
    if (selectedIds.length === 0) return null;
    state = { ...state, cart: previousCart.filter((item) => !selectedIds.includes(item.id)) };
    notify();

    try {
      await currentUserId();
      const { data, error } = await supabase
        .from('cart_items')
        .delete()
        .in('id', selectedIds)
        .select('id');
      if (error) throw new Error(error.message);
      if (data.length !== selectedIds.length) {
        throw new Error('Không thể xóa một số sản phẩm đã chọn. Vui lòng kiểm tra quyền truy cập rồi thử lại.');
      }
      return null;
    } catch (error) {
      state = { ...state, cart: previousCart };
      notify();
      return getErrorMessage(error);
    }
  },

  applyVoucher(code: string): { success: boolean; message: string } {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      state = { ...state, voucherCode: '', discountRate: 0 };
      notify();
      return { success: false, message: 'Vui lòng nhập mã ưu đãi' };
    }
    if (normalized === 'MAYMOI10' || normalized === 'CHOMAY10') {
      state = { ...state, voucherCode: normalized, discountRate: 0.1 }; // 10%
      notify();
      return { success: true, message: 'Áp dụng mã giảm 10% thành công!' };
    }
    if (normalized === 'GIAM20' || normalized === 'SALE20') {
      state = { ...state, voucherCode: normalized, discountRate: 0.2 }; // 20%
      notify();
      return { success: true, message: 'Áp dụng mã giảm 20% thành công!' };
    }
    return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' };
  },

  removeVoucher() {
    state = { ...state, voucherCode: '', discountRate: 0 };
    notify();
  },

  // Favorites Actions
  async toggleFavorite(productId: string, product?: Product): Promise<string | null> {
    const previousState = state;
    const exists = state.favoriteIds.includes(productId);
    let favoriteProduct = product ?? state.favorites.find((item) => item.id === productId);

    if (!exists) {
      if (!favoriteProduct) {
        try {
          favoriteProduct = await ProductService.getById(productId) ?? undefined;
        } catch (error) {
          return getErrorMessage(error);
        }
      }
      if (!favoriteProduct) return 'Không tìm thấy sản phẩm đang hoạt động.';
      state = {
        ...state,
        favoriteIds: [...state.favoriteIds, productId],
        favorites: [favoriteProduct, ...state.favorites.filter((item) => item.id !== productId)],
      };
    } else {
      state = {
        ...state,
        favoriteIds: state.favoriteIds.filter((id) => id !== productId),
        favorites: state.favorites.filter((item) => item.id !== productId),
      };
    }
    notify();

    try {
      const userId = await currentUserId();
      if (exists) {
        const { data, error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId)
          .select('product_id')
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error('Không thể xóa sản phẩm khỏi yêu thích.');
      } else {
        const { data, error } = await supabase
          .from('favorites')
          .insert({ user_id: userId, product_id: productId })
          .select('product_id')
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error('Supabase không xác nhận đã thêm sản phẩm yêu thích.');
      }
      return null;
    } catch (error) {
      state = previousState;
      notify();
      return getErrorMessage(error);
    }
  },

  async removeFavorite(productId: string): Promise<string | null> {
    const previousState = state;
    state = {
      ...state,
      favoriteIds: state.favoriteIds.filter((id) => id !== productId),
      favorites: state.favorites.filter((product) => product.id !== productId),
    };
    notify();

    try {
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId)
        .select('product_id')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Không thể xóa sản phẩm khỏi yêu thích.');
      return null;
    } catch (error) {
      state = previousState;
      notify();
      return getErrorMessage(error);
    }
  },

  isFavorite(productId: string) {
    return state.favoriteIds.includes(productId);
  },

  // Orders Actions
  placeOrder(params: {
    items: { product: Product; quantity: number; variant?: string }[];
    recipientName: string;
    phone: string;
    address: string;
    paymentMethod: 'cod' | 'bank_transfer' | 'e_wallet';
    note?: string;
  }): Order {
    const subtotal = params.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const tax = Math.round(subtotal * 0.1);
    const shippingFee = 25000;
    const discount = Math.round(subtotal * state.discountRate);
    const total = Math.max(0, subtotal + tax + shippingFee - discount);

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1
    ).padStart(2, '0')}/${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `${2027 + state.orders.length}`,
      date: dateStr,
      time: timeStr,
      status: 'pending',
      items: params.items.map((item, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        productId: item.product.id,
        productName: item.product.name,
        variant: item.variant ?? item.product.variant,
        quantity: item.quantity,
        price: item.product.price,
        image: item.product.image,
      })),
      subtotal,
      tax,
      shippingFee,
      discount,
      total,
      recipientName: params.recipientName,
      phone: params.phone,
      address: params.address,
      paymentMethod: params.paymentMethod,
      isPaid: false,
    };

    state = {
      ...state,
      orders: [newOrder, ...state.orders],
      voucherCode: '',
      discountRate: 0,
    };
    notify();
    return newOrder;
  },

  cancelOrder(orderId: string): boolean {
    let updated = false;
    const nextOrders = state.orders.map((ord) => {
      if (ord.id === orderId || ord.orderNumber === orderId) {
        updated = true;
        return { ...ord, status: 'cancelled' as const };
      }
      return ord;
    });
    if (updated) {
      state = { ...state, orders: nextOrders };
      notify();
    }
    return updated;
  },

  getOrderById(id: string): Order | undefined {
    return state.orders.find((ord) => ord.id === id || ord.orderNumber === id);
  },

  // Reviews
  addReview(review: Omit<Review, 'id' | 'createdAt'>): Review {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1
    ).padStart(2, '0')}/${now.getFullYear()}`;

    const newReview: Review = {
      ...review,
      id: `rev-${Date.now()}`,
      userName: review.userName || 'Nguyễn Minh Anh',
      isVerifiedBuyer: review.isVerifiedBuyer ?? true,
      createdAt: dateStr,
    };
    state = { ...state, reviews: [newReview, ...state.reviews] };
    notify();
    return newReview;
  },

  getReviewsByProductId(productId: string): Review[] {
    return state.reviews.filter((r) => r.productId === productId);
  },
};

// React Hooks
function useMarketplaceState() {
  const snapshot = useSyncExternalStore(
    marketplaceStore.subscribe,
    marketplaceStore.getState,
    marketplaceStore.getServerSnapshot
  );
  useEffect(() => {
    startCustomerDataSync();
  }, []);
  return snapshot;
}

export function useCart() {
  const s = useMarketplaceState();
  const selectedItems = s.cart.filter((i) => i.selected);
  const subtotal = selectedItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const discount = Math.round(subtotal * s.discountRate);
  const tax = Math.round(subtotal * 0.1);
  const shippingFee = subtotal > 0 ? 25000 : 0;
  const total = Math.max(0, subtotal + tax + shippingFee - discount);
  const totalQuantity = s.cart.reduce((acc, item) => acc + item.quantity, 0);

  return {
    cart: s.cart,
    loading: s.cartLoading,
    error: s.cartError,
    refresh: marketplaceStore.refreshCustomerData.bind(marketplaceStore),
    selectedItems,
    subtotal,
    discount,
    tax,
    shippingFee,
    total,
    totalQuantity,
    voucherCode: s.voucherCode,
    discountRate: s.discountRate,
    addToCart: marketplaceStore.addToCart.bind(marketplaceStore),
    updateQuantity: marketplaceStore.updateQuantity.bind(marketplaceStore),
    removeFromCart: marketplaceStore.removeFromCart.bind(marketplaceStore),
    toggleSelectItem: marketplaceStore.toggleSelectItem.bind(marketplaceStore),
    toggleSelectAll: marketplaceStore.toggleSelectAll.bind(marketplaceStore),
    clearCart: marketplaceStore.clearCart.bind(marketplaceStore),
    clearSelectedCart: marketplaceStore.clearSelectedCart.bind(marketplaceStore),
    applyVoucher: marketplaceStore.applyVoucher.bind(marketplaceStore),
    removeVoucher: marketplaceStore.removeVoucher.bind(marketplaceStore),
  };
}

export function useFavorites() {
  const s = useMarketplaceState();

  return {
    favoriteIds: s.favoriteIds,
    favorites: s.favorites,
    count: s.favorites.length,
    loading: s.favoritesLoading,
    error: s.favoritesError,
    refresh: marketplaceStore.refreshCustomerData.bind(marketplaceStore),
    toggleFavorite: marketplaceStore.toggleFavorite.bind(marketplaceStore),
    removeFavorite: marketplaceStore.removeFavorite.bind(marketplaceStore),
    isFavorite: (productId: string) => s.favoriteIds.includes(productId),
  };
}

export function useOrders() {
  const s = useMarketplaceState();

  return {
    orders: s.orders,
    getOrderById: marketplaceStore.getOrderById.bind(marketplaceStore),
    placeOrder: marketplaceStore.placeOrder.bind(marketplaceStore),
    cancelOrder: marketplaceStore.cancelOrder.bind(marketplaceStore),
  };
}

export function useReviews() {
  const s = useMarketplaceState();

  return {
    reviews: s.reviews,
    addReview: marketplaceStore.addReview.bind(marketplaceStore),
    getReviewsByProductId: marketplaceStore.getReviewsByProductId.bind(marketplaceStore),
  };
}
