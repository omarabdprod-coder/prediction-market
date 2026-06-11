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
  outcome text, -- The winning outcome (e.g., 'YES', 'Bob', 'None')
  image_url text,
  tagged_users text[],
  outcomes text[] not null default array['YES', 'NO'],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Markets
alter table public.markets enable row level security;
drop policy if exists "Allow public read access to markets" on public.markets;
create policy "Allow public read access to markets" on public.markets for select using (true);

-- 3. Liquidity Pools Table (LMSR)
create table if not exists public.liquidity_pools (
  market_id uuid primary key references public.markets(id) on delete cascade,
  shares numeric[] not null, -- Outstanding shares vector
  b numeric not null default 200.00, -- LMSR liquidity parameter
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
  shares numeric[] not null, -- Shares owned for each outcome index
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
  outcome_index integer, -- null for creation / resolution
  type text not null check (type in ('buy', 'sell', 'resolve_claim', 'create_market')),
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
-- LMSR PRICING ENGINE PL/PGSQL UTILITIES
-- ==========================================

-- Cost Function: C(q) = b * ln( sum( exp(qi / b) ) )
create or replace function public.lmsr_cost(p_shares numeric[], p_b numeric)
returns numeric as $$
declare
  v_max numeric := -9999999999;
  v_sum numeric := 0;
  v_qi numeric;
begin
  -- Find max element in shares array to implement Log-Sum-Exp scaling
  foreach v_qi in array p_shares loop
    if v_qi > v_max then
      v_max := v_qi;
    end if;
  end loop;

  -- Sum exp((qi - max) / b)
  foreach v_qi in array p_shares loop
    v_sum := v_sum + exp((v_qi - v_max) / p_b);
  end loop;

  return v_max + p_b * ln(v_sum);
end;
$$ language plpgsql immutable;

-- Prices Function: Returns probability (0 to 1) for each outcome
create or replace function public.lmsr_prices(p_shares numeric[], p_b numeric)
returns numeric[] as $$
declare
  v_max numeric := -9999999999;
  v_sum numeric := 0;
  v_qi numeric;
  v_prices numeric[];
  v_val numeric;
begin
  -- Find max
  foreach v_qi in array p_shares loop
    if v_qi > v_max then
      v_max := v_qi;
    end if;
  end loop;

  -- Sum exp((qi - max) / b)
  foreach v_qi in array p_shares loop
    v_sum := v_sum + exp((v_qi - v_max) / p_b);
  end loop;

  -- Construct prices array
  foreach v_qi in array p_shares loop
    v_val := exp((v_qi - v_max) / p_b) / v_sum;
    v_prices := array_append(v_prices, v_val);
  end loop;

  return v_prices;
end;
$$ language plpgsql immutable;


-- ==========================================
-- TRANSACTIONAL RPC FUNCTIONS
-- ==========================================

-- 1. Create Market Function
create or replace function public.create_market_rpc(
  p_question text,
  p_description text,
  p_resolution_date timestamp with time zone,
  p_creator_id uuid,
  p_image_url text default null,
  p_tagged_users text[] default null,
  p_outcomes text[] default array['YES', 'NO'],
  p_b numeric default 200.00
)
returns uuid as $$
declare
  v_market_id uuid;
  v_n integer;
  v_initial_shares numeric[];
  v_subsidy numeric;
  v_i integer;
begin
  v_n := cardinality(p_outcomes);
  if v_n < 2 then
    raise exception 'Market must have at least 2 outcomes';
  end if;

  -- In LMSR, the creator subsidizes the market
  -- Initial cost of the pool is b * ln(N)
  v_subsidy := p_b * ln(v_n);

  -- Check creator balance
  if not exists (select 1 from public.users where id = p_creator_id and balance >= v_subsidy for update) then
    raise exception 'Insufficient balance to inject initial liquidity (% Tokens required)', round(v_subsidy, 2);
  end if;

  -- Deduct balance
  update public.users
  set balance = balance - v_subsidy
  where id = p_creator_id;

  -- Insert market
  insert into public.markets (question, description, resolution_date, creator_id, image_url, tagged_users, outcomes)
  values (p_question, p_description, p_resolution_date, p_creator_id, p_image_url, p_tagged_users, p_outcomes)
  returning id into v_market_id;

  -- Initialize shares array to 0.00 for all N outcomes
  for v_i in 1..v_n loop
    v_initial_shares := array_append(v_initial_shares, 0.0000);
  end loop;

  -- Insert liquidity pool
  insert into public.liquidity_pools (market_id, shares, b)
  values (v_market_id, v_initial_shares, p_b);

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
  values (p_creator_id, v_market_id, 'create_market', v_subsidy, 0.0000, 0.00);

  return v_market_id;
end;
$$ language plpgsql security definer;

-- 2. Place Bet Function (Buy Shares)
create or replace function public.place_bet_rpc(
  p_user_id uuid,
  p_market_id uuid,
  p_outcome_index integer, -- 0-based index
  p_wager numeric
)
returns numeric as $$
declare
  v_creator_id uuid;
  v_shares numeric[];
  v_b numeric;
  v_fee numeric;
  v_net numeric;
  v_current_cost numeric;
  v_target_cost numeric;
  v_max_q numeric := -9999999999;
  v_sum_exp_others numeric := 0;
  v_qk numeric;
  v_term_inside numeric;
  v_new_qi numeric;
  v_bought_shares numeric;
  v_new_shares numeric[];
  v_i integer;
  v_n integer;
  v_user_shares numeric[];
  v_pos_id uuid;
begin
  -- Lock liquidity pool row
  select shares, b into v_shares, v_b
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  if not found then
    raise exception 'Liquidity pool not found';
  end if;

  v_n := cardinality(v_shares);
  if p_outcome_index < 0 or p_outcome_index >= v_n then
    raise exception 'Invalid outcome index % (cardinality is %)', p_outcome_index, v_n;
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

  v_current_cost := public.lmsr_cost(v_shares, v_b);
  v_target_cost := v_current_cost + v_net;

  -- Find max element in shares array
  foreach v_qk in array v_shares loop
    if v_qk > v_max_q then
      v_max_q := v_qk;
    end if;
  end loop;

  -- Sum exp((qk - max_q) / b) for others
  for v_i in 1..v_n loop
    if (v_i - 1) != p_outcome_index then
      v_sum_exp_others := v_sum_exp_others + exp((v_shares[v_i] - v_max_q) / v_b);
    end if;
  end loop;

  -- Solve for new_qi
  -- term = exp((target_cost - max_q)/b) - sum_exp_others
  v_term_inside := exp((v_target_cost - v_max_q) / v_b) - v_sum_exp_others;

  if v_term_inside <= 0 then
    raise exception 'Math error: Insufficient pool liquidity for this bet size';
  end if;

  v_new_qi := v_max_q + v_b * ln(v_term_inside);
  v_bought_shares := v_new_qi - v_shares[p_outcome_index + 1];

  -- Update pool shares array
  v_new_shares := v_shares;
  v_new_shares[p_outcome_index + 1] := v_new_qi;

  -- Deduct user balance
  update public.users set balance = balance - p_wager where id = p_user_id;

  -- Add fee to creator balance
  update public.users set balance = balance + v_fee where id = v_creator_id;

  -- Update pool
  update public.liquidity_pools
  set shares = v_new_shares, updated_at = now()
  where market_id = p_market_id;

  -- Update/Insert user position
  select id, shares into v_pos_id, v_user_shares
  from public.user_positions
  where user_id = p_user_id and market_id = p_market_id
  for update;

  if not found then
    -- Initialize user shares array to 0.00 for all N outcomes
    for v_i in 1..v_n loop
      v_user_shares := array_append(v_user_shares, 0.0000);
    end loop;
    v_user_shares[p_outcome_index + 1] := v_bought_shares;

    insert into public.user_positions (user_id, market_id, shares)
    values (p_user_id, p_market_id, v_user_shares);
  else
    v_user_shares[p_outcome_index + 1] := v_user_shares[p_outcome_index + 1] + v_bought_shares;

    update public.user_positions
    set shares = v_user_shares
    where id = v_pos_id;
  end if;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, outcome_index, amount_tokens, amount_shares, fee_tokens)
  values (p_user_id, p_market_id, 'buy', p_outcome_index, p_wager, v_bought_shares, v_fee);

  return v_bought_shares;
