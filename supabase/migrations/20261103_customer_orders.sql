-- Secure customer checkout and avatar storage setup.
-- Run after schema.sql and policies.sql in the Supabase SQL editor.

create or replace function public.create_customer_order(
  p_items jsonb,
  p_recipient_name text,
  p_recipient_phone text,
  p_delivery_address text,
  p_payment_method text,
  p_customer_note text default null,
  p_voucher_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_product public.products%rowtype;
  v_order_id uuid;
  v_voucher public.vouchers%rowtype;
  v_voucher_id uuid;
  v_voucher_code text;
  v_subtotal numeric(12, 2) := 0;
  v_tax numeric(12, 2) := 0;
  v_shipping numeric(12, 2) := 25000;
  v_discount numeric(12, 2) := 0;
  v_unit_price numeric(12, 2);
  v_total numeric(12, 2);
  v_item_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Bạn cần đăng nhập để đặt hàng.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.account_status = 'active'
  ) then
    raise exception 'Tài khoản không thể đặt hàng.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Giỏ hàng không hợp lệ.' using errcode = '22023';
  end if;
  if nullif(trim(p_recipient_name), '') is null
     or nullif(trim(p_recipient_phone), '') is null
     or nullif(trim(p_delivery_address), '') is null then
    raise exception 'Vui lòng nhập đầy đủ thông tin giao hàng.' using errcode = '22023';
  end if;
  if p_payment_method not in ('cod', 'bank_transfer', 'e_wallet') then
    raise exception 'Phương thức thanh toán không hợp lệ.' using errcode = '22023';
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_items)
      as line(product_id text, quantity integer, variant_label text)
  loop
    v_item_count := v_item_count + 1;
    if v_item.product_id is null or v_item.quantity is null
       or v_item.quantity < 1 or v_item.quantity > 100 then
      raise exception 'Sản phẩm hoặc số lượng không hợp lệ.' using errcode = '22023';
    end if;

    select * into v_product
    from public.products p
    where p.id = v_item.product_id::uuid and p.status = 'active'
    for update;
    if not found then
      raise exception 'Một sản phẩm trong giỏ hàng không còn khả dụng.' using errcode = 'P0002';
    end if;

    update public.products p
      set stock_quantity = p.stock_quantity - v_item.quantity,
          updated_at = now()
    where p.id = v_product.id and p.stock_quantity >= v_item.quantity;
    if not found then
      raise exception 'Sản phẩm không đủ tồn kho: %.', v_product.name using errcode = 'P0001';
    end if;

    v_unit_price := v_product.price;
    v_subtotal := v_subtotal + (v_unit_price * v_item.quantity);
  end loop;

  if v_item_count = 0 then
    raise exception 'Giỏ hàng trống.' using errcode = '22023';
  end if;

  v_tax := round(v_subtotal * 0.10, 0);
  if nullif(trim(p_voucher_code), '') is not null then
    select * into v_voucher
    from public.vouchers v
    where upper(v.code) = upper(trim(p_voucher_code))
    for update;

    if not found or not v_voucher.is_active
       or (v_voucher.starts_at is not null and v_voucher.starts_at > now())
       or (v_voucher.expires_at is not null and v_voucher.expires_at <= now())
       or (v_voucher.usage_limit is not null and v_voucher.used_count >= v_voucher.usage_limit)
       or v_subtotal < v_voucher.min_order_amount then
      raise exception 'Mã giảm giá không hợp lệ hoặc không còn áp dụng.' using errcode = '22023';
    end if;

    if v_voucher.discount_type = 'percentage' then
      v_discount := round(v_subtotal * v_voucher.discount_value / 100, 0);
    else
      v_discount := v_voucher.discount_value;
    end if;
    if v_voucher.max_discount is not null then
      v_discount := least(v_discount, v_voucher.max_discount);
    end if;
    v_discount := least(v_discount, v_subtotal);
    v_voucher_id := v_voucher.id;
    v_voucher_code := v_voucher.code;

    update public.vouchers
      set used_count = used_count + 1, updated_at = now()
    where id = v_voucher.id;
  end if;

  v_total := greatest(0, v_subtotal + v_tax + v_shipping - v_discount);
  insert into public.orders (
    user_id, payment_method, subtotal, discount_amount, shipping_fee,
    total_amount, voucher_id, voucher_code, recipient_name,
    recipient_phone, delivery_address, customer_note
  ) values (
    v_user_id, p_payment_method, v_subtotal, v_discount, v_shipping,
    v_total, v_voucher_id, v_voucher_code, trim(p_recipient_name),
    trim(p_recipient_phone), trim(p_delivery_address), nullif(trim(p_customer_note), '')
  ) returning id into v_order_id;

  for v_item in
    select * from jsonb_to_recordset(p_items)
      as line(product_id text, quantity integer, variant_label text)
  loop
    select * into v_product from public.products p where p.id = v_item.product_id::uuid;
    insert into public.order_items (
      order_id, product_id, product_name, variant_label,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_product.name,
      nullif(trim(v_item.variant_label), ''), v_product.price,
      v_item.quantity, v_product.price * v_item.quantity
    );
  end loop;

  insert into public.notifications (user_id, title, body, type, data)
  values (
    v_user_id, 'Đặt hàng thành công', 'Đơn hàng của bạn đã được tiếp nhận.',
    'order', jsonb_build_object('order_id', v_order_id)
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_customer_order(jsonb, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.create_customer_order(jsonb, text, text, text, text, text, text)
  to authenticated;

create or replace function public.notify_customer_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.notifications (user_id, title, body, type, data)
    values (
      new.user_id,
      case new.status
        when 'confirmed' then 'Đơn hàng đã được xác nhận'
        when 'processing' then 'Đơn hàng đang được chuẩn bị'
        when 'shipped' then 'Đơn hàng đang được giao'
        when 'delivered' then 'Đơn hàng đã được giao'
        when 'cancelled' then 'Đơn hàng đã bị hủy'
        else 'Đơn hàng được cập nhật'
      end,
      'Trạng thái đơn hàng #' || new.order_number || ' đã thay đổi.',
      'order', jsonb_build_object('order_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_customer_order_status_changed on public.orders;
create trigger on_customer_order_status_changed
  after update of status on public.orders
  for each row execute function public.notify_customer_order_status();
revoke all on function public.notify_customer_order_status() from public, anon, authenticated;

-- Customer avatars are stored under a folder named for the authenticated user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_avatar_read on storage.objects;
drop policy if exists app_avatar_insert on storage.objects;
drop policy if exists app_avatar_update on storage.objects;
drop policy if exists app_avatar_delete on storage.objects;
create policy app_avatar_read on storage.objects
  for select to public using (bucket_id = 'avatars');
create policy app_avatar_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy app_avatar_update on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy app_avatar_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
