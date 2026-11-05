-- =============================================================================
-- Migration: RLS policies and helper functions
-- Date: 2026-01-02
-- Description:
--   Sets up the private schema helper functions and all Row Level Security
--   policies for Guest, Customer, and Admin access patterns.
--   Safe to re-run: all app_ prefixed policies are dropped and recreated.
-- =============================================================================

create schema if not exists private;

create or replace function private.is_active_customer()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_status = 'active'
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.account_status = 'active'
  );
$$;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
revoke all on function private.is_active_customer() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.is_active_customer() to authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Drop all existing app_ policies to make this script repeatable.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and left(policyname, 4) = 'app_'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- Enable RLS on all tables.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.favorites enable row level security;
alter table public.vouchers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.review_images enable row level security;
alter table public.notifications enable row level security;
alter table public.banners enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

-- Public read needed for reviewer name/avatar display.
create policy app_profiles_public_read on public.profiles
  for select to anon, authenticated
  using (true);

create policy app_profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (
    (select private.is_admin())
    or (id = (select auth.uid()) and role = 'customer' and account_status = 'active')
  );

-- ---------------------------------------------------------------------------
-- Public catalog: categories, products, product_images, product_variants, banners, vouchers
-- ---------------------------------------------------------------------------
revoke all on public.categories, public.products, public.product_images,
  public.product_variants, public.banners, public.vouchers from anon, authenticated;
grant select on public.categories, public.products, public.product_images,
  public.product_variants, public.banners, public.vouchers to anon, authenticated;
grant insert, update, delete on public.categories, public.products,
  public.product_images, public.product_variants, public.banners, public.vouchers to authenticated;

create policy app_categories_read on public.categories
  for select to anon, authenticated
  using (is_active or (select private.is_admin()));
create policy app_categories_admin on public.categories
  for all to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy app_products_read on public.products
  for select to anon, authenticated
  using (status = 'active' or (select private.is_admin()));
create policy app_products_admin on public.products
  for all to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy app_product_images_read on public.product_images
  for select to anon, authenticated using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.status = 'active' or (select private.is_admin()))
    )
  );
create policy app_product_images_admin on public.product_images
  for all to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy app_variants_read on public.product_variants
  for select to anon, authenticated using (
    is_active and exists (
      select 1 from public.products p
      where p.id = product_id and (p.status = 'active' or (select private.is_admin()))
    )
  );
create policy app_variants_admin on public.product_variants
  for all to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy app_banners_read on public.banners
  for select to anon, authenticated using (
    (is_active and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now()))
    or (select private.is_admin())
  );
create policy app_banners_admin on public.banners
  for all to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy app_vouchers_read on public.vouchers
  for select to anon, authenticated using (
    (is_active and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
      and (usage_limit is null or used_count < usage_limit))
    or (select private.is_admin())
  );
create policy app_vouchers_admin on public.vouchers
  for all to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Carts and favorites
-- ---------------------------------------------------------------------------
revoke all on public.carts, public.cart_items, public.favorites from anon, authenticated;
grant select, insert, update, delete on public.carts, public.cart_items, public.favorites to authenticated;

create policy app_carts_select on public.carts for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()));
create policy app_carts_insert on public.carts for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_customer()));
create policy app_carts_update on public.carts for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()))
  with check (user_id = (select auth.uid()) and (select private.is_active_customer()));
create policy app_carts_delete on public.carts for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()));

create policy app_cart_items_select on public.cart_items for select to authenticated
  using (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ) and (select private.is_active_customer()));
create policy app_cart_items_insert on public.cart_items for insert to authenticated
  with check (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ) and (select private.is_active_customer()));
create policy app_cart_items_update on public.cart_items for update to authenticated
  using (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ) and (select private.is_active_customer()));
create policy app_cart_items_delete on public.cart_items for delete to authenticated
  using (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ));

create policy app_favorites_select on public.favorites for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()));
create policy app_favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_customer()));
create policy app_favorites_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()));

-- ---------------------------------------------------------------------------
-- Orders and order items
-- ---------------------------------------------------------------------------
revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
grant update (status, payment_status, updated_at) on public.orders to authenticated;

create policy app_orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy app_orders_cancel on public.orders for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending'
    and (select private.is_active_customer()))
  with check (user_id = (select auth.uid()) and status = 'cancelled'
    and payment_status = 'pending');
create policy app_orders_admin on public.orders for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy app_order_items_select on public.order_items for select to authenticated
  using (
    exists (select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid()))
    or (select private.is_admin())
  );
create policy app_order_items_admin on public.order_items for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Reviews and review_images
-- ---------------------------------------------------------------------------
revoke all on public.reviews, public.review_images from anon, authenticated;
grant select on public.reviews, public.review_images to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant insert, delete on public.review_images to authenticated;

create policy app_reviews_read on public.reviews
  for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()));

create policy app_reviews_insert on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy app_reviews_update_own on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy app_reviews_delete_own on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy app_reviews_admin on public.reviews
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- review_images: readable by anyone who can read the review; writable by image owner.
create policy app_review_images_read on public.review_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and (r.status = 'approved' or r.user_id = (select auth.uid()))
    )
  );
create policy app_review_images_write on public.review_images
  for all to authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy app_notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy app_notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_customer()))
  with check (user_id = (select auth.uid()) and (select private.is_active_customer()));
create policy app_notifications_admin on public.notifications for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

