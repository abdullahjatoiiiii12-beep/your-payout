-- =========================================================================
-- YourPayouts - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase Dashboard -> SQL Editor -> Run
-- This creates all required tables, foreign keys, indexes, and RLS policies.
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. Payout Batches Table (پے آؤٹ بیجز)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  at TIMESTAMPTZ DEFAULT NOW(),
  files JSONB DEFAULT '[]'::jsonb,
  imported INTEGER DEFAULT 0,
  duplicates INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 2. Payouts Table (تمام پے آؤٹ ریکارڈز)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  batch_id UUID REFERENCES public.payout_batches(id) ON DELETE SET NULL,
  order_id TEXT NOT NULL,
  date TEXT,
  source_file TEXT,
  item_description TEXT,
  quantity NUMERIC DEFAULT 1,
  packages NUMERIC DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  gross_amount NUMERIC(12,2) DEFAULT 0,
  fee_amount NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) DEFAULT 0,
  gbp_amount NUMERIC(12,2) DEFAULT 0,
  vendor_base_price NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total_base_price NUMERIC(12,2) DEFAULT 0,
  commission NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'GBP',
  dup_key TEXT,
  is_duplicate BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  payout_uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  payout_processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB DEFAULT '{}'::jsonb
);

-- Indexes for lightning-fast search and matching
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON public.payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON public.payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user_order ON public.payouts(user_id, order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_dup_key ON public.payouts(dup_key);
CREATE INDEX IF NOT EXISTS idx_payouts_date ON public.payouts(date);
CREATE INDEX IF NOT EXISTS idx_payouts_batch_id ON public.payouts(batch_id);

-- Ensure organization namespace exists for multi-user / team collaboration
ALTER TABLE public.payout_batches ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'default';
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_payouts_org_id ON public.payouts(organization_id);

-- -------------------------------------------------------------------------
-- 3. Shipment Batches Table (شپمنٹ بیجز)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipment_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  at TIMESTAMPTZ DEFAULT NOW(),
  files JSONB DEFAULT '[]'::jsonb,
  total_records INTEGER DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 4. Shipments Table (شپمنٹس ریکارڈز)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.shipment_batches(id) ON DELETE SET NULL,
  order_id TEXT NOT NULL,
  tracking_number TEXT,
  carrier TEXT,
  status TEXT DEFAULT 'In Transit',
  ship_date TEXT,
  delivery_date TEXT,
  weight_kg NUMERIC(10,3) DEFAULT 0,
  packages NUMERIC DEFAULT 1,
  quantity NUMERIC DEFAULT 1,
  declared_value NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  destination_country TEXT,
  supplier TEXT,
  source_file TEXT,
  customer_name TEXT,
  payout_matched BOOLEAN DEFAULT FALSE,
  payout_matched_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB DEFAULT '{}'::jsonb
);

-- Indexes for shipments
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON public.shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_user_order ON public.shipments(user_id, order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_payout_id ON public.shipments(payout_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON public.shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON public.shipments(carrier);
CREATE INDEX IF NOT EXISTS idx_shipments_payout_matched ON public.shipments(payout_matched);

-- Ensure organization namespace exists for multi-user / team collaboration
ALTER TABLE public.shipment_batches ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'default';
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_shipments_org_id ON public.shipments(organization_id);

-- -------------------------------------------------------------------------
-- 5. Application Settings Table (Shared Team Settings)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avg_rate NUMERIC DEFAULT 1.27,
  currency TEXT DEFAULT 'USD',
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  extra_settings JSONB DEFAULT '{}'::jsonb
);

-- Seed initial row safely using standard UUID format (works for both UUID and TEXT columns)
DO $$
BEGIN
  INSERT INTO public.app_settings (id, avg_rate, currency)
  VALUES ('00000000-0000-0000-0000-000000000001', 1.27, 'USD')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- In case table had existing rows or alternate type
  NULL;
END $$;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own settings" ON public.app_settings;
  DROP POLICY IF EXISTS "Shared access on app_settings" ON public.app_settings;
  DROP POLICY IF EXISTS "Allow all on app_settings" ON public.app_settings;
  DROP POLICY IF EXISTS "Organization shared access on app_settings" ON public.app_settings;
  CREATE POLICY "Organization shared access on app_settings"
    ON public.app_settings FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);
END $$;

