import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * GET /api/pg-demo/wallet?consumer_id=xxx
 * 지갑 조회 (순환구조 Step 2)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const consumerId = searchParams.get('consumer_id');

    if (!consumerId) {
      return NextResponse.json({ error: 'consumer_id 필수' }, { status: 400 });
    }

    const client = createPostgrestClient();

    // 1. 지갑
    const { data: wallet } = await client
      .from('wallets')
      .select('id, total_points, total_coupon_count')
      .eq('consumer_id', consumerId)
      .single();

    // 2. 보유 쿠폰 (ISSUED/active → 사용가능, USED/used → 사용됨)
    const { data: issues } = await client
      .from('coupon_issues')
      .select('id, coupon_id, status, issued_at, used_at, redeemed_at, coupons(title, description, discount_type, discount_value)')
      .eq('consumer_id', consumerId)
      .order('issued_at', { ascending: false })
      .limit(50);

    const activeCoupons = (issues || []).filter(
      (i: any) => i.status === 'ISSUED' || i.status === 'active'
    );
    const usedCoupons = (issues || []).filter(
      (i: any) => i.status === 'USED' || i.status === 'used' || i.status === 'REDEEMED'
    );

    // 3. 최근 거래 내역
    const { data: txs } = await client
      .from('wallet_transactions')
      .select('id, tx_type, amount_points, note, created_at')
      .eq('wallet_id', wallet?.id || '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet?.id,
        points: wallet?.total_points || 0,
        coupon_count: wallet?.total_coupon_count || 0,
      },
      coupons: {
        active: activeCoupons,
        used: usedCoupons,
        total_active: activeCoupons.length,
        total_used: usedCoupons.length,
      },
      recent_transactions: txs || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
