-- AIRCTT Platform Coupon Policy Migration
-- Date: 2026-02-17
-- Purpose: 단일상품 정책(product_sku), 쿠폰그룹키, 크랙커 에셋, 승인 워크플로우, 선물하기

-- =========================================================
-- 1. coupons 테이블 확장 (상품/에셋/승인)
-- =========================================================

-- 단일상품 코드 (가맹점 직접 입력, 필수)
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100);

-- 쿠폰 그룹키 (store_id:product_sku, 자동 생성)
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS coupon_group_key VARCHAR(200);

-- 크랙커 에셋 타입
DO $$ BEGIN
    CREATE TYPE public.asset_type AS ENUM (
        'IMAGE_2D', 'MODEL_3D', 'VIDEO',
        'AR_EVENT', 'SMARTGLASS', 'AI_AVATAR_EVENT', 'AVATAR_SHOW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS asset_type public.asset_type DEFAULT 'IMAGE_2D';

-- 크랙커 에셋 URL
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS asset_url TEXT;

-- 승인 상태
DO $$ BEGIN
    CREATE TYPE public.approval_status AS ENUM (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS approval_status public.approval_status DEFAULT 'DRAFT';

-- 승인자/반려사유
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS approved_by UUID;

ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS approval_note TEXT;

ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 크랙커 단가 (원/장)
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 50;

-- =========================================================
-- 2. coupon_group_key 자동 생성 트리거
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_coupon_group_key()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.store_id IS NOT NULL AND NEW.product_sku IS NOT NULL THEN
        NEW.coupon_group_key := NEW.store_id || ':' || NEW.product_sku;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_coupon_group_key ON public.coupons;
CREATE TRIGGER trg_set_coupon_group_key
    BEFORE INSERT OR UPDATE OF store_id, product_sku
    ON public.coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_coupon_group_key();

-- 기존 coupons에 coupon_group_key 채우기
UPDATE public.coupons
SET coupon_group_key = store_id || ':' || COALESCE(product_sku, 'DEFAULT')
WHERE coupon_group_key IS NULL AND store_id IS NOT NULL;

-- =========================================================
-- 3. coupon_issues 테이블 확장 (그룹키/선물)
-- =========================================================

-- 쿠폰 그룹키 (중복 방지용)
ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS coupon_group_key VARCHAR(200);

-- 확장 쿠폰코드 (기존 8자리 code와 별도)
ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(20);

-- 선물하기 관련 필드
ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS gifted_from UUID;

ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS gifted_to UUID;

ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS gift_token VARCHAR(64);

ALTER TABLE public.coupon_issues
ADD COLUMN IF NOT EXISTS gift_expires_at TIMESTAMP WITH TIME ZONE;

-- =========================================================
-- 4. coupon_issues에 그룹키 UNIQUE 제약 (1인1장 정책)
-- =========================================================

-- 기존 중복 방지 인덱스는 coupon_id + user_id 기준
-- 새로 coupon_group_key + user_id 기준 추가 (단일상품 1인1장)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_issues_group_user_active
ON public.coupon_issues(user_id, coupon_group_key)
WHERE status = 'active' AND coupon_group_key IS NOT NULL;

-- 선물 토큰 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_issues_gift_token
ON public.coupon_issues(gift_token)
WHERE gift_token IS NOT NULL;

-- 쿠폰코드 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_issues_coupon_code
ON public.coupon_issues(coupon_code)
WHERE coupon_code IS NOT NULL;

-- =========================================================
-- 5. coupon_events 테이블 (이벤트 로그/정산용)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.coupon_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    store_id UUID,
    coupon_id UUID,
    coupon_issue_id UUID,
    event_type VARCHAR(20) NOT NULL CHECK (
        event_type IN (
            'ISSUED', 'APPROVED', 'REJECTED', 'SPAWNED',
            'ACQUIRED', 'CLICKED', 'REDEEMED',
            'GIFTED', 'GIFT_ACCEPTED', 'REPLACED', 'EXPIRED'
        )
    ),
    meta JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_events_coupon
ON public.coupon_events(coupon_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_events_user
ON public.coupon_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_events_store
ON public.coupon_events(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_events_type
ON public.coupon_events(event_type, created_at DESC);

-- RLS
ALTER TABLE public.coupon_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS coupon_events_select_own
ON public.coupon_events FOR SELECT
USING (user_id = auth.uid() OR store_id IN (
    SELECT id FROM public.stores WHERE merchant_id IN (
        SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
));

CREATE POLICY IF NOT EXISTS coupon_events_insert_any
ON public.coupon_events FOR INSERT
WITH CHECK (TRUE);

-- =========================================================
-- 6. settlements 테이블 (정산 리포트)
-- =========================================================

-- settlements 테이블이 없는 경우 생성
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    gross_amount NUMERIC DEFAULT 0,
    fee_rate NUMERIC DEFAULT 3.3, -- 수수료율 (%)
    fee_amount NUMERIC DEFAULT 0,
    net_amount NUMERIC DEFAULT 0,
    total_redeemed INTEGER DEFAULT 0, -- 사용된 쿠폰 수
    status VARCHAR(10) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'PAID')),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (store_id, period)
);

CREATE INDEX IF NOT EXISTS idx_settlements_store_period
ON public.settlements(store_id, period DESC);

-- =========================================================
-- 7. 확장된 nearby 쿠폰 조회 함수 (승인 필터 + 에셋 정보)
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_nearby_coupons_v2(
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
    per_user_limit INTEGER,
    product_sku VARCHAR(100),
    coupon_group_key VARCHAR(200),
    asset_type public.asset_type,
    asset_url TEXT,
    approval_status public.approval_status
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
        c.per_user_limit,
        c.product_sku,
        c.coupon_group_key,
        c.asset_type,
        c.asset_url,
        c.approval_status
    FROM public.coupons c
    JOIN public.stores s ON s.id = c.store_id
    WHERE c.is_active = TRUE
      AND s.is_active = TRUE
      AND c.approval_status = 'APPROVED'  -- 승인된 것만!
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
-- 8. 쿠폰 획득 시 최고 할인 유지 함수
-- =========================================================

CREATE OR REPLACE FUNCTION public.acquire_coupon_with_policy(
    p_user_id UUID,
    p_coupon_id UUID,
    p_claimed_lat NUMERIC DEFAULT NULL,
    p_claimed_lng NUMERIC DEFAULT NULL,
    p_claimed_via public.claim_method DEFAULT 'game'
)
RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_existing RECORD;
    v_new_issue_id UUID;
    v_coupon_code VARCHAR(20);
    v_result JSONB;
BEGIN
    -- 1. 쿠폰 정보 조회
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE id = p_coupon_id
      AND is_active = TRUE
      AND approval_status = 'APPROVED';

    IF v_coupon IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'COUPON_NOT_FOUND');
    END IF;

    -- 2. 유효기간 확인
    IF v_coupon.valid_to IS NOT NULL AND v_coupon.valid_to < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'COUPON_EXPIRED');
    END IF;

    -- 3. 수량 확인
    IF v_coupon.total_issuable IS NOT NULL THEN
        DECLARE
            v_issued_count INTEGER;
        BEGIN
            SELECT COUNT(*)::INTEGER INTO v_issued_count
            FROM public.coupon_issues
            WHERE coupon_id = p_coupon_id
              AND status IN ('active', 'used');

            IF v_issued_count >= v_coupon.total_issuable THEN
                RETURN jsonb_build_object('success', false, 'error', 'SOLD_OUT');
            END IF;
        END;
    END IF;

    -- 4. coupon_group_key 기준 기존 보유 확인
    IF v_coupon.coupon_group_key IS NOT NULL THEN
        SELECT ci.*, c.discount_type as c_discount_type, c.discount_value as c_discount_value
        INTO v_existing
        FROM public.coupon_issues ci
        JOIN public.coupons c ON c.id = ci.coupon_id
        WHERE ci.user_id = p_user_id
          AND ci.coupon_group_key = v_coupon.coupon_group_key
          AND ci.status = 'active';

        IF v_existing IS NOT NULL THEN
            -- 혜택 비교: 새 쿠폰이 더 좋은가?
            DECLARE
                v_new_better BOOLEAN := FALSE;
            BEGIN
                -- percent > amount, 동일 타입이면 값이 큰 것
                IF v_coupon.discount_type::TEXT = v_existing.c_discount_type::TEXT THEN
                    v_new_better := v_coupon.discount_value > v_existing.c_discount_value;
                ELSIF v_coupon.discount_type::TEXT = 'percent' AND v_existing.c_discount_type::TEXT = 'amount' THEN
                    v_new_better := TRUE;
                END IF;

                IF NOT v_new_better THEN
                    -- 기존이 더 좋음: 모션만 허용, 저장 안 함
                    RETURN jsonb_build_object(
                        'success', true,
                        'action', 'MOTION_ONLY',
                        'reason', 'EXISTING_BETTER',
                        'existing_discount', v_existing.c_discount_value
                    );
                END IF;

                -- 새 쿠폰이 더 좋음: 기존을 REPLACED 처리
                UPDATE public.coupon_issues
                SET status = 'cancelled'
                WHERE id = v_existing.id;

                -- REPLACED 이벤트 기록
                INSERT INTO public.coupon_events (user_id, store_id, coupon_id, coupon_issue_id, event_type, meta)
                VALUES (p_user_id, v_coupon.store_id, v_existing.coupon_id, v_existing.id, 'REPLACED',
                    jsonb_build_object('replaced_by_coupon', p_coupon_id, 'reason', 'BETTER_DISCOUNT'));
            END;
        END IF;
    END IF;

    -- 5. 쿠폰코드 생성 (YYMM + 난수 8자리 + 체크섬 2자리)
    v_coupon_code := TO_CHAR(COALESCE(v_coupon.valid_from, NOW()), 'YYMM')
        || UPPER(SUBSTR(MD5(gen_random_uuid()::TEXT), 1, 8))
        || UPPER(SUBSTR(MD5(p_user_id::TEXT || p_coupon_id::TEXT), 1, 2));

    -- 6. 새 쿠폰 발행
    INSERT INTO public.coupon_issues (
        coupon_id, user_id, code, coupon_code, status,
        issued_at, expires_at,
        claimed_lat, claimed_lng, claimed_via,
        coupon_group_key
    ) VALUES (
        p_coupon_id, p_user_id,
        UPPER(SUBSTR(MD5(gen_random_uuid()::TEXT), 1, 8)),
        v_coupon_code,
        'active',
        NOW(),
        COALESCE(v_coupon.valid_to, NOW() + INTERVAL '30 days'),
        p_claimed_lat, p_claimed_lng, p_claimed_via,
        v_coupon.coupon_group_key
    )
    RETURNING id INTO v_new_issue_id;

    -- 7. ACQUIRED 이벤트 기록
    INSERT INTO public.coupon_events (user_id, store_id, coupon_id, coupon_issue_id, event_type, meta)
    VALUES (p_user_id, v_coupon.store_id, p_coupon_id, v_new_issue_id, 'ACQUIRED',
        jsonb_build_object(
            'claimed_via', p_claimed_via::TEXT,
            'discount_type', v_coupon.discount_type::TEXT,
            'discount_value', v_coupon.discount_value,
            'coupon_code', v_coupon_code
        ));

    -- 8. 결과 반환
    RETURN jsonb_build_object(
        'success', true,
        'action', 'ACQUIRED',
        'issue_id', v_new_issue_id,
        'coupon_code', v_coupon_code,
        'discount_type', v_coupon.discount_type::TEXT,
        'discount_value', v_coupon.discount_value,
        'store_name', (SELECT name FROM public.stores WHERE id = v_coupon.store_id),
        'title', v_coupon.title
    );
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 9. 선물하기 함수
-- =========================================================

CREATE OR REPLACE FUNCTION public.create_gift(
    p_coupon_issue_id UUID,
    p_sender_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_issue RECORD;
    v_token VARCHAR(64);
BEGIN
    -- 1. 쿠폰 확인
    SELECT * INTO v_issue
    FROM public.coupon_issues
    WHERE id = p_coupon_issue_id
      AND user_id = p_sender_id
      AND status = 'active';

    IF v_issue IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'COUPON_NOT_FOUND_OR_NOT_ACTIVE');
    END IF;

    -- 2. 토큰 생성
    v_token := ENCODE(gen_random_uuid()::TEXT::BYTEA, 'hex');

    -- 3. 선물 상태로 업데이트
    UPDATE public.coupon_issues
    SET gift_token = v_token,
        gift_expires_at = NOW() + INTERVAL '24 hours',
        gifted_from = p_sender_id
    WHERE id = p_coupon_issue_id;

    -- 4. 이벤트 기록
    INSERT INTO public.coupon_events (user_id, coupon_id, coupon_issue_id, event_type, meta)
    VALUES (p_sender_id, v_issue.coupon_id, p_coupon_issue_id, 'GIFTED',
        jsonb_build_object('gift_token', v_token));

    RETURN jsonb_build_object(
        'success', true,
        'gift_token', v_token,
        'expires_at', (NOW() + INTERVAL '24 hours')::TEXT
    );
END;
$$ LANGUAGE plpgsql;

-- 선물 수락 함수
CREATE OR REPLACE FUNCTION public.accept_gift(
    p_gift_token VARCHAR(64),
    p_receiver_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_issue RECORD;
    v_coupon RECORD;
    v_existing RECORD;
    v_new_issue_id UUID;
BEGIN
    -- 1. 선물 쿠폰 확인
    SELECT * INTO v_issue
    FROM public.coupon_issues
    WHERE gift_token = p_gift_token
      AND gift_expires_at > NOW()
      AND status = 'active';

    IF v_issue IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'GIFT_NOT_FOUND_OR_EXPIRED');
    END IF;

    -- 2. 자기 자신에게 선물 불가
    IF v_issue.user_id = p_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'CANNOT_GIFT_SELF');
    END IF;

    -- 3. 쿠폰 정보 조회
    SELECT * INTO v_coupon FROM public.coupons WHERE id = v_issue.coupon_id;

    -- 4. 수신자 기존 보유 확인 (coupon_group_key 정책)
    IF v_coupon.coupon_group_key IS NOT NULL THEN
        SELECT ci.*, c.discount_value as c_discount_value, c.discount_type as c_discount_type
        INTO v_existing
        FROM public.coupon_issues ci
        JOIN public.coupons c ON c.id = ci.coupon_id
        WHERE ci.user_id = p_receiver_id
          AND ci.coupon_group_key = v_coupon.coupon_group_key
          AND ci.status = 'active';

        IF v_existing IS NOT NULL THEN
            -- 기존이 더 좋으면 수락 불가
            IF v_existing.c_discount_value >= v_coupon.discount_value
               AND v_existing.c_discount_type = v_coupon.discount_type THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'RECEIVER_HAS_BETTER',
                    'existing_discount', v_existing.c_discount_value
                );
            END IF;

            -- 새 쿠폰이 더 좋으면 기존 REPLACED
            UPDATE public.coupon_issues SET status = 'cancelled' WHERE id = v_existing.id;
        END IF;
    END IF;

    -- 5. 송신자 쿠폰 상태 변경
    UPDATE public.coupon_issues
    SET status = 'cancelled',
        gifted_to = p_receiver_id
    WHERE id = v_issue.id;

    -- 6. 수신자에게 새 쿠폰 발행
    INSERT INTO public.coupon_issues (
        coupon_id, user_id, code, coupon_code, status,
        issued_at, expires_at,
        claimed_via, coupon_group_key,
        gifted_from
    ) VALUES (
        v_issue.coupon_id, p_receiver_id,
        UPPER(SUBSTR(MD5(gen_random_uuid()::TEXT), 1, 8)),
        v_issue.coupon_code,
        'active',
        NOW(), v_issue.expires_at,
        'share', v_coupon.coupon_group_key,
        v_issue.user_id
    )
    RETURNING id INTO v_new_issue_id;

    -- 7. 이벤트 기록
    INSERT INTO public.coupon_events (user_id, coupon_id, coupon_issue_id, event_type, meta)
    VALUES (p_receiver_id, v_issue.coupon_id, v_new_issue_id, 'GIFT_ACCEPTED',
        jsonb_build_object('from_user', v_issue.user_id, 'original_issue', v_issue.id));

    RETURN jsonb_build_object(
        'success', true,
        'issue_id', v_new_issue_id,
        'title', v_coupon.title,
        'discount_value', v_coupon.discount_value
    );
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 10. coupons 인덱스 추가
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_coupons_approval_status
ON public.coupons(approval_status)
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_coupons_group_key
ON public.coupons(coupon_group_key);

CREATE INDEX IF NOT EXISTS idx_coupons_product_sku
ON public.coupons(store_id, product_sku);

-- =========================================================
-- 완료
-- =========================================================