-- -------------------------------------------------------------------------
-- 6. Dashboard Metrics & Analytics Cache Table (Shared Organization Data)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  updated_by UUID,
  period TEXT NOT NULL DEFAULT '30d',
  currency TEXT NOT NULL DEFAULT 'USD',
  shipment_range TEXT NOT NULL DEFAULT '12d',
  total_revenue NUMERIC(14,2) DEFAULT 0,
  total_net NUMERIC(14,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  growth_rate NUMERIC(6,2) DEFAULT 0,
  payout_chart JSONB DEFAULT '[]'::jsonb,
  total_shipments INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  in_transit_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  total_weight_kg NUMERIC(10,3) DEFAULT 0,
  total_shipping_cost NUMERIC(14,2) DEFAULT 0,
  delivery_rate NUMERIC(6,2) DEFAULT 0,
  shipment_chart JSONB DEFAULT '[]'::jsonb,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial row safely using standard UUID format (works for both UUID and TEXT columns)
DO $$
BEGIN
  INSERT INTO public.dashboard_metrics (id)
  VALUES ('00000000-0000-0000-0000-000000000002')
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- Catch any conflict safely
  NULL;
END $$;

ALTER TABLE public.dashboard_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Shared access on dashboard_metrics" ON public.dashboard_metrics;
  DROP POLICY IF EXISTS "Allow all on dashboard_metrics" ON public.dashboard_metrics;
  DROP POLICY IF EXISTS "Organization shared access on dashboard_metrics" ON public.dashboard_metrics;
  CREATE POLICY "Organization shared access on dashboard_metrics"
    ON public.dashboard_metrics FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);
END $$;

-- -------------------------------------------------------------------------
-- 7. Row Level Security (RLS) - SHARED ORGANIZATION & PROJECT ACCESS
-- تمام لاگ ان صارفین کے لیے ڈیٹا شیئرنگ (ہر صارف ڈیٹا دیکھ اور اپڈیٹ کر سکتا ہے)
-- -------------------------------------------------------------------------
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 1. Payouts Policies (Shared across all authenticated team members & anon)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own payouts" ON public.payouts;
  DROP POLICY IF EXISTS "Users can insert own payouts" ON public.payouts;
  DROP POLICY IF EXISTS "Users can update own payouts" ON public.payouts;
  DROP POLICY IF EXISTS "Users can delete own payouts" ON public.payouts;
  DROP POLICY IF EXISTS "Shared access on payouts" ON public.payouts;
  DROP POLICY IF EXISTS "Allow all on payouts" ON public.payouts;
  DROP POLICY IF EXISTS "Organization shared access on payouts" ON public.payouts;
  CREATE POLICY "Organization shared access on payouts"
    ON public.payouts FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);
END $$;

-- 2. Shipments Policies (Shared across all authenticated team members & anon)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own shipments" ON public.shipments;
  DROP POLICY IF EXISTS "Users can insert own shipments" ON public.shipments;
  DROP POLICY IF EXISTS "Users can update own shipments" ON public.shipments;
  DROP POLICY IF EXISTS "Users can delete own shipments" ON public.shipments;
  DROP POLICY IF EXISTS "Shared access on shipments" ON public.shipments;
  DROP POLICY IF EXISTS "Allow all on shipments" ON public.shipments;
  DROP POLICY IF EXISTS "Organization shared access on shipments" ON public.shipments;
  CREATE POLICY "Organization shared access on shipments"
    ON public.shipments FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);
END $$;

-- 3. Payout Batches Policies (Shared)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own payout batches" ON public.payout_batches;
  DROP POLICY IF EXISTS "Shared access on payout_batches" ON public.payout_batches;
  DROP POLICY IF EXISTS "Allow all on payout_batches" ON public.payout_batches;
  DROP POLICY IF EXISTS "Organization shared access on payout_batches" ON public.payout_batches;
  CREATE POLICY "Organization shared access on payout_batches"
    ON public.payout_batches FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);
END $$;

-- 4. Shipment Batches Policies (Shared)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own shipment batches" ON public.shipment_batches;
  DROP POLICY IF EXISTS "Shared access on shipment_batches" ON public.shipment_batches;
  DROP POLICY IF EXISTS "Allow all on shipment_batches" ON public.shipment_batches;
  DROP POLICY IF EXISTS "Organization shared access on shipment_batches" ON public.shipment_batches;
  CREATE POLICY "Organization shared access on shipment_batches"
    ON public.shipment_batches FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);
END $$;

-- -------------------------------------------------------------------------
-- 8. Helper RPC function to check table status
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_tables_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'payouts', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payouts'),
    'payout_batches', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout_batches'),
    'shipments', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments'),
    'shipment_batches', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_batches'),
    'app_settings', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings'),
    'dashboard_metrics', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dashboard_metrics'),
    'mode', 'shared_team_collaboration',
    'status', 'ready',
    'timestamp', NOW()
  );
END;
$$;
