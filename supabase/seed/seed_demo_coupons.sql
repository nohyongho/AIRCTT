-- ============================================
-- AIRCTT × 다우데이터 PG 데모 시드 데이터
-- 실행: Supabase SQL Editor에서 직접 실행
-- ============================================

-- 1) auth.users에 데모 유저 생성 (public.users FK 필요)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'demo@airctt.com',
  crypt('demo1234!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "PG데모 사용자"}',
  NOW(), NOW(), '', ''
)
ON CONFLICT (id) DO NOTHING;

-- 2) public.users
INSERT INTO users (id, email, name, phone)
VALUES ('00000000-0000-0000-0000-000000000099', 'demo@airctt.com', 'PG데모 사용자', '010-0000-0099')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3) 데모 쿠폰 3개
INSERT INTO coupons (id, merchant_id, title, description, discount_type, discount_value, max_discount_amount, min_order_amount, is_active, approval_status, valid_from, valid_to, asset_url, total_issuable, per_user_limit, unit_price)
VALUES
  ('aaaaaaaa-0001-4000-a000-000000000001', '11111111-1111-1111-1111-111111111111',
   '하림펫푸드 체험쿠폰 10%', '반려동물 사료 전 품목 10% 할인 쿠폰. 다우데이터 PG 결제 데모용.',
   'percent', 10, 5000, 10000, true, 'APPROVED', NOW(), NOW() + INTERVAL '90 days',
   '/coupons/harim-pet.svg', 999, 3, 50),
  ('aaaaaaaa-0002-4000-a000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '구름장터 5,000P 쿠폰', '구름장터 전 매장 5,000원 할인쿠폰. PG 결제 시연용.',
   'amount', 5000, 5000, 15000, true, 'APPROVED', NOW(), NOW() + INTERVAL '90 days',
   '/coupons/goorum-market.svg', 999, 3, 50),
  ('aaaaaaaa-0003-4000-a000-000000000003', '11111111-1111-1111-1111-111111111111',
   'PG 데모 전용 1,000원 쿠폰', '다우데이터 PG/VAN 결제 시연 전용 1,000원 할인쿠폰.',
   'amount', 1000, 1000, 5000, true, 'APPROVED', NOW(), NOW() + INTERVAL '90 days',
   '/coupons/pg-demo-1000.svg', 999, 5, 50);

-- 4) 데모 지갑
INSERT INTO pg_demo_wallets (user_id, total_points, total_coupon_count)
VALUES ('00000000-0000-0000-0000-000000000099', 0, 0)
ON CONFLICT (user_id) DO NOTHING;
