// POST /api/ctt/coupons/[id]/claim - 쿠폰 획득

import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';
import {
    checkInRadius,
    checkDuplicateClaim,
    checkQuantityAvailable,
    generateCouponCode,
    calculateExpiryDate,
    logCouponAction
} from '@/lib/coupon-logic';
import type { ClaimCouponRequest, CouponIssue } from '@/types/coupon';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: couponId } = await params;
        const body: ClaimCouponRequest = await request.json();
        const { user_id, lat, lng, claimed_via = 'list' } = body;

        // 필수 파라미터 검증
        if (!user_id) {
            return NextResponse.json(
                { error: 'user_id is required' },
                { status: 400 }
            );
        }

        if (!lat || !lng) {
            return NextResponse.json(
                { error: 'Location (lat, lng) is required' },
                { status: 400 }
            );
        }

        const client = createPostgrestClient();

        // 1. 쿠폰 조회
        const { data: coupon, error: couponError } = await client
            .from('coupons')
            .select(`
                *,
                stores (
                    id,
                    lat,
                    lng
                )
            `)
            .eq('id', couponId)
            .eq('is_active', true)
            .single();

        if (couponError || !coupon) {
            return NextResponse.json(
                { error: 'Coupon not found or inactive' },
                { status: 404 }
            );
        }

        // 2. 유효기간 검증
        const now = new Date();
        if (coupon.valid_from && new Date(coupon.valid_from) > now) {
            return NextResponse.json(
                { error: 'Coupon is not yet valid' },
                { status: 422 }
            );
        }
        if (coupon.valid_to && new Date(coupon.valid_to) < now) {
            return NextResponse.json(
                { error: 'Coupon has expired' },
                { status: 410 }
            );
        }

        // 3. 위치 검증
        const targetLat = coupon.center_lat || coupon.stores?.lat;
        const targetLng = coupon.center_lng || coupon.stores?.lng;
        const radiusKm = coupon.radius_km || 1;

        if (targetLat && targetLng) {
            const isInRange = await checkInRadius(lat, lng, targetLat, targetLng, radiusKm);
            if (!isInRange) {
                return NextResponse.json(
                    { error: 'Out of coupon range', radius_km: radiusKm },
                    { status: 422 }
                );
            }
        }

        // 4. 중복 획득 검증
        const perUserLimit = coupon.per_user_limit || 1;
        const { isDuplicate, currentCount } = await checkDuplicateClaim(
            couponId,
            user_id,
            perUserLimit
        );

        if (isDuplicate) {
            return NextResponse.json(
                {
                    error: 'Already claimed maximum times',
                    limit: perUserLimit,
                    current: currentCount
                },
                { status: 403 }
            );
        }

        // 5. 수량 검증
        const { isAvailable, remaining } = await checkQuantityAvailable(
            couponId,
            coupon.total_issuable
        );

        if (!isAvailable) {
            return NextResponse.json(
                { error: 'Coupon sold out' },
                { status: 410 }
            );
        }

        // 6. 쿠폰 발행
        const code = generateCouponCode();
        const expiresAt = calculateExpiryDate(7); // 7일 유효

        const { data: issue, error: issueError } = await client
            .from('coupon_issues')
            .insert({
                coupon_id: couponId,
                user_id,
                code,
                status: 'active',
                issued_at: new Date().toISOString(),
                expires_at: expiresAt,
                claimed_lat: lat,
                claimed_lng: lng,
                claimed_via,
                issued_from: 'event'
            })
            .select()
            .single();

        if (issueError) {
            // 유니크 제약 위반 = 동시 중복 요청
            if (issueError.code === '23505') {
                return NextResponse.json(
                    { error: 'Already claimed' },
                    { status: 403 }
                );
            }
            throw issueError;
        }

        // 7. 로그 기록
        await logCouponAction(
            issue.id,
            'claimed',
            user_id,
            'consumer',
            { lat, lng }
        );

        return NextResponse.json({
            success: true,
            issue: issue as CouponIssue,
            remaining: remaining !== null ? remaining - 1 : null
        });

    } catch (error: any) {
        console.error('Claim coupon error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
