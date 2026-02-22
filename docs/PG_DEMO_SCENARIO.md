# AIRCTT x 다우데이터 PG/VAN 데모 시나리오

> **대상**: 신봉렬 (다우데이터 PG/VAN 총판)
> **일시**: 2026년 2월
> **목적**: 쿠폰톡톡 플랫폼이 다우데이터 PG와 어떻게 연동되는지 실제 동작하는 화면으로 시연

---

## 시연 개요

소비자가 쿠폰을 발급받고, 해당 쿠폰으로 결제하는 **전체 라이프사이클**을 5단계로 시연합니다.

```
[1] 로그인 → [2] 쿠폰 발급 → [3] 결제 요청 → [4] PG 결제 승인 → [5] 로그 확인
```

핵심 포인트:
- **쿠폰 발급 → 지갑 적립 → PG 결제 → 쿠폰 사용 처리**가 하나의 루프로 연결
- 모든 이벤트가 **event_logs**에 실시간 기록
- 기존 쿠폰톡톡 소비자 지갑과 **동일한 DB 테이블 공유** (통합 완료)

---

## 사전 준비

1. **URL**: Vercel Preview 또는 `localhost:3099`
2. **경로**: `/pg-demo`
3. **데모 유저**: `demo@airctt.com` (자동 로그인)
4. **시드 쿠폰**: 3종 (하림펫푸드 체험쿠폰 10%, 아메리카노 50% 할인, 배달비 무료)

---

## 5단계 시연 스크립트

### 1단계: 로그인

**화면**: `/pg-demo` 접속 → "데모 시작" 버튼 클릭

**시연 멘트**:
> "소비자가 쿠폰톡톡 앱에 로그인하면, 자동으로 지갑이 생성됩니다."

**확인 포인트**:
- 화면에 유저 정보 표시 (PG데모 테스트유저)
- 지갑 정보: 포인트 잔고, 쿠폰 수

**API**: `POST /api/pg-demo/login`
```json
{
  "success": true,
  "user": { "name": "PG데모 테스트유저", "email": "demo@airctt.com" },
  "wallet": { "total_points": 0, "total_coupon_count": 0 }
}
```

---

### 2단계: 쿠폰 발급

**화면**: 쿠폰 목록에서 "발급받기" 클릭

**시연 멘트**:
> "가맹점이 등록한 쿠폰을 소비자가 발급받으면, 지갑에 자동 적립됩니다.
> 쿠폰 코드가 생성되고 event_logs에 기록됩니다."

**확인 포인트**:
- 쿠폰 코드 생성 (예: `DEMO-MLX37D1T`)
- 지갑 쿠폰 카운트 +1
- 이벤트 로그: `COUPON_ISSUED`

**API**: `POST /api/pg-demo/issue`
```json
{
  "success": true,
  "issue": {
    "id": "uuid...",
    "code": "DEMO-XXXXXXXX",
    "discount_type": "percent",
    "discount_value": 10
  }
}
```

---

### 3단계: 결제 요청 (PG 연동 시작)

**화면**: "결제하기" 클릭 → 결제 금액 확인

**시연 멘트**:
> "소비자가 결제를 시작하면, 다우데이터 PG 게이트웨이로 연결됩니다.
> 현재는 Mock PG이지만, 실제 연동 시 다우데이터 결제창이 여기에 뜹니다."

**확인 포인트**:
- 결제 레코드 생성 (status: `pending`)
- PG 주문번호 생성 (예: `PG_DEMO_1771724807653`)
- 이벤트 로그: `PAYMENT_CREATED`

**API**: `POST /api/pg-demo/pay/create`
```json
{
  "success": true,
  "payment_id": "uuid...",
  "pg_order_id": "PG_DEMO_...",
  "final_amount": 15000,
  "gateway_url": "/pg-demo/gateway?payment_id=...&amount=15000&method=card"
}
```

**[신봉렬 Q&A 예상]**
- Q: "실제 다우데이터 PG 연동은 어떻게?"
- A: `gateway_url`을 다우데이터 실제 결제 URL로 교체하면 됩니다. callback 구조는 동일합니다.

---

### 4단계: PG 결제 승인 (Callback)

**화면**: Mock PG 게이트웨이에서 "결제 승인" 클릭

**시연 멘트**:
> "PG에서 결제가 승인되면, callback으로 결과가 돌아옵니다.
> 이때 쿠폰 사용 처리, 지갑 업데이트, 거래 기록이 **원자적으로** 처리됩니다."

**확인 포인트**:
- 결제 상태: `pending` → `approved`
- 쿠폰 상태: `ISSUED` → `USED` (is_used: true)
- 지갑 쿠폰 카운트 -1
- 거래 기록: `coupon_use` 트랜잭션 추가
- 이벤트 로그: `COUPON_REDEEMED` + `PAYMENT_APPROVED`

**API**: `POST /api/pg-demo/pay/callback`
```json
{
  "success": true,
  "status": "approved",
  "message": "결제가 완료되었습니다!",
  "payment": {
    "pg_order_id": "PG_DEMO_...",
    "final_amount": 15000,
    "pg_transaction_id": "DAOU_MOCK_..."
  }
}
```

