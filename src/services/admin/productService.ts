
import { supabase } from '../supabase';

// ==================== PRODUCT TYPE ====================

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string | null;
  sku: string | null;
  description: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
  category_name?: string;
  image_url?: string | null;
};

// ==================== CATEGORY TYPE ====================

export type Category = {
  id: string;
  name: string;
};

export type CategoryOption = {
  id: string;
  name: string;
};

// ==================== VARIANT TYPE ====================

export type ProductVariantInput = {
  sku: string;
  color: string | null;
  size: string | null;
  stock_quantity: number;
  price_override: number | null;
  is_active: boolean;
};

// ==================== NEW PRODUCT TYPE ====================

export type NewProductInput = {
  category_id: string | null;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  status: 'draft' | 'active';
  image_url: string | null;
  variants: ProductVariantInput[];
};

// ==================== GET PRODUCTS ====================

export async function getProducts(): Promise<Product[]> {
  const [
    { data: products, error: productError },
    { data: categories, error: categoryError },
    { data: images, error: imageError },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false }),

    supabase
      .from('categories')
      .select('id, name'),

    supabase
      .from('product_images')
      .select('product_id, image_url')
      .order('sort_order', { ascending: true }),
  ]);

  if (productError) throw productError;
  if (categoryError) throw categoryError;
  if (imageError) throw imageError;

  // Ánh xạ danh mục
  const categoryMap = new Map(
    (categories ?? []).map((category) => [
      category.id,
      category.name,
    ]),
  );

  // Ánh xạ ảnh đại diện đầu tiên
  const imageMap = new Map<string, string>();

  for (const image of images ?? []) {
    if (!imageMap.has(image.product_id)) {
      imageMap.set(image.product_id, image.image_url);
    }
  }

  return (products ?? []).map((product) => ({
    ...product,

    category_name: product.category_id
      ? categoryMap.get(product.category_id) ?? 'Chưa phân loại'
      : 'Chưa phân loại',

    image_url: imageMap.get(product.id) ?? null,
  }));
}

// ==================== GET CATEGORIES ====================

export async function getCategories(): Promise<CategoryOption[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

// ==================== ADD PRODUCT ====================

export async function addProduct(input: NewProductInput) {
  const {
    image_url,
    variants,
    ...productData
  } = input;

  // 1. Thêm sản phẩm
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert(productData)
    .select('id')
    .single();

  if (productError) {
    throw productError;
  }

  try {
    // 2. Thêm ảnh sản phẩm nếu có URL
    if (image_url && image_url.trim() !== '') {
      const { error: imageError } = await supabase
        .from('product_images')
        .insert({
          product_id: product.id,
          image_url: image_url.trim(),
          alt_text: input.name,
          sort_order: 0,
        });

      if (imageError) {
        throw imageError;
      }
    }

    // 3. Thêm biến thể sản phẩm
    if (variants && variants.length > 0) {
      const variantData = variants.map((variant) => ({
        product_id: product.id,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        stock_quantity: variant.stock_quantity,
        price_override: variant.price_override,
        is_active: variant.is_active,
      }));

      const { error: variantError } = await supabase
        .from('product_variants')
        .insert(variantData);

      if (variantError) {
        throw variantError;
      }
    }

    return product;
  } catch (error) {
    // 4. Rollback nếu thêm ảnh hoặc biến thể thất bại

    const { error: variantRollbackError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', product.id);

    if (variantRollbackError) {
      console.error(
        'Rollback variants error:',
        variantRollbackError,
      );
    }

    const { error: imageRollbackError } = await supabase
      .from('product_images')
      .delete()
      .eq('product_id', product.id);

    if (imageRollbackError) {
      console.error(
        'Rollback images error:',
        imageRollbackError,
      );
    }

    const { error: productRollbackError } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (productRollbackError) {
      console.error(
        'Rollback product error:',
        productRollbackError,
      );
    }

    throw error;
  }
}

// ==================== DELETE PRODUCT ====================

export async function deleteProduct(productId: string) {
  // 1. Xóa ảnh sản phẩm
  const { error: imageError } = await supabase
    .from('product_images')
    .delete()
    .eq('product_id', productId);

  if (imageError) {
    throw imageError;
  }

  // 2. Xóa biến thể sản phẩm
  const { error: variantError } = await supabase
    .from('product_variants')
    .delete()
    .eq('product_id', productId);

  if (variantError) {
    throw variantError;
  }

  // 3. Xóa sản phẩm
  const { error: productError } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (productError) {
    throw productError;
  }

  return true;
}
