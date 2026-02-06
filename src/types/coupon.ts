// CouponTalkTalk MVP Type Definitions

export type DiscountType = 'percent' | 'amount';
export type CouponIssueStatus = 'active' | 'used' | 'expired' | 'cancelled';
export type ClaimMethod = 'ar' | 'list' | 'game' | 'qr' | 'share';

// 쿠폰 템플릿 (상점이 생성)
export interface Coupon {
    id: string;
    merchant_id: string;
    store_id: string | null;
    title: string;
    description?: string | null;
    discount_type: DiscountType;
    discount_value: number;
    max_discount_amount?: number | null;
    min_order_amount?: number;
    valid_from?: string;
    valid_to?: string | null;
    total_issuable?: number;
    per_user_limit?: number;
    max_issues?: number | null;
    max_per_user?: number;
    requires_location?: boolean;
    location_radius_km?: number;
    ar_enabled?: boolean;
    ar_asset_url?: string | null;
    terms?: string | null;
    radius_km?: number;
    center_lat?: number;
    center_lng?: number;
    is_active: boolean;
    created_at?: string;
}

// 상점 정보
export interface Store {
    id: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    is_active?: boolean;
}

// 쿠폰 + 상점 정보
export interface CouponWithStore extends Coupon {
    store?: Store;
}

// 발행된 쿠폰 (사용자가 획득)
export interface CouponIssue {
    id: string;
    coupon_id: string;
    user_id: string | null;
    phone?: string;
    code: string;
    status: CouponIssueStatus;
    issued_at: string;
    used_at?: string;
    expires_at: string;
    claimed_lat?: number;
    claimed_lng?: number;
    claimed_via: ClaimMethod;
    // Relations
    coupons?: Coupon;
}

// 근처 쿠폰 (API 응답)
export interface NearbyCoupon {
    id: string; // coupon_id와 동일
    coupon_id: string;
    store_id: string;
    store_name: string;
    store_address?: string;
    title: string;
    description?: string;
    discount_type: DiscountType;
    discount_value: number;
    radius_km?: number;
    distance_km: number;
    valid_to?: string;
    total_issuable?: number;
    per_user_limit?: number;
}

// 쿠폰 획득 요청
export interface ClaimCouponRequest {
    user_id: string;
    lat: number;
    lng: number;
    accuracy?: number;
    claimed_via?: ClaimMethod;
}

// 쿠폰 획득 응답
export interface ClaimCouponResponse {
    success: boolean;
    issue?: CouponIssue;
    code?: string; // 발급된 쿠폰 코드
    expires_at?: string;
    error?: string;
}

// 쿠폰 사용 요청
export interface RedeemCouponRequest {
    code: string;
    store_id: string;
    order_amount?: number;
}

// 쿠폰 사용 응답
export interface RedeemCouponResponse {
    success: boolean;
    discount_type?: DiscountType;
    discount_value?: number;
    discount_applied?: number;
    error?: string;
}

// 쿠폰 생성 요청 (Merchant)
export interface CreateCouponRequest {
    store_id: string;
    merchant_id: string;
    title: string;
    description?: string;
    discount_type: DiscountType;
    discount_value: number;
    max_discount_amount?: number;
    min_order_amount?: number;
    radius_km?: number;
    total_issuable?: number;
    per_user_limit?: number;
    valid_days?: number; // 유효 기간 (일)
}

// 쿠폰 통계
export interface CouponStats {
    coupon_id: string;
    title: string;
    discount_type: DiscountType;
    discount_value: number;
    issued_count: number;
    active_count: number;
    used_count: number;
    expired_count: number;
    usage_rate: number;
}

// 위치 정보
export interface Location {
    lat: number;
    lng: number;
    accuracy?: number;
}

// 상점 정보 (간략)
export interface StoreBasic {
    id: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    is_active: boolean;
}