**[신봉렬 Q&A 예상]**
- Q: "결제 취소/실패 시 처리는?"
- A: `result: "CANCEL"` 또는 `"FAIL"`로 callback 오면 자동으로 `cancelled`/`failed` 처리되고, 쿠폰은 원래 상태로 유지됩니다.

---

### 5단계: 이벤트 로그 확인

**화면**: 화면 하단 "로그" 섹션 확인

**시연 멘트**:
> "모든 이벤트가 event_logs 테이블에 기록됩니다.
> 어드민 대시보드에서 실시간으로 모니터링 가능합니다."

**확인 포인트**:
| 이벤트 | 설명 |
|--------|------|
| `COUPON_ISSUED` | 쿠폰 발급 |
| `PAYMENT_CREATED` | 결제 생성 |
| `COUPON_REDEEMED` | 쿠폰 사용 |
| `PAYMENT_APPROVED` | 결제 승인 |

**API**: `GET /api/pg-demo/logs?user_id=...`
```json
{
  "logs": [4건],
  "summary_24h": {
    "COUPON_ISSUED": 1,
    "PAYMENT_CREATED": 1,
    "COUPON_REDEEMED": 1,
    "PAYMENT_APPROVED": 1
  }
}
```

---

## 추가 시연 포인트: 소비자 지갑 통합

**시연 멘트**:
> "PG 데모에서 발급한 쿠폰이 기존 쿠폰톡톡 소비자 지갑에서도 바로 확인됩니다.
> 별도 연동 없이 같은 DB 테이블을 공유합니다."

**확인 방법**:
1. `/api/wallet/my-balance` → 지갑 잔고 조회 (wallets 테이블)
2. `/api/wallet/my-coupons` → 소비자 쿠폰 목록 (coupon_issues 테이블)
3. `/api/wallet/my-history` → 거래 내역 (wallet_transactions 테이블)

핵심: **pg-demo에서 발급/사용한 데이터가 기존 쿠폰톡톡 API에서도 동일하게 조회됨**

---

## 기술 아키텍처 요약 (신봉렬 설명용)

```
[소비자 앱]
    │
    ├── /api/pg-demo/login      → users + wallets
    ├── /api/pg-demo/issue      → coupon_issues + wallets + wallet_transactions + event_logs
    ├── /api/pg-demo/pay/create → pg_demo_payments + event_logs
    ├── /api/pg-demo/pay/callback → pg_demo_payments + coupon_issues + wallets + wallet_transactions + event_logs
    └── /api/pg-demo/logs       → event_logs
    │
    ▼
[다우데이터 PG/VAN]
    │
    └── 실제 연동 시: pay/create의 gateway_url을 다우데이터 실 결제 URL로 교체
                      pay/callback에서 다우데이터 webhook 수신
```

**DB 테이블 구조**:
| 테이블 | 역할 | 공유 |
|--------|------|:----:|
| `users` | 사용자 (Supabase Auth) | O |
| `wallets` | 지갑 (포인트, 쿠폰 수) | O |
| `wallet_transactions` | 거래 내역 | O |
| `coupon_issues` | 발급된 쿠폰 | O |
| `pg_demo_payments` | PG 결제 (데모 전용) | - |
| `event_logs` | 이벤트 로그 | O |

---

## 예상 Q&A

### Q1: 실제 PG 연동 일정은?
> 현재 Mock PG로 전체 플로우가 검증 완료되었습니다.
> 다우데이터 API 문서를 받으면 `pay/create`와 `pay/callback` 두 파일만 수정하면 됩니다.
> 예상 소요: 1~2주

### Q2: 결제 수단은?
> 현재: 카드 결제 (Mock)
> 추가 가능: 간편결제(카카오페이, 네이버페이), 계좌이체, 가상계좌
> 다우데이터 PG에서 지원하는 모든 수단으로 확장 가능

### Q3: 정산은 어떻게?
> 가맹점별 정산은 `pg_demo_payments` 테이블의 데이터로 집계
> 쿠폰 할인분은 `discount_amount` 필드로 별도 관리
> 정산 대시보드는 어드민 페이지에서 제공 (개발 중)

### Q4: 보안은?
> - Supabase RLS(Row Level Security) 적용
> - PostgreSQL 레벨에서 유저별 데이터 격리
> - PG 통신: HTTPS + 서버사이드 only (클라이언트에 키 노출 없음)

### Q5: 쿠폰 종류는?
> - 정률 할인 (10%, 50% 등)
> - 정액 할인 (3,000원 등)
> - 배달비 무료 (특수 타입)
> - 가맹점이 어드민에서 직접 생성 가능

---

## 시연 후 Next Steps

1. **다우데이터 API 문서 수령** → 실 PG 연동 착수
2. **결제 수단 확장** (간편결제, 계좌이체)
3. **정산 대시보드** 개발
4. **가맹점 어드민** → 쿠폰/매출/정산 조회 화면

---

*작성: AIRCTT 개발팀 | 2026-02-22*
