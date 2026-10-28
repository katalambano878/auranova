-- Prisma used @updatedAt in the client. Postgres had no default, so inserts failed.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'Account','Address','Brand','Cart','CartItem','Category','Collection','ContentPage',
    'Coupon','DataRequest','FaqItem','Order','PaymentAttempt','Product','ProductVariant',
    'Promotion','Refund','Review','Session','Shipment','ShippingZone','StoreSettings','User','Verification'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', target);
    execute format(
      'create trigger set_updated_at before insert or update on public.%I for each row execute function public.set_updated_at()',
      target
    );
  end loop;
end $$;
