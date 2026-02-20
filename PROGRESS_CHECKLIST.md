# 🔄 AIRCTT 선순환 구조 구현 체크리스트
## CouponTalkTalk 쿠폰 순환 생태계

> 사업자 쿠폰 디자인 → 본사(오빠) 승인 → 크래커 게임 배포 → 고객 획득 → 사업자 사이트 이동 → 쿠폰 사용

---

### 📋 구현 단계

- [x] **Step 0**: 계획 체크표 커밋 (PROGRESS_CHECKLIST.md)
- [x] **Step 1**: 사업자 쿠폰 등록 API (`/api/merchant/coupons`)
  - [x] POST: 쿠폰 등록 (approval_status: PENDING_APPROVAL)
  - [x] GET: 사업자 쿠폰 목록 조회
  - [x] merchant_url 필드 지원
- [x] **Step 2**: 본사(오빠) 승인 시스템
  - [x] 승인 API (`/api/admin/coupon-approvals`) - GET/PATCH
  - [x] 승인 대시보드 페이지 (`/admin/coupon-approvals`)
  - [x] zeus1404@gmail.com만 승인/거절 가능
  - [x] 승인시 approval_status → APPROVED, is_active → true
- [x] **Step 3**: 승인된 쿠폰 → 크래커 게임 배포 연결
  - [x] APPROVED 쿠폰을 게임 API에서 로드
  - [x] CouponGame3D 크래커에 실제 쿠폰 데이터 연결
  - [x] 쿠폰 획득시 DB 기록 (coupon_issues)
- [x] **Step 4**: 쿠폰 사용 → 사업자 사이트 이동
  - [x] 지갑에서 쿠폰 클릭 → 사업자 사이트 딥링크
  - [x] 쿠폰 코드 자동 전달
  - [x] 사용 완료 상태 업데이트
- [ ] **Step 5**: 전체 네비게이션 연결 (선순환 흐름 완성)
  - [ ] 각 페이지 간 이동 버튼/링크
  - [ ] 사업자/고객/관리자 흐름별 메뉴
  - [ ] 순환 구조 완성 테스트

---

### 🔧 기술 스택
- **Frontend**: Next.js (App Router)
- **Backend**: Supabase PostgREST (`@/lib/postgrest`)
- **배포**: Vercel (자동 배포)
- **게임**: Three.js (CouponGame3D)

### 👤 역할
- **본사 관리자 (오빠)**: zeus1404@gmail.com
- **사업자**: 쿠폰 디자인 및 등록
- **고객**: 게임 플레이 → 쿠폰 획득 → 사용

### 📅 작업 기록
- 2026-02-20: Step 0 체크표 생성
- 2026-02-20: Step 1 사업자 쿠폰 등록 API 완료
- 2026-02-20: Step 2 관리자 승인 시스템 완료 (API + 대시보드)
- 2026-02-20: 빌드 에러 수정 (supabase-js → postgrest 클라이언트)
- 2026-02-20: Step 3-A game spawn-coupons API (GET/POST)
- 2026-02-20: Step 3-B CouponGame3D frontend API 연결
- 2026-02-20: Step 4-A coupon redeem API
- 2026-02-20: Step 4-B wallet redeem button + API 연결