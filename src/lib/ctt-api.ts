// CTT (CouponTalkTalk) API 클라이언트
import type {
    NearbyCoupon,
    CouponWithStore,
    ClaimCouponRequest,
    ClaimCouponResponse,
    RedeemCouponRequest,
    RedeemCouponResponse,
    ClaimMethod
} from '@/types/coupon';

const API_BASE = '/api/ctt';

// 에러 응답 타입
interface ApiError {
    error: string;
    details?: string;
}

// API 호출 헬퍼
async function fetchApi<T>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error((data as ApiError).error || 'API request failed');
    }

    return data as T;
}

// =========================================
// Consumer APIs
// =========================================

/**
 * 근처 쿠폰 조회
 */
export async function getNearbyCoupons(params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
}): Promise<NearbyCoupon[]> {
    const searchParams = new URLSearchParams({
        lat: params.lat.toString(),
        lng: params.lng.toString(),
        r: (params.radius || 5).toString(),
        limit: (params.limit || 20).toString(),
    });

    const data = await fetchApi<{ coupons: NearbyCoupon[] }>(
        `/coupons?${searchParams}`
    );

    return data.coupons;
}

/**
 * 쿠폰 상세 조회
 */
export async function getCouponDetail(couponId: string): Promise<CouponWithStore> {
    return fetchApi<CouponWithStore>(`/coupons/${couponId}`);
}

/**
 * 쿠폰 클레임 (발급받기)
 */
export async function claimCoupon(
    couponId: string,
    params: {
        user_id: string;
        lat?: number;
        lng?: number;
        claimed_via: ClaimMethod;
    }
): Promise<ClaimCouponResponse> {
    return fetchApi<ClaimCouponResponse>(`/coupons/${couponId}/claim`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

/**
 * 쿠폰 사용 (Redeem)
 */
export async function redeemCoupon(
    params: RedeemCouponRequest
): Promise<RedeemCouponResponse> {
    return fetchApi<RedeemCouponResponse>('/redeem', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

// =========================================
// Merchant APIs
// =========================================

interface MerchantCouponParams {
    merchant_id: string;
    store_id?: string;
    status?: 'active' | 'inactive' | 'expired';
    limit?: number;
    offset?: number;
}

interface CreateCouponParams {
    merchant_id: string;
    store_id?: string;
    title: string;
    description?: string;
    discount_type: 'percent' | 'amount';
    discount_value: number;
    max_discount_amount?: number;
    min_order_amount?: number;
    valid_from?: string;
    valid_to?: string;
    max_issues?: number;
    max_per_user?: number;
    requires_location?: boolean;
    location_radius_km?: number;
    ar_enabled?: boolean;
    ar_asset_url?: string;
    terms?: string;
}

interface MerchantCouponsResponse {
    coupons: CouponWithStore[];
    total: number;
    limit: number;
    offset: number;
}

/**
 * 가맹점 쿠폰 목록 조회
 */
export async function getMerchantCoupons(
    params: MerchantCouponParams
): Promise<MerchantCouponsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('merchant_id', params.merchant_id);
    if (params.store_id) searchParams.set('store_id', params.store_id);
    if (params.status) searchParams.set('status', params.status);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());

    return fetchApi<MerchantCouponsResponse>(
        `/merchant/coupons?${searchParams}`
    );
}

/**
 * 새 쿠폰 생성
 */
export async function createCoupon(
    params: CreateCouponParams
): Promise<{ success: boolean; coupon: CouponWithStore }> {
    return fetchApi(`/merchant/coupons`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

/**
 * 가맹점 통계 조회
 */
export interface CouponStats {
    coupon_id: string;
    title: string;
    store_name: string | null;
    total_issued: number;
    total_used: number;
    total_expired: number;
    total_active: number;
    usage_rate: number;
    total_discount_given: number;
}

export interface StatsSummary {
    total_coupons: number;
    total_issued: number;
    total_used: number;
    total_active: number;
    overall_usage_rate: number;
    total_discount_given: number;
}

export interface DailyTrend {
    date: string;
    issued: number;
    used: number;
}

export interface MerchantStatsResponse {
    stats: CouponStats[];
    summary: StatsSummary;
    daily_trend: DailyTrend[];
    period: string;
}

export async function getMerchantStats(params: {
    merchant_id: string;
    store_id?: string;
    coupon_id?: string;
    period?: '7d' | '30d' | '90d' | 'all';
}): Promise<MerchantStatsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('merchant_id', params.merchant_id);
    if (params.store_id) searchParams.set('store_id', params.store_id);
    if (params.coupon_id) searchParams.set('coupon_id', params.coupon_id);
    if (params.period) searchParams.set('period', params.period);

    return fetchApi<MerchantStatsResponse>(`/merchant/stats?${searchParams}`);
}

// =========================================
// Helper Functions
// =========================================

/**
 * 할인 금액 포맷팅
 */
export function formatDiscount(
    type: 'percent' | 'amount',
    value: number,
    language: 'ko' | 'en' = 'ko'
): string {
    if (type === 'percent') {
        return `${value}%`;
    }
    if (language === 'ko') {
        return `${value.toLocaleString()}원`;
    }
    return `$${value.toLocaleString()}`;
}

/**
 * 남은 일수 계산
 */
export function getDaysLeft(expiresAt: string): number {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

/**
 * 쿠폰 상태 텍스트
 */
export function getStatusText(
    status: string,
    language: 'ko' | 'en' = 'ko'
): string {
    const statusMap: Record<string, { ko: string; en: string }> = {
        active: { ko: '사용 가능', en: 'Available' },
        used: { ko: '사용 완료', en: 'Used' },
        expired: { ko: '기간 만료', en: 'Expired' },
        cancelled: { ko: '취소됨', en: 'Cancelled' },
    };
    return statusMap[status]?.[language] || status;
}
