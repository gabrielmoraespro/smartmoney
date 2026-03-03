-- ============================================================
-- SmartMoney — Schema SQL para Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================== TABELAS =====================

CREATE TABLE public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  full_name           TEXT,
  stripe_customer_id  TEXT UNIQUE,
  plan_status         TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_status IN ('free', 'pro', 'pro_annual', 'canceled')),
  plan_expires_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.accounts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name           TEXT NOT NULL,
  type                TEXT NOT NULL DEFAULT 'checking'
    CHECK (type IN ('checking', 'savings', 'credit', 'investment')),
  balance             NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'BRL',
  pluggy_item_id      TEXT,
  pluggy_account_id   TEXT UNIQUE,
  last_synced_at      TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id            UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description           TEXT NOT NULL,
  amount                NUMERIC(15,2) NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'debit'
    CHECK (type IN ('debit', 'credit')),
  category              TEXT,
  category_id           TEXT,
  date                  DATE NOT NULL,
  balance_after         NUMERIC(15,2),
  currency              TEXT NOT NULL DEFAULT 'BRL',
  payment_method        TEXT,
  pluggy_transaction_id TEXT UNIQUE,  -- chave de idempotência para upsert
  is_manual             BOOLEAN NOT NULL DEFAULT FALSE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.pluggy_connections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pluggy_item_id  TEXT NOT NULL UNIQUE,
  connector_name  TEXT,
  connector_id    INTEGER,
  status          TEXT NOT NULL DEFAULT 'UPDATED'
    CHECK (status IN ('UPDATED','UPDATING','WAITING_USER_INPUT','LOGIN_ERROR','OUTDATED')),
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== INDEXES =====================
CREATE INDEX idx_accounts_user_id       ON public.accounts(user_id);
CREATE INDEX idx_transactions_user_id   ON public.transactions(user_id);
CREATE INDEX idx_transactions_account   ON public.transactions(account_id);
CREATE INDEX idx_transactions_date      ON public.transactions(date DESC);
CREATE INDEX idx_transactions_category  ON public.transactions(category);

-- ===================== TRIGGERS =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_upd    BEFORE UPDATE ON public.profiles    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_upd    BEFORE UPDATE ON public.accounts    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_transactions_upd BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-cria profile no signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===================== ROW LEVEL SECURITY =====================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pluggy_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: self read"            ON public.profiles    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: self update"          ON public.profiles    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "accounts: owner all"            ON public.accounts    FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "transactions: owner all"        ON public.transactions FOR ALL   USING (auth.uid() = user_id);
CREATE POLICY "pluggy_connections: owner all"  ON public.pluggy_connections FOR ALL USING (auth.uid() = user_id);

-- ===================== VIEW DASHBOARD =====================
CREATE OR REPLACE VIEW public.v_monthly_summary AS
SELECT
  t.user_id,
  DATE_TRUNC('month', t.date) AS month,
  t.category,
  COUNT(*)                     AS transaction_count,
  SUM(CASE WHEN t.type = 'credit' THEN t.amount     ELSE 0 END) AS total_income,
  SUM(CASE WHEN t.type = 'debit'  THEN ABS(t.amount) ELSE 0 END) AS total_expenses
FROM public.transactions t
GROUP BY t.user_id, DATE_TRUNC('month', t.date), t.category;
