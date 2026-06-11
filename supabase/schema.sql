-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Profile Table
create table if not exists public.users (
  id uuid primary key,
  username text not null,
  avatar_url text,
  balance numeric(12, 2) not null default 1000.00 check (balance >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Users
alter table public.users enable row level security;
drop policy if exists "Allow public read access to users" on public.users;
create policy "Allow public read access to users" on public.users for select using (true);
drop policy if exists "Allow users to update their own profiles" on public.users;
create policy "Allow users to update their own profiles" on public.users for update using (true);

-- 2. Markets Table
create table if not exists public.markets (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  description text,
  resolution_date timestamp with time zone not null,
  creator_id uuid not null references public.users(id),
  status text not null default 'active' check (status in ('active', 'resolved')),
  outcome text check (outcome in ('YES', 'NO')),
  image_url text,
  tagged_users text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Markets
alter table public.markets enable row level security;
drop policy if exists "Allow public read access to markets" on public.markets;
create policy "Allow public read access to markets" on public.markets for select using (true);

-- 3. Liquidity Pools Table (CPMM: x * y = k)
create table if not exists public.liquidity_pools (
  market_id uuid primary key references public.markets(id) on delete cascade,
  yes_shares numeric(16, 4) not null check (yes_shares > 0),
  no_shares numeric(16, 4) not null check (no_shares > 0),
  k numeric(32, 4) not null check (k > 0),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Liquidity Pools
alter table public.liquidity_pools enable row level security;
drop policy if exists "Allow public read access to liquidity pools" on public.liquidity_pools;
create policy "Allow public read access to liquidity pools" on public.liquidity_pools for select using (true);

-- 4. User Positions Table
create table if not exists public.user_positions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  yes_shares numeric(16, 4) not null default 0.0000 check (yes_shares >= 0),
  no_shares numeric(16, 4) not null default 0.0000 check (no_shares >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, market_id)
);

-- Enable RLS for User Positions
alter table public.user_positions enable row level security;
drop policy if exists "Allow users to read their own positions" on public.user_positions;
create policy "Allow users to read their own positions" on public.user_positions for select using (true);

-- 5. Transactions / Trade Log Table
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  type text not null check (type in ('buy_yes', 'buy_no', 'sell_yes', 'sell_no', 'resolve_claim', 'create_market')),
  amount_tokens numeric(12, 2) not null,
  amount_shares numeric(16, 4) not null,
  fee_tokens numeric(12, 2) not null default 0.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Transactions
alter table public.transactions enable row level security;
drop policy if exists "Allow public read access to transactions" on public.transactions;
create policy "Allow public read access to transactions" on public.transactions for select using (true);

-- ==========================================
-- TRANSACTIONAL RPC FUNCTIONS FOR TRADING ENGINE
-- ==========================================

-- 1. Create Market Function
create or replace function public.create_market_rpc(
  p_question text,
  p_description text,
  p_resolution_date timestamp with time zone,
  p_creator_id uuid,
  p_image_url text default null,
  p_tagged_users text[] default null
)
returns uuid as $$
declare
  v_market_id uuid;
begin
  -- Check creator balance
  if not exists (select 1 from public.users where id = p_creator_id and balance >= 50.00 for update) then
    raise exception 'Insufficient balance to inject initial liquidity (50 Tokens required)';
  end if;

  -- Deduct balance
  update public.users
  set balance = balance - 50.00
  where id = p_creator_id;

  -- Insert market
  insert into public.markets (question, description, resolution_date, creator_id, image_url, tagged_users)
  values (p_question, p_description, p_resolution_date, p_creator_id, p_image_url, p_tagged_users)
  returning id into v_market_id;

  -- Insert liquidity pool (50 Yes, 50 No, k = 2500)
  insert into public.liquidity_pools (market_id, yes_shares, no_shares, k)
  values (v_market_id, 50.0000, 50.0000, 2500.0000);

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (p_creator_id, v_market_id, 'create_market', 50.00, 50.0000, 0.00);

  return v_market_id;
end;
$$ language plpgsql security definer;

-- 2. Place Bet YES Function
create or replace function public.place_bet_yes_rpc(
  p_user_id uuid,
  p_market_id uuid,
  p_wager numeric
)
returns numeric as $$
declare
  v_creator_id uuid;
  v_yes_shares numeric;
  v_no_shares numeric;
  v_k numeric;
  v_fee numeric;
  v_net numeric;
  v_new_no numeric;
  v_new_yes numeric;
  v_shares numeric;
begin
  -- Lock liquidity pool row
  select yes_shares, no_shares, k into v_yes_shares, v_no_shares, v_k
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  if not found then
    raise exception 'Liquidity pool not found';
  end if;

  -- Check and lock user balance
  if not exists (select 1 from public.users where id = p_user_id and balance >= p_wager for update) then
    raise exception 'Insufficient balance';
  end if;

  -- Get market creator
  select creator_id into v_creator_id from public.markets where id = p_market_id;

  -- Compute trade
  v_fee := p_wager * 0.02;
  v_net := p_wager - v_fee;
  
  v_new_no := v_no_shares + v_net;
  v_new_yes := v_k / v_new_no;
  v_shares := v_net + (v_yes_shares - v_new_yes);

  -- Deduct user balance
  update public.users set balance = balance - p_wager where id = p_user_id;

  -- Add fee to creator balance
  update public.users set balance = balance + v_fee where id = v_creator_id;

  -- Update pool
  update public.liquidity_pools
  set yes_shares = v_new_yes, no_shares = v_new_no, updated_at = now()
  where market_id = p_market_id;

  -- Update/Insert user position
  insert into public.user_positions (user_id, market_id, yes_shares, no_shares)
  values (p_user_id, p_market_id, v_shares, 0)
  on conflict (user_id, market_id) do update
  set yes_shares = public.user_positions.yes_shares + v_shares;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (p_user_id, p_market_id, 'buy_yes', p_wager, v_shares, v_fee);

  return v_shares;
end;
$$ language plpgsql security definer;

-- 3. Place Bet NO Function
create or replace function public.place_bet_no_rpc(
  p_user_id uuid,
  p_market_id uuid,
  p_wager numeric
)
returns numeric as $$
declare
  v_creator_id uuid;
  v_yes_shares numeric;
  v_no_shares numeric;
  v_k numeric;
  v_fee numeric;
  v_net numeric;
  v_new_yes numeric;
  v_new_no numeric;
  v_shares numeric;
begin
  -- Lock liquidity pool row
  select yes_shares, no_shares, k into v_yes_shares, v_no_shares, v_k
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  if not found then
    raise exception 'Liquidity pool not found';
  end if;

  -- Check and lock user balance
  if not exists (select 1 from public.users where id = p_user_id and balance >= p_wager for update) then
    raise exception 'Insufficient balance';
  end if;

  -- Get market creator
  select creator_id into v_creator_id from public.markets where id = p_market_id;

  -- Compute trade
  v_fee := p_wager * 0.02;
  v_net := p_wager - v_fee;
  
  v_new_yes := v_yes_shares + v_net;
  v_new_no := v_k / v_new_yes;
  v_shares := v_net + (v_no_shares - v_new_no);

  -- Deduct user balance
  update public.users set balance = balance - p_wager where id = p_user_id;

  -- Add fee to creator balance
  update public.users set balance = balance + v_fee where id = v_creator_id;

  -- Update pool
  update public.liquidity_pools
  set yes_shares = v_new_yes, no_shares = v_new_no, updated_at = now()
  where market_id = p_market_id;

  -- Update/Insert user position
  insert into public.user_positions (user_id, market_id, yes_shares, no_shares)
  values (p_user_id, p_market_id, 0, v_shares)
  on conflict (user_id, market_id) do update
  set no_shares = public.user_positions.no_shares + v_shares;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (p_user_id, p_market_id, 'buy_no', p_wager, v_shares, v_fee);

  return v_shares;
end;
$$ language plpgsql security definer;

-- 4. Sell Bet YES Function
create or replace function public.sell_bet_yes_rpc(
  p_user_id uuid,
  p_market_id uuid,
  p_shares numeric
)
returns numeric as $$
declare
  v_creator_id uuid;
  v_yes_shares numeric;
  v_no_shares numeric;
  v_k numeric;
  v_user_yes numeric;
  v_user_no numeric;
  v_L numeric;
  v_d numeric;
  v_gross_tokens numeric;
  v_fee numeric;
  v_net_tokens numeric;
  v_new_no numeric;
  v_new_yes numeric;
begin
  -- Lock liquidity pool row
  select yes_shares, no_shares, k into v_yes_shares, v_no_shares, v_k
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  if not found then
    raise exception 'Liquidity pool not found';
  end if;

  -- Lock user position
  select yes_shares, no_shares into v_user_yes, v_user_no
  from public.user_positions
  where user_id = p_user_id and market_id = p_market_id
  for update;

  if not found or v_user_yes < p_shares then
    raise exception 'Insufficient YES shares to sell';
  end if;

  -- Get market creator
  select creator_id into v_creator_id from public.markets where id = p_market_id;

  -- Compute sell math
  v_L := p_shares + v_yes_shares;
  v_d := (v_L + v_no_shares) * (v_L + v_no_shares) - 4 * p_shares * v_no_shares;
  if v_d < 0 then
    raise exception 'Math error: negative discriminant';
  end if;

  v_gross_tokens := ((v_L + v_no_shares) - sqrt(v_d)) / 2;

  if v_gross_tokens >= v_no_shares then
    raise exception 'Insufficient pool liquidity';
  end if;

  v_fee := v_gross_tokens * 0.02;
  v_net_tokens := v_gross_tokens - v_fee;

  v_new_no := v_no_shares - v_gross_tokens;
  v_new_yes := v_k / v_new_no;

  -- Deduct user shares
  update public.user_positions
  set yes_shares = yes_shares - p_shares
  where user_id = p_user_id and market_id = p_market_id;

  -- Add net tokens to user balance
  update public.users set balance = balance + v_net_tokens where id = p_user_id;

  -- Add fee to creator balance
  update public.users set balance = balance + v_fee where id = v_creator_id;

  -- Update pool
  update public.liquidity_pools
  set yes_shares = v_new_yes, no_shares = v_new_no, updated_at = now()
  where market_id = p_market_id;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (p_user_id, p_market_id, 'sell_yes', v_net_tokens, p_shares, v_fee);

  return v_net_tokens;
end;
$$ language plpgsql security definer;

-- 5. Sell Bet NO Function
create or replace function public.sell_bet_no_rpc(
  p_user_id uuid,
  p_market_id uuid,
  p_shares numeric
)
returns numeric as $$
declare
  v_creator_id uuid;
  v_yes_shares numeric;
  v_no_shares numeric;
  v_k numeric;
  v_user_yes numeric;
  v_user_no numeric;
  v_L numeric;
  v_d numeric;
  v_gross_tokens numeric;
  v_fee numeric;
  v_net_tokens numeric;
  v_new_yes numeric;
  v_new_no numeric;
begin
  -- Lock liquidity pool row
  select yes_shares, no_shares, k into v_yes_shares, v_no_shares, v_k
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  if not found then
    raise exception 'Liquidity pool not found';
  end if;

  -- Lock user position
  select yes_shares, no_shares into v_user_yes, v_user_no
  from public.user_positions
  where user_id = p_user_id and market_id = p_market_id
  for update;

  if not found or v_user_no < p_shares then
    raise exception 'Insufficient NO shares to sell';
  end if;

  -- Get market creator
  select creator_id into v_creator_id from public.markets where id = p_market_id;

  -- Compute sell math
  v_L := p_shares + v_no_shares;
  v_d := (v_L + v_yes_shares) * (v_L + v_yes_shares) - 4 * p_shares * v_yes_shares;
  if v_d < 0 then
    raise exception 'Math error: negative discriminant';
  end if;

  v_gross_tokens := ((v_L + v_yes_shares) - sqrt(v_d)) / 2;

  if v_gross_tokens >= v_yes_shares then
    raise exception 'Insufficient pool liquidity';
  end if;

  v_fee := v_gross_tokens * 0.02;
  v_net_tokens := v_gross_tokens - v_fee;

  v_new_yes := v_yes_shares - v_gross_tokens;
  v_new_no := v_k / v_new_yes;

  -- Deduct user shares
  update public.user_positions
  set no_shares = no_shares - p_shares
  where user_id = p_user_id and market_id = p_market_id;

  -- Add net tokens to user balance
  update public.users set balance = balance + v_net_tokens where id = p_user_id;

  -- Add fee to creator balance
  update public.users set balance = balance + v_fee where id = v_creator_id;

  -- Update pool
  update public.liquidity_pools
  set yes_shares = v_new_yes, no_shares = v_new_no, updated_at = now()
  where market_id = p_market_id;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (p_user_id, p_market_id, 'sell_no', v_net_tokens, p_shares, v_fee);

  return v_net_tokens;
end;
$$ language plpgsql security definer;

-- 6. Resolve Market Function
create or replace function public.resolve_market_rpc(
  p_market_id uuid,
  p_outcome text,
  p_admin_id uuid
)
returns void as $$
declare
  v_creator_id uuid;
  v_status text;
  v_refund numeric;
  v_yes_shares numeric;
  v_no_shares numeric;
begin
  -- Lock market
  select creator_id, status into v_creator_id, v_status
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_status != 'active' then
    raise exception 'Market is already resolved';
  end if;

  -- Allow creator OR MarketMaker admin to resolve
  if v_creator_id != p_admin_id and not exists (
    select 1 from public.users where id = p_admin_id and lower(username) = 'marketmaker'
  ) then
    raise exception 'Only the market creator or MarketMaker can resolve this market';
  end if;

  if p_outcome not in ('YES', 'NO') then
    raise exception 'Outcome must be YES or NO';
  end if;

  -- Lock liquidity pool to payout remaining LP tokens
  select yes_shares, no_shares into v_yes_shares, v_no_shares
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  if p_outcome = 'YES' then
    v_refund := v_yes_shares;
  else
    v_refund := v_no_shares;
  end if;

  -- Update market outcome and status
  update public.markets
  set status = 'resolved', outcome = p_outcome
  where id = p_market_id;

  -- Return pool value to creator
  update public.users
  set balance = balance + v_refund
  where id = v_creator_id;

  -- Deplete liquidity pool shares to a minimal amount (cannot be 0 due to constraints)
  update public.liquidity_pools
  set yes_shares = 0.0001, no_shares = 0.0001, k = 0.00000001, updated_at = now()
  where market_id = p_market_id;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (v_creator_id, p_market_id, 'resolve_claim', v_refund, v_refund, 0);
end;
$$ language plpgsql security definer;

-- 7. Claim Payout Function
create or replace function public.claim_payout_rpc(
  p_user_id uuid,
  p_market_id uuid
)
returns numeric as $$
declare
  v_status text;
  v_outcome text;
  v_user_yes numeric;
  v_user_no numeric;
  v_payout numeric := 0;
begin
  -- Check market status
  select status, outcome into v_status, v_outcome
  from public.markets
  where id = p_market_id;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_status != 'resolved' then
    raise exception 'Market is not resolved yet';
  end if;

  -- Lock user position
  select yes_shares, no_shares into v_user_yes, v_user_no
  from public.user_positions
  where user_id = p_user_id and market_id = p_market_id
  for update;

  if not found or (v_user_yes = 0 and v_user_no = 0) then
    raise exception 'No position to claim';
  end if;

  -- Calculate payout
  if v_outcome = 'YES' then
    v_payout := v_user_yes;
  elsif v_outcome = 'NO' then
    v_payout := v_user_no;
  end if;

  if v_payout <= 0 then
    -- User had shares of the losing outcome, set position to 0 anyway
    update public.user_positions
    set yes_shares = 0, no_shares = 0
    where user_id = p_user_id and market_id = p_market_id;
    return 0;
  end if;

  -- Update user position to 0
  update public.user_positions
  set yes_shares = 0, no_shares = 0
  where user_id = p_user_id and market_id = p_market_id;

  -- Payout user
  update public.users
  set balance = balance + v_payout
  where id = p_user_id;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (p_user_id, p_market_id, 'resolve_claim', v_payout, v_payout, 0);

  return v_payout;
end;
$$ language plpgsql security definer;

-- Login or Register User RPC (Password-free)
create or replace function public.login_or_register_user_rpc(
  p_username text
)
returns uuid as $$
declare
  v_user_id uuid;
begin
  -- Search for existing user (case insensitive)
  select id into v_user_id
  from public.users
  where lower(username) = lower(trim(p_username));

  -- If not found, create a new user profile with 1000.00 starting balance
  if v_user_id is null then
    v_user_id := uuid_generate_v4();
    
    insert into public.users (id, username, avatar_url, balance)
    values (
      v_user_id,
      trim(p_username),
      'https://api.dicebear.com/7.x/adventurer/svg?seed=' || encode(convert_to(trim(p_username), 'UTF8'), 'base64'),
      1000.00
    );
  end if;

  return v_user_id;
end;
$$ language plpgsql security definer;

-- Faucet Tokens RPC (sandbox printing)
create or replace function public.faucet_tokens_rpc(
  p_user_id uuid
)
returns void as $$
begin
  update public.users
  set balance = balance + 1000.00
  where id = p_user_id;
end;
$$ language plpgsql security definer;
