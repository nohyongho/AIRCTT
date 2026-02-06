// GET /api/ctt/coupons/[id] - 쿠폰 상세 조회

import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const client = createPostgrestClient();

        const { data: coupon, error } = await client
            .from('coupons')
            .select(`
                *,
                stores (
                    id,
                    name,
                    address,
                    lat,
                    lng,
                    phone,
                    opening_hours
                )
            `)
            .eq('id', id)
            .single();

        if (error || !coupon) {
            return NextResponse.json(
                { error: 'Coupon not found' },
                { status: 404 }
            );
        }

        // 발행 통계 조회
        const { data: stats } = await client.rpc('get_coupon_issue_count', {
            p_coupon_id: id
        });

        const issueStats = stats?.[0] || { total_issued: 0, total_used: 0, total_active: 0 };

        return NextResponse.json({
            coupon,
            stats: {
                issued: issueStats.total_issued,
                used: issueStats.total_used,
                active: issueStats.total_active,
                remaining: coupon.total_issuable
                    ? coupon.total_issuable - issueStats.total_issued
                    : null
            }
        });

    } catch (error: any) {
        console.error('Coupon detail error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
