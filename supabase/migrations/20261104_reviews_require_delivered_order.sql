-- Customers may review a product only after an order containing it is delivered.
drop policy if exists app_reviews_insert on public.reviews;
create policy app_reviews_insert on public.reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and moderated_by is null
    and moderated_at is null
    and (select private.is_active_customer())
    and order_id is not null
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.id = reviews.order_id
        and o.user_id = (select auth.uid())
        and o.status = 'delivered'
        and oi.product_id = reviews.product_id
    )
  );
