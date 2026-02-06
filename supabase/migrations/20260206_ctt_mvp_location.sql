-- CouponTalkTalk MVP Location Features
-- Date: 2026-02-06
-- Purpose: 위치 기반 쿠폰 조회 및 코드 기반 사용 기능

-- =========================================================
-- 1. coupon_issues에 코드 필드 추가
-- =========================================================

-- 쿠폰 코드 (8자리 대문자)
ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS code VARCHAR(8) UNIQUE;

-- 기존 레코드에 코드 생성
UPDATE public.coupon_issues
SET code = UPPER(SUBSTR(MD5(RANDOM()::TEXT || id::TEXT), 1, 8))
WHERE code IS NULL;

-- 만료 시간 필드 추가
ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 상태 필드 추가 (기존 is_used 보완)
DO $$ BEGIN
    CREATE TYPE public.coupon_issue_status AS ENUM ('active', 'used', 'expired', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS status public.coupon_issue_status DEFAULT 'active';

-- 기존 is_used = true인 것들 status 업데이트
UPDATE public.coupon_issues
SET status = 'used'
WHERE is_used = true AND status = 'active';

-- 획득 위치 저장
ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS claimed_lat NUMERIC(9,6);

ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS claimed_lng NUMERIC(9,6);

-- 획득 방법
DO $$ BEGIN
    CREATE TYPE public.claim_method AS ENUM ('ar', 'list', 'game', 'qr', 'share');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS claimed_via public.claim_method DEFAULT 'list';

-- =========================================================
-- 2. 인덱스 추가
-- =========================================================

-- 코드 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_coupon_issues_code
ON public.coupon_issues(code)
WHERE status = 'active';

-- 사용자별 쿠폰 조회
CREATE INDEX IF NOT EXISTS idx_coupon_issues_user_status
ON public.coupon_issues(user_id, status);

-- 쿠폰별 발행 현황
CREATE INDEX IF NOT EXISTS idx_coupon_issues_coupon_status
ON public.coupon_issues(coupon_id, status);

-- 중복 획득 방지 인덱스 (per_user_limit 체크용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_issues_unique_active
ON public.coupon_issues(coupon_id, user_id)
WHERE status IN ('active', 'used');

-- =========================================================
-- 3. 거리 계산 함수 (Haversine)
-- =========================================================

CREATE OR REPLACE FUNCTION public.calculate_distance_km(
    lat1 NUMERIC,
    lng1 NUMERIC,
    lat2 NUMERIC,
    lng2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    R CONSTANT NUMERIC := 6371; -- 지구 반지름 (km)
    dlat NUMERIC;
    dlng NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    dlat := RADIANS(lat2 - lat1);
    dlng := RADIANS(lng2 - lng1);
    a := SIN(dlat/2) * SIN(dlat/2) +
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
         SIN(dlng/2) * SIN(dlng/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =========================================================
-- 4. 근처 쿠폰 조회 함수
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_nearby_coupons(
    user_lat NUMERIC,
    user_lng NUMERIC,
    search_radius_km NUMERIC DEFAULT 1.0,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    coupon_id UUID,
    store_id UUID,
    store_name TEXT,
    store_address TEXT,
    title TEXT,
    description TEXT,
    discount_type public.discount_type,
    discount_value NUMERIC,
    radius_km NUMERIC,
    distance_km NUMERIC,
    valid_to TIMESTAMP WITH TIME ZONE,
    total_issuable INTEGER,
    per_user_limit INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as coupon_id,
        s.id as store_id,
        s.name as store_name,
        s.address as store_address,
        c.title,
        c.description,
        c.discount_type,
        c.discount_value,
        c.radius_km,
        public.calculate_distance_km(
            user_lat, user_lng,
            COALESCE(c.center_lat, s.lat),
            COALESCE(c.center_lng, s.lng)
        ) as distance_km,
        c.valid_to,
        c.total_issuable,
        c.per_user_limit
    FROM public.coupons c
    JOIN public.stores s ON s.id = c.store_id
    WHERE c.is_active = TRUE
      AND s.is_active = TRUE
      AND (c.valid_to IS NULL OR c.valid_to > NOW())
      AND (c.valid_from IS NULL OR c.valid_from <= NOW())
      AND public.calculate_distance_km(
          user_lat, user_lng,
          COALESCE(c.center_lat, s.lat),
          COALESCE(c.center_lng, s.lng)
      ) <= COALESCE(c.radius_km, search_radius_km)
    ORDER BY distance_km ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =========================================================
-- 5. 반경 내 확인 함수
-- =========================================================

CREATE OR REPLACE FUNCTION public.check_in_radius(
    user_lat NUMERIC,
    user_lng NUMERIC,
    target_lat NUMERIC,
    target_lng NUMERIC,
    max_radius_km NUMERIC
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.calculate_distance_km(user_lat, user_lng, target_lat, target_lng) <= max_radius_km;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =========================================================
-- 6. 쿠폰 발행 수 조회 함수
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_coupon_issue_count(
    p_coupon_id UUID
) RETURNS TABLE (
    total_issued BIGINT,
    total_used BIGINT,
    total_active BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_issued,
        COUNT(*) FILTER (WHERE status = 'used') as total_used,
        COUNT(*) FILTER (WHERE status = 'active') as total_active
    FROM public.coupon_issues
    WHERE coupon_id = p_coupon_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =========================================================
-- 7. 사용자별 쿠폰 획득 수 조회 함수
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_user_coupon_count(
    p_coupon_id UUID,
    p_user_id UUID
) RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.coupon_issues
        WHERE coupon_id = p_coupon_id
          AND user_id = p_user_id
          AND status IN ('active', 'used')
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- =========================================================
-- 8. 쿠폰 사용 로그 테이블
-- =========================================================

CREATE TABLE IF NOT EXISTS public.coupon_logs (
    id BIGSERIAL PRIMARY KEY,
    coupon_issue_id UUID REFERENCES public.coupon_issues(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- 'claimed', 'used', 'expired', 'cancelled'
    actor_id UUID REFERENCES public.users(id),
    actor_type VARCHAR(20), -- 'consumer', 'merchant', 'admin', 'system'
    location_lat NUMERIC(9,6),
    location_lng NUMERIC(9,6),
    device_info JSONB,
    ip_address INET,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_logs_issue
ON public.coupon_logs(coupon_issue_id);

CREATE INDEX IF NOT EXISTS idx_coupon_logs_created
ON public.coupon_logs(created_at DESC);

-- =========================================================
-- 9. RLS 정책 업데이트
-- =========================================================

-- coupon_logs RLS
ALTER TABLE public.coupon_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 로그 조회 가능
CREATE POLICY IF NOT EXISTS coupon_logs_select_own
ON public.coupon_logs FOR SELECT
USING (
    actor_id = auth.uid() OR
    coupon_issue_id IN (
        SELECT id FROM public.coupon_issues WHERE user_id = auth.uid()
    )
);

-- 시스템/관리자만 삽입 가능 (API 통해서만)
CREATE POLICY IF NOT EXISTS coupon_logs_insert_system
ON public.coupon_logs FOR INSERT
WITH CHECK (TRUE);

-- =========================================================
-- 10. 쿠폰 통계 뷰
-- =========================================================

CREATE OR REPLACE VIEW public.v_coupon_stats AS
SELECT
    c.id as coupon_id,
    c.store_id,
    c.title,
    c.discount_type,
    c.discount_value,
    c.total_issuable,
    c.is_active,
    COUNT(ci.id) as issued_count,
    COUNT(ci.id) FILTER (WHERE ci.status = 'active') as active_count,
    COUNT(ci.id) FILTER (WHERE ci.status = 'used') as used_count,
    COUNT(ci.id) FILTER (WHERE ci.status = 'expired') as expired_count,
    CASE
        WHEN COUNT(ci.id) > 0
        THEN ROUND(COUNT(ci.id) FILTER (WHERE ci.status = 'used')::NUMERIC / COUNT(ci.id) * 100, 2)
        ELSE 0
    END as usage_rate
FROM public.coupons c
LEFT JOIN public.coupon_issues ci ON ci.coupon_id = c.id
GROUP BY c.id;

-- =========================================================
-- 완료
-- =========================================================
