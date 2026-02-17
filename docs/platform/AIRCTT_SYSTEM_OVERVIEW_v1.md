# AIRCTT System Overview v1

## 0. 한 줄 정의

**AIRCTT**는 _"쿠폰 발행 → 승인 → 지도/게임 배포 → 유저 획득 → 지갑 → 선물 → 상점 사용 → 정산"_ 을 하나로 연결하는 AR/게임 기반 쿠폰 유통 플랫폼이다.

---

## 1. 사용자 역할

### 1-1. 가맹점 (Merchant/발행자)
- 쿠폰 생성, 디자인 업로드, 승인 요청
- 배포 반경/기간/수량 설정
- `product_sku` (단일상품 코드) 직접 입력
- 대시보드: 쿠폰 통계, 매출, 정산 확인

### 1-2. 소비자 (Consumer/유저)
- 지도에서 주변 쿠폰 확인
- 게임에서 크랙커를 잡아 쿠폰 획득
- 지갑에서 보유/선물/사용
- 상점 이동: 구매/예약/배달 흐름 진입

### 1-3. 운영자 (Admin/플랫폼)
- 콘텐츠 승인/반려
- 정책 위반 방지 (중복, 악용)
- 정산/리포트 운영

---

## 2. 핵심 플로우 (9단계)

```
[1] 가맹점 쿠폰 생성 (DRAFT)
 ↓ product_sku, discount_type/value, asset_type 입력
[2] 디자인 업로드 → 승인 요청 (PENDING_APPROVAL)
 ↓
[3] 운영 승인 (APPROVED) ← /crm/admin/approvals
 ↓
[4] nearby query에 포함 → 지도 노출
 ↓ 동일한 nearby API를 게임도 사용
[5] 게임 스폰 (크랙커 드롭)
 ↓
[6] 유저 잡기(acquire) → 정책 적용 (1인1장 + 최고할인)
 ↓ coupon_issues INSERT, coupon_group_key UNIQUE 검증
[7] 지갑 표시 (DB 기반, localStorage 아님)
 ↓
[8] 지갑에서 선물하기 / 딥링크 이동 (상점/주문)
 ↓
[9] 사용(리딤) → coupon_events 기록 → 정산/리포트
```

---

## 3. 핵심 정책

### 3-1. 단일회사 + 단일상품

```
coupon_group_key = store_id + ":" + product_sku
```

- `product_sku`는 가맹점이 **직접 입력** (필수, 발행 후 수정 불가)
- 형식: `브랜드-상품명-번호` (예: `PANTS-BASIC-001`)

### 3-2. 1인 1장 + 최고 할인 유지

- 동일 `coupon_group_key`에서 유저는 **1장만 보유**
- 더 높은 할인 쿠폰을 잡으면 기존 것을 `REPLACED` 처리 후 교체
- 더 낮은 할인 쿠폰을 잡으면 모션만 발생, 저장 안 함

### 3-3. 쿠폰번호 자동 생성

- `coupon_code`: 발행일 + 난수 기반, 예측 불가, UNIQUE
- `coupon_issues.code`: 기존 8자리 → 14자리 확장 (날짜코드 + 난수 + 체크섬)

---

## 4. 크랙커(게임 오브젝트) 운영

### 4-1. 타입별 단가

| 타입 | 코드 | 단가 |
|------|------|------|
| 2D 이미지 | IMAGE_2D | 50원/장 |
| 3D 모델 | MODEL_3D | 80원/장 |
| 영상형 | VIDEO | 100원~/장 |
| AR/스마트글래스/아바타 | 별도 코드 | 별도 견적 |

### 4-2. 승인 후 반영

- `approval_status = 'APPROVED'` 인 쿠폰만 게임/지도에 노출
- 승인은 `/crm/admin/approvals` 에서 처리

상세: [AIRCTT_CRACKER_PRICING_GUIDE.md](./AIRCTT_CRACKER_PRICING_GUIDE.md)

---

## 5. 선물하기 (MVP)

