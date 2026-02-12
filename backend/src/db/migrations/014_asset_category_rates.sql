create table if not exists asset_category_rates (
  category text primary key,
  hourly_rate_cents integer not null
);

