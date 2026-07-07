-- =====================================================================
-- MeiNu — начальная схема БД (users, orders, inquiries).
-- Идемпотентная: можно запускать повторно, ничего не сломает.
--
-- Применить:
--   sudo -u postgres psql meinu -f init-db.sql
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('private', 'business');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'shipping', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE inquiry_status AS ENUM ('new', 'in_progress', 'answered', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type user_type NOT NULL DEFAULT 'private',
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    password_hash text NOT NULL,
    org_name text,
    inn text,
    kpp text,
    ogrn text,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id text PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'new',
    city text NOT NULL,
    total integer NOT NULL,
    items jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inquiries (
    id text PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    status inquiry_status NOT NULL DEFAULT 'new',
    description text NOT NULL,
    quantity integer NOT NULL,
    budget_rub integer,
    photos_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
);
