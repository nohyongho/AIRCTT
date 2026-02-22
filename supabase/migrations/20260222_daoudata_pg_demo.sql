-- =============================================================
-- 다우데이터 PG 데모 마이그레이션 (기존 테이블 안전 확장)
-- 기존 payments / coupon_issues / wallets 테이블에 컬럼 추가
-- 새 테이블: pg_merchants, event_logs, payment_methods
-- =============================================================

-- ▸ 1) pg_merchants (다우데이터 PG 가맹점)
CREATE TABLE IF NOT EXISTS pg_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  daou_mid TEXT NOT NULL,
  daou_api_key TEXT,
  van_code TEXT DEFAULT 'VAN_DEMO_001',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ▸ 2) event_logs (이벤트 로그 - 순환구조 Step 5)
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT DEFAULT 'USER',
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ▸ 3) payment_methods (결제수단 마스터)
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- 기본 결제수단 데이터
INSERT INTO payment_methods (code, label, icon, sort_order) VALUES
  ('card', '신용/체크카드', '💳', 1),
  ('bank_transfer', '계좌이체', '🏦', 2),
  ('vbank', '가상계좌', '🏧', 3),
  ('kakao_pay', '카카오페이', '🟡', 4)
ON CONFLICT (code) DO NOTHING;

-- ▸ 4) 기존 payments 테이블 확장 (IF NOT EXISTS 패턴)
DO $$ BEGIN
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS consumer_id UUID REFERENCES consumers(id);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS coupon_issue_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS pg_merchant_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS installment_months INT DEFAULT 0;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_company TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_number TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ▸ 5) 기존 coupon_issues 확장
DO $$ BEGIN
  ALTER TABLE coupon_issues ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE coupon_issues ADD COLUMN IF NOT EXISTS payment_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE coupon_issues ADD COLUMN IF NOT EXISTS user_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ▸ 6) RLS policies (중복 방지)
DO $$ BEGIN
  ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "event_logs_read_all" ON event_logs FOR SELECT USING (true);
  CREATE POLICY "event_logs_insert_all" ON event_logs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE pg_merchants ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "pg_merchants_read_all" ON pg_merchants FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "payment_methods_read_all" ON payment_methods FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ▸ 7) 인덱스
CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_consumer ON payments(consumer_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);

-- ▸ 8) 데모용 PG 가맹점 시드
INSERT INTO pg_merchants (id, daou_mid, daou_api_key, van_code, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'DAOU_SANDBOX_001', 'sk_test_demo_key', 'VAN_DEMO_001', 'active')
ON CONFLICT (id) DO NOTHING;
