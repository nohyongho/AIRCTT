import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * GET /api/pg-demo/coupons
 * 발급 가능한 쿠폰 목록 조회 (순환구조 Step 1)
 */
export async function GET() {
  try {
    const client = createPostgrestClient();

    const { data: coupons, error } = await client
      .from('coupons')
      .select('id, title, description, discount_type, discount_value, min_order_amount, max_uses, current_uses, status, expires_at')
      .in('status', ['active', 'ACTIVE'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 만료 안 된 것만 필터
    const now = new Date();
    const activeCoupons = (coupons || []).filter((c: any) => {
      if (!c.expires_at) return true;
      return new Date(c.expires_at) > now;
    });

    return NextResponse.json({
      success: true,
      coupons: activeCoupons,
      total: activeCoupons.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
