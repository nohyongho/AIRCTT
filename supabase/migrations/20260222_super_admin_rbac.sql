-- =============================================================
-- AIRCTT Super Admin RBAC & Platform Policy Migration
-- Date: 2026-02-22
-- Purpose: RBAC 역할 시스템, 정책 관리, 가맹점 승인, 정산
-- =============================================================

-- ▸ 1) user_roles 테이블 (RBAC)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MERCHANT', 'USER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT,
    role public.user_role NOT NULL DEFAULT 'USER',
    granted_by UUID,
    granted_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, role)
  );

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON public.user_roles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role) WHERE is_active = true;

-- 기본 슈퍼어드민 등록 (zeus1404@gmail.com)
INSERT INTO public.user_roles (user_id, email, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'zeus1404@gmail.com', 'SUPER_ADMIN')
ON CONFLICT (user_id, role) DO NOTHING;

-- ▸ 2) platform_settings 테이블 (정책 관리)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INTEGER NOT NULL DEFAULT 1,
    coupon_unit_price NUMERIC NOT NULL DEFAULT 100,
    market_fee_rate NUMERIC NOT NULL DEFAULT 10,
    default_radius_km NUMERIC NOT NULL DEFAULT 5,
    payment_mode TEXT NOT NULL DEFAULT 'demo' CHECK (payment_mode IN ('demo', 'live')),
    min_settlement_amount NUMERIC DEFAULT 1000,
    settlement_cycle TEXT DEFAULT 'monthly' CHECK (settlement_cycle IN ('weekly', 'monthly')),
    effective_from TIMESTAMPTZ DEFAULT now(),
    is_current BOOLEAN DEFAULT true,
    created_by UUID,
    created_by_email TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS idx_platform_settings_current ON public.platform_settings(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_platform_settings_version ON public.platform_settings(version DESC);

-- 기본 정책 삽입
INSERT INTO public.platform_settings (version, coupon_unit_price, market_fee_rate, default_radius_km, payment_mode, created_by_email, reason)
VALUES (1, 100, 10, 5, 'demo', 'zeus1404@gmail.com', '초기 정책 설정')
ON CONFLICT DO NOTHING;

-- ▸ 3) policy_change_logs 테이블 (정책 변경 로그)
CREATE TABLE IF NOT EXISTS public.policy_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_id UUID REFERENCES public.platform_settings(id),
    changed_by UUID,
    changed_by_email TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS idx_policy_logs_setting ON public.policy_change_logs(setting_id);
CREATE INDEX IF NOT EXISTS idx_policy_logs_date ON public.policy_change_logs(created_at DESC);

-- ▸ 4) merchant_status ENUM 및 merchants 확장
DO $$ BEGIN
  CREATE TYPE public.merchant_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ▸ 5) audit_logs 테이블 (전체 감사 로그)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);

-- ▸ 6) settlements 테이블 확장 (기존 테이블이 있으면 컬럼 추가)
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS settlement_cycle TEXT DEFAULT 'monthly';
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS platform_fee_rate NUMERIC DEFAULT 10;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 0;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS merchant_id UUID;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS notes TEXT;

-- ▸ 7) RLS 정책
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS user_roles_select ON public.user_roles FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS user_roles_admin_insert ON public.user_roles FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS user_roles_admin_update ON public.user_roles FOR UPDATE USING (true);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS platform_settings_select ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS platform_settings_insert ON public.platform_settings FOR INSERT WITH CHECK (true);

ALTER TABLE public.policy_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS policy_change_logs_select ON public.policy_change_logs FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS policy_change_logs_insert ON public.policy_change_logs FOR INSERT WITH CHECK (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS audit_logs_select ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS audit_logs_insert ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ▸ 8) 정책 조회 함수 (현재 활성 정책)
CREATE OR REPLACE FUNCTION public.get_current_settings()
RETURNS public.platform_settings AS $$
  SELECT * FROM public.platform_settings
  WHERE is_current = true
  ORDER BY version DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ▸ 9) 쿠폰 단가를 100원으로 업데이트
UPDATE public.coupons SET unit_price = 100 WHERE unit_price = 50;

-- =========================================================
-- 완료
-- =========================================================
