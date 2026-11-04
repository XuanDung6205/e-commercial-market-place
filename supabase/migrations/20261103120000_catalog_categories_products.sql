-- Sync the customer catalog to the four current categories and four active products each.
-- Safe to re-run: categories, products, and images are upserted by their stable keys.

-- Preserve the existing Food category row if it was renamed from the old home category.
update public.categories
set slug = 'thuc-pham', updated_at = now()
where slug = 'nha-cua-doi-song'
  and name = U&'Th\1EF1c ph\1EA9m'
  and not exists (select 1 from public.categories where slug = 'thuc-pham');

insert into public.categories (name, slug, description, image_url, is_active, sort_order)
values
  (U&'Th\1EDDi trang', 'thoi-trang', 'Trang ph\1EE5c v\00E0 ph\1EE5 ki\1EC7n.', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80', true, 1),
  (U&'\0110i\1EC7n t\1EED', 'dien-tu', 'Thi\1EBFt b\1ECB c\00F4ng ngh\1EC7 v\00E0 ph\1EE5 ki\1EC7n.', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=800&q=80', true, 2),
  (U&'L\00E0m \0111\1EB9p', 'lam-dep', 'S\1EA3n ph\1EA9m ch\0103m s\00F3c c\00E1 nh\00E2n.', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80', true, 3),
  (U&'Th\1EF1c ph\1EA9m', 'thuc-pham', 'Th\1EF1c ph\1EA9m v\00E0 th\1EF1c ph\1EA9m kh\00F4.', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80', true, 4)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Merge products from the old men's and women's categories into Fashion.
update public.products p
set category_id = target.id, updated_at = now()
from public.categories old_category, public.categories target
where target.slug = 'thoi-trang'
  and old_category.id <> target.id
  and p.category_id = old_category.id
  and (old_category.slug in ('thoi-trang-nam', 'thoi-trang-nu')
       or old_category.name in (U&'Th\1EDDi trang nam', U&'Th\1EDDi trang n\1EEF', U&'Th\1EDDi trang'));

-- Remove the old home category and its demo products from the active storefront.
update public.products p
set status = 'inactive', updated_at = now()
where p.slug in ('binh-giu-nhiet-daily-500ml', 'den-ban-doc-sach-aura')
   or p.category_id in (select id from public.categories where slug = 'nha-cua-doi-song');

-- Retire duplicate and obsolete category rows without deleting referenced history.
update public.categories c
set is_active = false, updated_at = now()
where c.slug in ('thoi-trang-nam', 'thoi-trang-nu', 'nha-cua-doi-song')
   or c.name in (U&'Th\1EDDi trang nam', U&'Th\1EDDi trang n\1EEF', U&'Nh\00E0 c\1EEDa & \0111\1EDDi s\1ED1ng');

-- Move any duplicate current-name categories to the canonical category IDs.
update public.products p
set category_id = target.id, updated_at = now()
from public.categories duplicate, public.categories target
where duplicate.id = p.category_id
  and duplicate.id <> target.id
  and duplicate.name = target.name
  and target.slug in ('thoi-trang', 'dien-tu', 'lam-dep', 'thuc-pham');
update public.categories duplicate
set is_active = false, updated_at = now()
from public.categories target
where duplicate.id <> target.id
  and duplicate.name = target.name
  and target.slug in ('thoi-trang', 'dien-tu', 'lam-dep', 'thuc-pham');

with seed_products (category_slug, name, slug, sku, description, price, compare_at_price, stock_quantity) as (
  values
    ('thoi-trang', U&'T\00FAi \0111eo ch\00E9o Mini Cloud', 'tui-deo-cheo-mini-cloud', 'DEMO-BAG-001', 'Lightweight everyday crossbody bag.', 329000::numeric, 399000::numeric, 28),
    ('thoi-trang', U&'\00C1o s\01A1 mi Linen thanh l\1ECBch', 'ao-so-mi-linen-thanh-lich', 'DEMO-WOMEN-001', 'Breathable linen shirt for everyday wear.', 289000::numeric, 349000::numeric, 42),
    ('thoi-trang', U&'\00C1o thun Cotton Basic', 'ao-thun-cotton-basic', 'DEMO-MEN-001', 'Soft cotton t-shirt for daily outfits.', 189000::numeric, 229000::numeric, 65),
    ('thoi-trang', U&'Gi\00E0y Sneaker Urban', 'giay-sneaker-urban', 'DEMO-SHOE-001', 'Minimal sneakers with a lightweight sole.', 649000::numeric, 799000::numeric, 24),
    ('dien-tu', 'Tai nghe Bluetooth Studio', 'tai-nghe-bluetooth-studio', 'DEMO-AUDIO-001', 'Wireless headphones with clear sound and long battery life.', 590000::numeric, 790000::numeric, 31),
    ('dien-tu', U&'\0110\1ED3ng h\1ED3 th\00F4ng minh Fit S', 'dong-ho-thong-minh-fit-s', 'DEMO-WATCH-001', 'Smart watch for activity and health tracking.', 890000::numeric, 1090000::numeric, 19),
    ('dien-tu', 'Loa Bluetooth Mini', 'loa-bluetooth-mini', 'DEMO-AUDIO-002', 'Portable Bluetooth speaker with rich sound.', 490000::numeric, 590000::numeric, 35),
    ('dien-tu', U&'B\00E0n ph\00EDm kh\00F4ng d\00E2y Slim', 'ban-phim-khong-day-slim', 'DEMO-KEYBOARD-001', 'Compact wireless keyboard for work and study.', 550000::numeric, 690000::numeric, 22),
    ('lam-dep', U&'B\1ED9 ch\0103m s\00F3c da Daily Care', 'bo-cham-soc-da-daily-care', 'DEMO-BEAUTY-001', 'Daily skincare essentials for a simple routine.', 399000::numeric, 479000::numeric, 36),
    ('lam-dep', U&'Kem ch\1ED1ng n\1EAFng Daily UV', 'kem-chong-nang-daily-uv', 'DEMO-BEAUTY-002', 'Lightweight daily sunscreen with broad-spectrum protection.', 259000::numeric, 319000::numeric, 40),
    ('lam-dep', U&'S\1EEFa r\1EEDa m\1EB7t tr\00E0 xanh', 'sua-rua-mat-tra-xanh', 'DEMO-BEAUTY-003', 'Gentle green tea facial cleanser for daily use.', 179000::numeric, 219000::numeric, 45),
    ('lam-dep', 'Serum Vitamin C Bright', 'serum-vitamin-c-bright', 'DEMO-BEAUTY-004', 'Vitamin C serum for a bright and even-looking complexion.', 349000::numeric, 429000::numeric, 30),
    ('thuc-pham', U&'C\00E0 ph\00EA rang xay', 'ca-phe-rang-xay', 'DEMO-FOOD-001', 'Freshly roasted ground coffee for home brewing.', 159000::numeric, 189000::numeric, 60),
    ('thuc-pham', U&'G\1EA1o th\01A1m ST25', 'gao-thom-st25', 'DEMO-FOOD-002', 'Fragrant ST25 rice for everyday meals.', 245000::numeric, 285000::numeric, 50),
    ('thuc-pham', U&'M\1EADt ong nguy\00EAn ch\1EA5t', 'mat-ong-nguyen-chat', 'DEMO-FOOD-003', 'Pure honey for drinks and cooking.', 189000::numeric, 229000::numeric, 32),
    ('thuc-pham', U&'H\1EA1t \0111i\1EC1u rang', 'hat-dieu-rang', 'DEMO-FOOD-004', 'Roasted cashews packed fresh for snacking.', 215000::numeric, 259000::numeric, 38)
)
insert into public.products (
  category_id, name, slug, sku, description, price, compare_at_price, stock_quantity, status
)
select c.id, s.name, s.slug, s.sku, s.description, s.price, s.compare_at_price, s.stock_quantity, 'active'
from seed_products s
join public.categories c on c.slug = s.category_slug
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  sku = excluded.sku,
  description = excluded.description,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  stock_quantity = excluded.stock_quantity,
  status = 'active',
  updated_at = now();

with seed_images (product_slug, image_url, alt_text) as (
  values
    ('tui-deo-cheo-mini-cloud', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=80', U&'T\00FAi Mini Cloud'),
    ('ao-so-mi-linen-thanh-lich', 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=1000&q=80', U&'\00C1o s\01A1 mi Linen'),
    ('ao-thun-cotton-basic', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=80', U&'\00C1o thun Cotton Basic'),
    ('giay-sneaker-urban', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80', 'Urban sneakers'),
    ('tai-nghe-bluetooth-studio', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80', 'Bluetooth headphones'),
    ('dong-ho-thong-minh-fit-s', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80', 'Smart watch'),
    ('loa-bluetooth-mini', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1000&q=80', 'Mini Bluetooth speaker'),
    ('ban-phim-khong-day-slim', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80', 'Wireless keyboard'),
    ('bo-cham-soc-da-daily-care', 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=1000&q=80', 'Daily skincare set'),
    ('kem-chong-nang-daily-uv', 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=1000&q=80', 'Daily sunscreen'),
    ('sua-rua-mat-tra-xanh', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1000&q=80', 'Green tea cleanser'),
    ('serum-vitamin-c-bright', 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1000&q=80', 'Vitamin C serum'),
    ('ca-phe-rang-xay', 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1000&q=80', 'Roasted coffee'),
    ('gao-thom-st25', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1000&q=80', 'ST25 rice'),
    ('mat-ong-nguyen-chat', 'https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=1000&q=80', 'Pure honey'),
    ('hat-dieu-rang', 'https://images.unsplash.com/photo-1729796350013-ebb27f079c76?auto=format&fit=crop&w=1000&q=80', 'Roasted cashews')
)
insert into public.product_images (product_id, image_url, alt_text, sort_order)
select p.id, s.image_url, s.alt_text, 0
from seed_images s
join public.products p on p.slug = s.product_slug
on conflict (product_id, sort_order) do update set
  image_url = excluded.image_url,
  alt_text = excluded.alt_text;

insert into public.product_variants (product_id, sku, color, size, stock_quantity, is_active)
select p.id, v.sku, v.color, v.size, v.stock_quantity, true
from (values
  ('ao-thun-cotton-basic', 'DEMO-MEN-001-BLK-M', U&'\0110en', 'M', 20),
  ('ao-thun-cotton-basic', 'DEMO-MEN-001-WHT-L', U&'Tr\1EAFng', 'L', 18),
  ('giay-sneaker-urban', 'DEMO-SHOE-001-WHT-39', U&'Tr\1EAFng', '39', 8),
  ('giay-sneaker-urban', 'DEMO-SHOE-001-WHT-40', U&'Tr\1EAFng', '40', 9)
) as v(product_slug, sku, color, size, stock_quantity)
join public.products p on p.slug = v.product_slug
on conflict (product_id, color, size) do update set
  sku = excluded.sku,
  stock_quantity = excluded.stock_quantity,
  is_active = excluded.is_active;