end;
$$ language plpgsql security definer;

-- 3. Sell Bet Function (Sell Shares)
create or replace function public.sell_bet_rpc(
  p_user_id uuid,
  p_market_id uuid,
  p_outcome_index integer,
  p_shares numeric
)
returns numeric as $$
declare
  v_creator_id uuid;
  v_shares numeric[];
  v_b numeric;
  v_user_shares numeric[];
  v_pos_id uuid;
  v_n integer;
  v_current_cost numeric;
  v_new_shares numeric[];
  v_target_cost numeric;
  v_gross_tokens numeric;
  v_fee numeric;
  v_net_tokens numeric;
begin
  -- Lock liquidity pool row
  select shares, b into v_shares, v_b
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  if not found then
    raise exception 'Liquidity pool not found';
  end if;

  v_n := cardinality(v_shares);
  if p_outcome_index < 0 or p_outcome_index >= v_n then
    raise exception 'Invalid outcome index';
  end if;

  -- Lock user position
  select id, shares into v_pos_id, v_user_shares
  from public.user_positions
  where user_id = p_user_id and market_id = p_market_id
  for update;

  if not found or v_user_shares[p_outcome_index + 1] < p_shares then
    raise exception 'Insufficient shares in user position';
  end if;

  -- Get market creator
  select creator_id into v_creator_id from public.markets where id = p_market_id;

  -- Compute sell math
  v_current_cost := public.lmsr_cost(v_shares, v_b);
  
  v_new_shares := v_shares;
  v_new_shares[p_outcome_index + 1] := v_shares[p_outcome_index + 1] - p_shares;
  
  v_target_cost := public.lmsr_cost(v_new_shares, v_b);
  v_gross_tokens := v_current_cost - v_target_cost;

  if v_gross_tokens <= 0 then
    raise exception 'Math error: negative tokens returned';
  end if;

  v_fee := v_gross_tokens * 0.02;
  v_net_tokens := v_gross_tokens - v_fee;

  -- Deduct user shares
  v_user_shares[p_outcome_index + 1] := v_user_shares[p_outcome_index + 1] - p_shares;
  update public.user_positions
  set shares = v_user_shares
  where id = v_pos_id;

  -- Add net tokens to user balance
  update public.users set balance = balance + v_net_tokens where id = p_user_id;

  -- Add fee to creator balance
  update public.users set balance = balance + v_fee where id = v_creator_id;

  -- Update pool
  update public.liquidity_pools
  set shares = v_new_shares, updated_at = now()
  where market_id = p_market_id;

  -- Log transaction
  insert into public.transactions (user_id, market_id, type, outcome_index, amount_tokens, amount_shares, fee_tokens)
  values (p_user_id, p_market_id, 'sell', p_outcome_index, v_net_tokens, p_shares, v_fee);

  return v_net_tokens;
