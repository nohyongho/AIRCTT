// GET /api/ctt/merchant/stats - 가맹점 쿠폰 통계

import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export const dynamic = 'force-dynamic';

interface CouponStats {
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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const merchant_id = searchParams.get('merchant_id');
        const store_id = searchParams.get('store_id');
        const coupon_id = searchParams.get('coupon_id');
        const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, all

        if (!merchant_id) {
            return NextResponse.json(
                { error: 'merchant_id is required' },
                { status: 400 }
            );
        }

        const client = createPostgrestClient();

        // 기간 필터 계산
        let dateFilter: string | null = null;
        if (period !== 'all') {
            const days = parseInt(period.replace('d', ''));
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);
            dateFilter = fromDate.toISOString();
        }

        // 1. 전체 쿠폰 목록 조회
        let couponsQuery = client
            .from('coupons')
            .select(`
                id,
                title,
                store_id,
                stores (name)
            `)
            .eq('merchant_id', merchant_id);

        if (store_id) {
            couponsQuery = couponsQuery.eq('store_id', store_id);
        }

        if (coupon_id) {
            couponsQuery = couponsQuery.eq('id', coupon_id);
        }

        const { data: coupons, error: couponsError } = await couponsQuery;

        if (couponsError) {
            throw couponsError;
        }

        if (!coupons || coupons.length === 0) {
            return NextResponse.json({
                stats: [],
                summary: {
                    total_coupons: 0,
                    total_issued: 0,
                    total_used: 0,
                    total_active: 0,
                    overall_usage_rate: 0,
                    total_discount_given: 0
                },
                period
            });
        }

        // 2. 각 쿠폰별 통계 조회
        const couponIds = coupons.map(c => c.id);

        let issuesQuery = client
            .from('coupon_issues')
            .select('*')
            .in('coupon_id', couponIds);

        if (dateFilter) {
            issuesQuery = issuesQuery.gte('created_at', dateFilter);
        }

        const { data: issues, error: issuesError } = await issuesQuery;

        if (issuesError) {
            throw issuesError;
        }

        // 3. 통계 계산
        const statsMap: Record<string, CouponStats> = {};

        coupons.forEach(coupon => {
            const storeData = coupon.stores as any;
            statsMap[coupon.id] = {
                coupon_id: coupon.id,
                title: coupon.title,
                store_name: storeData?.name || null,
                total_issued: 0,
                total_used: 0,
                total_expired: 0,
                total_active: 0,
                usage_rate: 0,
                total_discount_given: 0
            };
        });

        // 발급 내역 집계
        (issues || []).forEach(issue => {
            const stat = statsMap[issue.coupon_id];
            if (!stat) return;

            stat.total_issued++;

            switch (issue.status) {
                case 'used':
                    stat.total_used++;
                    // discount_applied가 있으면 합산
                    if (issue.discount_applied) {
                        stat.total_discount_given += issue.discount_applied;
                    }
                    break;
                case 'expired':
                    stat.total_expired++;
                    break;
                case 'active':
                    stat.total_active++;
                    break;
            }
        });

        // 사용률 계산
        Object.values(statsMap).forEach(stat => {
            if (stat.total_issued > 0) {
                stat.usage_rate = Math.round((stat.total_used / stat.total_issued) * 100);
            }
        });

        const stats = Object.values(statsMap);

        // 4. 전체 요약 계산
        const summary = {
            total_coupons: stats.length,
            total_issued: stats.reduce((sum, s) => sum + s.total_issued, 0),
            total_used: stats.reduce((sum, s) => sum + s.total_used, 0),
            total_active: stats.reduce((sum, s) => sum + s.total_active, 0),
            overall_usage_rate: 0,
            total_discount_given: stats.reduce((sum, s) => sum + s.total_discount_given, 0)
        };

        if (summary.total_issued > 0) {
            summary.overall_usage_rate = Math.round((summary.total_used / summary.total_issued) * 100);
        }

        // 5. 일별 트렌드 (최근 7일)
        const dailyTrend: { date: string; issued: number; used: number }[] = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayIssues = (issues || []).filter(issue => {
                const issueDate = new Date(issue.created_at).toISOString().split('T')[0];
                return issueDate === dateStr;
            });

            const dayUsed = (issues || []).filter(issue => {
                if (!issue.used_at) return false;
                const usedDate = new Date(issue.used_at).toISOString().split('T')[0];
                return usedDate === dateStr;
            });

            dailyTrend.push({
                date: dateStr,
                issued: dayIssues.length,
                used: dayUsed.length
            });
        }

        return NextResponse.json({
            stats,
            summary,
            daily_trend: dailyTrend,
            period
        });

    } catch (error: any) {
        console.error('Get merchant stats error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
