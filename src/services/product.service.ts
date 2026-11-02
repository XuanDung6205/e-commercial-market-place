import { supabase } from '@/src/services/supabase';
import { Product, ProductVariant } from '@/src/types/models';

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  compare_at_price: number | string | null;
  description: string | null;
  stock_quantity: number | null;
  product_images: { image_url: string }[] | null;
  product_variants: {
    id: string;
    color: string | null;
    size: string | null;
    price_override: number | string | null;
    stock_quantity: number;
    is_active: boolean;
  }[] | null;
};

const PRODUCT_SELECT = `
  id,
  name,
  price,
  compare_at_price,
  description,
  stock_quantity,
  product_images (image_url),
  product_variants (id, color, size, price_override, stock_quantity, is_active)
`;

function mapProduct(row: ProductRow): Product {
  const variants: ProductVariant[] = (row.product_variants ?? [])
    .filter((variant) => variant.is_active)
    .map((variant) => ({
      id: variant.id,
      color: variant.color,
      size: variant.size,
      priceOverride: variant.price_override === null ? null : Number(variant.price_override),
      stock: variant.stock_quantity,
    }));
  const firstVariant = variants[0];
  const variantLabel = firstVariant
    ? [firstVariant.color, firstVariant.size].filter(Boolean).join(' / ')
    : undefined;

  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    compareAtPrice:
      row.compare_at_price === null ? undefined : Number(row.compare_at_price),
    image: row.product_images?.[0]?.image_url ?? '',
    rating: 0,
    reviewCount: 0,
    description: row.description ?? '',
    stock: row.stock_quantity ?? 0,
    variant: variantLabel,
    variants,
  };
}

export const ProductService = {
  async getById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapProduct(data as unknown as ProductRow) : null;
  },

  async getByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .in('id', ids)
      .eq('status', 'active');

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapProduct(row as unknown as ProductRow));
  },
};
