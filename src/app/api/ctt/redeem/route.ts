// POST /api/ctt/redeem - 쿠폰 사용 (상점에서)

import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';
import { calculateDiscount, logCouponAction } from '@/lib/coupon-logic';
import type { RedeemCouponRequest, RedeemCouponResponse } from '@/types/coupon';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body: RedeemCouponRequest = await request.json();
        const { code, store_id, order_amount = 0 } = body;

        // 필수 파라미터 검증
        if (!code || !store_id) {
            return NextResponse.json(
                { error: 'code and store_id are required' },
                { status: 400 }
            );
        }

        const client = createPostgrestClient();

        // 1. 코드로 쿠폰 발행 조회
        const { data: issue, error: issueError } = await client
            .from('coupon_issues')
            .select(`
                *,
                coupons (
                    id,
                    store_id,
                    merchant_id,
                    discount_type,
                    discount_value,
                    max_discount_amount,
                    min_order_amount,
                    title
                )
            `)
            .eq('code', code.toUpperCase())
            .single();

        if (issueError || !issue) {
            return NextResponse.json(
                { error: 'Invalid coupon code' },
                { status: 404 }
            );
        }

        // 2. 상태 검증
        if (issue.status !== 'active') {
            const statusMessages: Record<string, string> = {
                used: 'Coupon already used',
                expired: 'Coupon has expired',
                cancelled: 'Coupon has been cancelled'
            };
            return NextResponse.json(
                { error: statusMessages[issue.status] || 'Coupon is not valid' },
                { status: 409 }
            );
        }

        // 3. 만료 검증
        if (new Date(issue.expires_at) < new Date()) {
            // 상태 업데이트
            await client
                .from('coupon_issues')
                .update({ status: 'expired' })
                .eq('id', issue.id);

            return NextResponse.json(
                { error: 'Coupon has expired' },
                { status: 410 }
            );
        }

        // 4. 상점 검증
        const coupon = issue.coupons;
        if (coupon.store_id && coupon.store_id !== store_id) {
            return NextResponse.json(
                { error: 'This coupon is not valid for this store' },
                { status: 403 }
            );
        }

        // 5. 할인 계산
        const discountResult = calculateDiscount(
            order_amount,
            coupon.discount_type,
            coupon.discount_value,
            coupon.max_discount_amount,
            coupon.min_order_amount
        );

        if (!discountResult.isValid) {
            return NextResponse.json(
                { error: discountResult.reason },
                { status: 422 }
            );
        }

        // 6. 사용 처리
        const { error: updateError } = await client
            .from('coupon_issues')
            .update({
                status: 'used',
                used_at: new Date().toISOString(),
                is_used: true
            })
            .eq('id', issue.id)
            .eq('status', 'active'); // 동시 사용 방지

        if (updateError) {
            throw updateError;
        }

        // 7. 로그 기록
        await logCouponAction(
            issue.id,
            'used',
            undefined, // merchant actor
            'merchant',
            undefined,
            `Used at store ${store_id}, discount: ${discountResult.discountApplied}`
        );

        const response: RedeemCouponResponse = {
            success: true,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            discount_applied: discountResult.discountApplied
        };

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Redeem coupon error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
