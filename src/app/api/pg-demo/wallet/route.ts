import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id 필수' }, { status: 400 });
    }

    const client = createPostgrestClient();

    // 1. 지갑 조회
    const { data: wallet } = await client
      .from('pg_demo_wallets')
      .select('id, total_points, total_coupon_count')
      .eq('user_id', userId)
      .single();

    // 2. 활성 쿠폰 목록
    const { data: activeCoupons } = await client
      .from('coupon_issues')
      .select('id, coupon_id, code, status, is_used, created_at, coupons(title, discount_type, discount_value, asset_url)')
      .eq('user_id', userId)
      .eq('status', 'ISSUED')
      .eq('is_used', false);

    // 3. 최근 거래 내역
    const { data: transactions } = await client
      .from('pg_demo_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      wallet: wallet || { total_points: 0, total_coupon_count: 0 },
      active_coupons: activeCoupons || [],
      recent_transactions: transactions || [],
    });
  } catch (err: any) {
    console.error('[pg-demo/wallet] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