end;
$$ language plpgsql security definer;

-- 4. Resolve Market Function
create or replace function public.resolve_market_rpc(
  p_market_id uuid,
  p_outcome text, -- Name of the winning outcome option (e.g. 'YES' or 'Bob')
  p_admin_id uuid
)
returns void as $$
declare
  v_creator_id uuid;
  v_status text;
  v_outcomes text[];
  v_outcome_index integer := -1;
  v_shares numeric[];
  v_b numeric;
  v_final_cost numeric;
  v_q_win numeric;
  v_refund numeric;
  v_i integer;
  v_new_shares numeric[];
begin
  -- Lock market
  select creator_id, status, outcomes into v_creator_id, v_status, v_outcomes
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

  -- Find the index of the outcome name
  for v_i in 1..cardinality(v_outcomes) loop
    if lower(v_outcomes[v_i]) = lower(p_outcome) then
      v_outcome_index := v_i - 1;
      exit;
    end if;
  end loop;

  if v_outcome_index = -1 then
    raise exception 'Winning outcome must match one of the market options';
  end if;

  -- Lock liquidity pool to payout remaining LP tokens
  select shares, b into v_shares, v_b
  from public.liquidity_pools
  where market_id = p_market_id
  for update;

  -- Creator's refund is C(q) - q_win
  v_final_cost := public.lmsr_cost(v_shares, v_b);
  v_q_win := v_shares[v_outcome_index + 1];
  v_refund := v_final_cost - v_q_win;

  -- Update market outcome and status
  update public.markets
  set status = 'resolved', outcome = p_outcome
  where id = p_market_id;

  -- Return remaining pool value (collateral surplus) to creator
  if v_refund > 0 then
    update public.users
    set balance = balance + v_refund
    where id = v_creator_id;
  end if;

  -- Deplete liquidity pool shares to 0.00
  for v_i in 1..cardinality(v_shares) loop
    v_new_shares := array_append(v_new_shares, 0.0000);
  end loop;
  
  update public.liquidity_pools
  set shares = v_new_shares, updated_at = now()
  where market_id = p_market_id;

  -- Log transaction
  if v_refund > 0 then
    insert into public.transactions (user_id, market_id, type, amount_tokens, amount_shares, fee_tokens)
    values (v_creator_id, p_market_id, 'resolve_claim', v_refund, v_refund, 0);
  end if;
end;
$$ language plpgsql security definer;

-- 5. Claim Payout Function
create or replace function public.claim_payout_rpc(
  p_user_id uuid,
  p_market_id uuid
)
returns numeric as $$
declare
  v_status text;
  v_outcome text;
  v_outcomes text[];
  v_outcome_index integer := -1;
  v_user_shares numeric[];
  v_payout numeric := 0;
  v_pos_id uuid;
  v_i integer;
  v_new_user_shares numeric[];
begin
  -- Check market status
  select status, outcome, outcomes into v_status, v_outcome, v_outcomes
  from public.markets
  where id = p_market_id;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_status != 'resolved' then
    raise exception 'Market is not resolved yet';
  end if;

  -- Find index of winning outcome
  for v_i in 1..cardinality(v_outcomes) loop
    if lower(v_outcomes[v_i]) = lower(v_outcome) then
      v_outcome_index := v_i - 1;
      exit;
    end if;
  end loop;

  if v_outcome_index = -1 then
    raise exception 'Outcome not found in market options';
  end if;

  -- Lock user position
  select id, shares into v_pos_id, v_user_shares
  from public.user_positions
  where user_id = p_user_id and market_id = p_market_id
  for update;

  if not found then
    raise exception 'No position to claim';
  end if;

  -- Calculate payout
  v_payout := v_user_shares[v_outcome_index + 1];

  -- Reset all user shares in this position to 0
  for v_i in 1..cardinality(v_user_shares) loop
    v_new_user_shares := array_append(v_new_user_shares, 0.0000);
  end loop;

  update public.user_positions
  set shares = v_new_user_shares
  where id = v_pos_id;

  if v_payout <= 0 then
    return 0;
  end if;

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