- `gift_token` 기반 링크 선물: `/gift/{token}`
- 수신자는 "수락" 버튼 방식 (안전)
- 수락 시에도 동일 `coupon_group_key` 정책 적용 (1인1장 + 최고할인)

---

## 6. 데이터 구조 (기존 테이블 확장)

### 6-1. coupons 테이블 추가 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| product_sku | VARCHAR(100) | 단일상품 코드 (가맹점 입력) |
| coupon_group_key | VARCHAR(200) | store_id:product_sku (자동생성) |
| asset_type | VARCHAR(30) | IMAGE_2D / MODEL_3D / VIDEO 등 |
| asset_url | TEXT | 크랙커 에셋 URL |
| approval_status | VARCHAR(20) | DRAFT / PENDING_APPROVAL / APPROVED / REJECTED |
| unit_price | NUMERIC | 크랙커 단가 (원) |

### 6-2. coupon_issues 테이블 추가 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| coupon_group_key | VARCHAR(200) | 쿠폰 그룹키 (중복 방지) |
| coupon_code | VARCHAR(20) | 확장 쿠폰코드 (14자리) |
| gifted_from | UUID | 선물 송신자 |
| gifted_to | UUID | 선물 수신자 |
| gift_token | VARCHAR(64) | 선물 토큰 |
| gift_expires_at | TIMESTAMPTZ | 선물 만료시간 |

### 6-3. coupon_events 테이블 (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | 사용자 |
| store_id | UUID | 매장 |
| coupon_id | UUID | 쿠폰 |
| event_type | VARCHAR(20) | ISSUED / APPROVED / SPAWNED / ACQUIRED / CLICKED / REDEEMED / GIFTED / REPLACED |
| meta | JSONB | 추가 데이터 |
| created_at | TIMESTAMPTZ | 이벤트 시간 |

### 6-4. settlements 테이블 (기존 활용)

```
store_id, period(YYYY-MM), gross_amount, fee_amount, net_amount, status
```

---

## 7. 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) + React 19 |
| 스타일 | Tailwind CSS 4 + Framer Motion |
| DB | Supabase (PostgreSQL) |
| 인증 | Supabase Auth + JWT |
| 지도 | Google Maps API |
| 게임 | Three.js → Canvas 2D (경량화) |
| 배포 | Vercel |
| 도메인 | airctt.com (메인), petctt.com (쿠폰톡톡 연결) |

---

## 8. 개발 우선순위

### Phase 1 — 필수 작동 (현재)
- [x] 위치 기반 쿠폰 조회 (nearby API)
- [x] 게임 시스템 (점수/보상)
- [x] 쿠폰 획득/사용 API
- [x] 지갑 서비스
- [ ] **발행 → 게임 자동 연결** (coupon_group_key + nearby 공용)
- [ ] **1인1장 + 최고할인 정책**
- [ ] **쿠폰 자동번호 생성** (확장 코드)
- [ ] **승인 후에만 게임 노출**

### Phase 2 — 플랫폼화
- [ ] 선물하기 (링크/수락)
- [ ] 크랙커 단가 계산 + 발행 비용 산정
- [ ] 사용 로그(coupon_events) + 정산 리포트
- [ ] 구름장터: 입점사 페이지 + 쿠폰 거래

### Phase 3 — 우주무대 확장
- [ ] AR 이벤트 / 스마트글래스
- [ ] 초지능 아바타 안내/행사
- [ ] 아바타 쇼 / 무대 연출

---

## 9. 도메인 구조

```
airctt.com          → 메인 플랫폼 (게임/지갑/매장/입점)
petctt.com          → 쿠폰톡톡 (가맹점가입/입점/쿠폰발행/게임 통합)
                      "쿠폰톡톡" 버튼 → airctt.com 연결
구름장터 (서브)      → 쿠폰 거래/사용/입점업체/수수료 정산
```

---

## 10. 성공 기준

**발행 → 승인 → 지도 → 게임 → 지갑이 "끊김 없이" 동작하면, AIRCTT는 이미 작동 중인 플랫폼이다.**

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| v1 | 2026-02-17 | 전체 시스템 설계 확정 (아미/클 크로스체킹 기반) |
