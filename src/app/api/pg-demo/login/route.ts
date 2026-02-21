import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000099';

export async function POST() {
  try {
    const client = createPostgrestClient();

    // 1. users 확인
    const { data: user } = await client
      .from('users')
      .select('id, email, name, phone')
      .eq('id', DEMO_USER_ID)
      .single();

    if (!user) {
      return NextResponse.json({ error: '데모 유저가 없습니다. seed를 먼저 실행하세요.' }, { status: 404 });
    }

    // 2. pg_demo_wallets 확인/생성
    let { data: wallet } = await client
      .from('pg_demo_wallets')
      .select('id, total_points, total_coupon_count')
      .eq('user_id', DEMO_USER_ID)
      .single();

    if (!wallet) {
      const { data: newWallet } = await client
        .from('pg_demo_wallets')
        .insert({
          user_id: DEMO_USER_ID,
          total_points: 0,
          total_coupon_count: 0,
        })
        .select('id, total_points, total_coupon_count')
        .single();
      wallet = newWallet;
    }

    return NextResponse.json({
      success: true,
      user: {
        user_id: DEMO_USER_ID,
        name: user.name,
        email: user.email,
      },
      wallet: {
        id: wallet?.id,
        points: wallet?.total_points || 0,
        coupon_count: wallet?.total_coupon_count || 0,
      },
    });
  } catch (err: any) {
    console.error('[pg-demo/login] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
