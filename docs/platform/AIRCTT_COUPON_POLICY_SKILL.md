# AIRCTT Coupon Policy Skills (Agent Spec) v1

본 문서는 에이전트(클/젬/엔티)가 동일한 정책으로 구현/검증하도록 **스킬 단위**로 정의합니다.

---

## SKILL 01 — SINGLE_PRODUCT_COUPON_POLICY (필수)

### 목적
단일회사(store_id) + 단일상품(product_sku) 기준으로 **1인 1장 + 최고 할인만 유지**를 강제합니다.

### 입력 (쿠폰 발행 시)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| store_id | UUID | O | 발행 매장 |
| product_sku | TEXT | O | 단일상품 코드 (가맹점 직접 입력) |
| discount_type | ENUM | O | percent / amount / freebie |
| discount_value | NUMERIC | O | 할인값 |
| valid_from | TIMESTAMP | O | 유효 시작일 |
| valid_to | TIMESTAMP | O | 유효 종료일 |

### 파생 (서버 자동 생성)

```
coupon_group_key = store_id + ":" + product_sku
```

### 저장 규칙 (유저 획득 시)

유저가 게임에서 쿠폰을 잡았을 때:

```
1. 동일 coupon_group_key로 user가 이미 보유한 쿠폰 조회
2. 없으면 → 그대로 저장
3. 있으면 → 혜택 비교:
   - 새 쿠폰이 더 좋으면: 기존을 REPLACED 처리 후 새 쿠폰 저장
   - 새 쿠폰이 더 나쁘면: 저장하지 않음 (게임 모션은 허용)
```

### 혜택 비교 우선순위

```
1. discount_type 우선순위: freebie(무료) > percent(%) > amount(정액)
2. 동일 type이면: discount_value가 큰 것 우선
```

### DB 제약 (필수)

```sql
-- coupon_issues 테이블에 coupon_group_key 추가 후
UNIQUE (user_id, coupon_group_key) WHERE status = 'active'
```

---

## SKILL 02 — COUPON_CODE_GENERATION (필수)

### 목적
발행 시 `coupon_code`를 자동 생성하여 DB에 저장합니다 (UNIQUE).

### 생성 규칙

```
구성: [날짜코드 4자리] + [난수 8자리] + [체크섬 2자리] = 총 14자리
- 날짜코드: valid_from 기준 YYMM (예: 2602)
- 난수: crypto.getRandomValues() 기반
- 체크섬: CRC16 하위 2바이트
- 인코딩: Base32 (대문자 + 숫자, 혼동문자 제외)
```

### 특성
- 예측 불가능 (secure random)
- 복사/전달/선물 링크에 사용 가능
- 시각적으로 읽기 쉬운 형태 (하이픈 구분: `26AB-CDEF-GH12-JK`)

### DB 제약

```sql
ALTER TABLE coupon_issues ADD COLUMN coupon_code VARCHAR(20) UNIQUE;
```

---

## SKILL 03 — CRACKER_ASSET_MAPPING (필수)

### 목적
쿠폰을 게임 오브젝트(크랙커)로 매핑합니다.

### 입력

| 필드 | 타입 | 설명 |
|------|------|------|
| coupon_id | UUID | 쿠폰 ID |
| asset_type | ENUM | IMAGE_2D / MODEL_3D / VIDEO / AR_EVENT / SMARTGLASS / AI_AVATAR_EVENT |
| asset_url | TEXT | 에셋 파일 URL |

### 규칙

1. `approval_status = 'APPROVED'` 상태에서만 스폰 가능
2. 게임 스폰 오브젝트에 최소 필드:
   - `coupon_id`
   - `coupon_group_key`
   - `display_label` (예: "30% / PANTS-001")
   - `asset_type`
   - `spawn_no` (표시용 넘버)

### 비용 산정

```
발행비용 = ASSET_PRICE[asset_type] × issue_quantity

ASSET_PRICE = {
  IMAGE_2D: 50,
  MODEL_3D: 80,
  VIDEO: 100,
  AR_EVENT: 별도,
  SMARTGLASS: 별도,
  AI_AVATAR_EVENT: 별도
}
```

---

## SKILL 04 — NEAR_QUERY_SINGLE_SOURCE (필수)

### 목적
지도와 게임이 **동일한 쿠폰 소스**(nearby query)를 사용하여 불일치를 제거합니다.

### 규칙

1. 지도 마커도, 게임 스폰도 동일한 `/api/coupons/nearby` 결과를 사용
2. 발행 후 "게임 반영"은 이벤트 체인이 아니라 **near refresh**로 자연 반영
3. `approval_status = 'APPROVED'`인 쿠폰만 결과에 포함

### 응답에 추가될 필드

```typescript
interface NearbySpawnCoupon extends NearbyCoupon {
  coupon_group_key: string;
  product_sku: string;
  asset_type: string;
  asset_url?: string;
  approval_status: string;
}
```

---

## SKILL 05 — WALLET_DEEPLINK_TO_STORE (필수)

### 목적
지갑 쿠폰 클릭 시 **상점/주문 페이지로 이동**되는 고정 딥링크를 제공합니다.

### 딥링크 형식

```
/consumer/market/store/{storeId}?coupon={couponIssueId}
```

### 규칙

1. 쿠폰 query가 있으면 상점 화면에서 **"쿠폰 적용" CTA 버튼**을 우선 노출
2. 쿠폰 클릭 시 `coupon_events` 테이블에 `CLICKED` 이벤트 기록
3. 만료/사용완료 쿠폰은 딥링크 비활성 처리

---

## SKILL 06 — GIFT_TRANSFER_POLICY (MVP 필수)

### 목적
카카오/스타벅스처럼 **선물하기/복사/공유**가 가능한 쿠폰 이전 기능.

### 방식 (1차 MVP: 링크 기반)

```
1. gift_token 생성 (UUID + 만료시간 24시간)
2. 링크: /gift/{token}
3. 수신자는 로그인 후 "수락" 버튼으로 이전
```

### 상태 흐름

```
ACTIVE → GIFT_PENDING → TRANSFERRED (송신자)
                      → ACTIVE (수신자, 새 issue 생성)
```

### 충돌 규칙

수신자가 동일 `coupon_group_key`를 이미 보유한 경우:
- 더 높은 혜택 → 기존 REPLACED 후 새 쿠폰 적용
- 더 낮은 혜택 → 수락 불가 안내

### DB 필드 (coupon_issues 확장)

```sql
gifted_from UUID,
gifted_to UUID,
gift_token VARCHAR(64),
gift_expires_at TIMESTAMPTZ
```

---

## SKILL 07 — APPROVAL_WORKFLOW (필수)

### 목적
가맹점이 업로드한 쿠폰 디자인/콘텐츠를 운영팀이 승인/반려하는 워크플로우.

### 상태값

```sql
approval_status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
```

### 규칙

1. 가맹점이 쿠폰 생성 시 기본 상태: `DRAFT`
2. 디자인 업로드 후 제출: `PENDING_APPROVAL`
3. 운영 승인: `APPROVED` → 게임/지도 노출 시작
4. 운영 반려: `REJECTED` + 사유 기록
5. 기존 `/crm/admin/approvals` 페이지에서 처리

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| v1 | 2026-02-17 | 핵심 스킬 7종 확정 |
