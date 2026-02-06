// CouponTalkTalk MVP - 쿠폰 핵심 로직

import { createPostgrestClient } from './postgrest';

/**
 * 거리 계산 (Haversine) - 클라이언트 보조용
 */
export function calculateDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // 지구 반지름 (km)
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * 미터를 킬로미터로 변환
 */
export function metersToKm(meters: number): number {
    return meters / 1000;
}

/**
 * 킬로미터를 미터로 변환
 */
export function kmToMeters(km: number): number {
    return km * 1000;
}

/**
 * 위치가 반경 내인지 확인
 */
export async function checkInRadius(
    userLat: number,
    userLng: number,
    targetLat: number,
    targetLng: number,
    radiusKm: number
): Promise<boolean> {
    const client = createPostgrestClient();
    const { data, error } = await client.rpc('check_in_radius', {
        user_lat: userLat,
        user_lng: userLng,
        target_lat: targetLat,
        target_lng: targetLng,
        max_radius_km: radiusKm
    });

    if (error) {
        // 서버 함수 실패시 클라이언트에서 계산
        const distance = calculateDistanceKm(userLat, userLng, targetLat, targetLng);
        return distance <= radiusKm;
    }

    return data === true;
}

/**
 * 사용자의 쿠폰 획득 횟수 확인
 */
export async function getUserCouponCount(
    couponId: string,
    userId: string
): Promise<number> {
    const client = createPostgrestClient();
    const { data, error } = await client.rpc('get_user_coupon_count', {
        p_coupon_id: couponId,
        p_user_id: userId
    });

    if (error) {
        // 직접 쿼리
        const { count } = await client
            .from('coupon_issues')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', couponId)
            .eq('user_id', userId)
            .in('status', ['active', 'used']);
        return count || 0;
    }

    return data || 0;
}

/**
 * 쿠폰 발행 현황 확인
 */
export async function getCouponIssueCount(couponId: string): Promise<{
    total_issued: number;
    total_used: number;
    total_active: number;
}> {
    const client = createPostgrestClient();
    const { data, error } = await client.rpc('get_coupon_issue_count', {
        p_coupon_id: couponId
    });

    if (error || !data || data.length === 0) {
        return { total_issued: 0, total_used: 0, total_active: 0 };
    }

    return data[0];
}

/**
 * 중복 획득 검증
 */
export async function checkDuplicateClaim(
    couponId: string,
    userId: string,
    perUserLimit: number = 1
): Promise<{ isDuplicate: boolean; currentCount: number }> {
    const count = await getUserCouponCount(couponId, userId);
    return {
        isDuplicate: count >= perUserLimit,
        currentCount: count
    };
}

/**
 * 수량 검증
 */
export async function checkQuantityAvailable(
    couponId: string,
    totalIssuable: number | null
): Promise<{ isAvailable: boolean; issued: number; remaining: number | null }> {
    if (totalIssuable === null || totalIssuable === undefined) {
        return { isAvailable: true, issued: 0, remaining: null };
    }

    const { total_issued } = await getCouponIssueCount(couponId);
    const remaining = totalIssuable - total_issued;

    return {
        isAvailable: remaining > 0,
        issued: total_issued,
        remaining
    };
}

/**
 * 쿠폰 코드 생성
 */
export function generateCouponCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * 만료일 계산
 */
export function calculateExpiryDate(validDays: number = 7): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + validDays);
    return expiry.toISOString();
}

/**
 * 할인 금액 계산
 */
export function calculateDiscount(
    orderAmount: number,
    discountType: 'percent' | 'amount',
    discountValue: number,
    maxDiscountAmount?: number | null,
    minOrderAmount?: number | null
): { discountApplied: number; isValid: boolean; reason?: string } {
    // 최소 주문 금액 체크
    if (minOrderAmount && orderAmount < minOrderAmount) {
        return {
            discountApplied: 0,
            isValid: false,
            reason: `최소 주문 금액 ${minOrderAmount.toLocaleString()}원 이상이어야 합니다.`
        };
    }

    let discountApplied: number;

    if (discountType === 'percent') {
        discountApplied = Math.floor(orderAmount * (discountValue / 100));
        // 최대 할인 금액 적용
        if (maxDiscountAmount && discountApplied > maxDiscountAmount) {
            discountApplied = maxDiscountAmount;
        }
    } else {
        discountApplied = discountValue;
    }

    // 주문 금액보다 할인이 클 수 없음
    if (discountApplied > orderAmount) {
        discountApplied = orderAmount;
    }

    return {
        discountApplied,
        isValid: true
    };
}

/**
 * 쿠폰 로그 기록
 */
export async function logCouponAction(
    couponIssueId: string,
    action: 'claimed' | 'used' | 'expired' | 'cancelled',
    actorId?: string,
    actorType?: 'consumer' | 'merchant' | 'admin' | 'system',
    location?: { lat: number; lng: number },
    notes?: string
): Promise<void> {
    const client = createPostgrestClient();
    await client.from('coupon_logs').insert({
        coupon_issue_id: couponIssueId,
        action,
        actor_id: actorId,
        actor_type: actorType || 'system',
        location_lat: location?.lat,
        location_lng: location?.lng,
        notes
    });
}
