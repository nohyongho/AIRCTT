import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * POST /api/pg-demo/login
 * 데모용 간편 로그인 (순환구조 Step 1 준비)
 *
 * 고정 데모 사용자 UUID를 사용하여 consumer + wallet 보장
 */
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000099';

export async function POST() {
  try {
    const client = createPostgrestClient();

    // 1. users 확인/생성
    const { data: existingUser } = await client
      .from('users')
      .select('id')
      .eq('id', DEMO_USER_ID)
      .single();

    if (!existingUser) {
      await client.from('users').insert({
        id: DEMO_USER_ID,
        full_name: '데모 사용자',
        phone: '010-0000-0099',
        role: 'consumer',
      });
    }

    // 2. consumers 확인/생성
    let { data: consumer } = await client
      .from('consumers')
      .select('id')
      .eq('user_id', DEMO_USER_ID)
      .single();

    if (!consumer) {
      const { data: newConsumer } = await client
        .from('consumers')
        .insert({
          user_id: DEMO_USER_ID,
          nickname: '데모 사용자',
          phone: '010-0000-0099',
        })
        .select('id')
        .single();
      consumer = newConsumer;
    }

    if (!consumer) {
      return NextResponse.json({ error: 'consumer 생성 실패' }, { status: 500 });
    }

    // 3. wallets 확인/생성
    let { data: wallet } = await client
      .from('wallets')
      .select('id, total_points, total_coupon_count')
      .eq('consumer_id', consumer.id)
      .single();

    if (!wallet) {
      const { data: newWallet } = await client
        .from('wallets')
        .insert({
          consumer_id: consumer.id,
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
        consumer_id: consumer.id,
        name: '데모 사용자',
        phone: '010-0000-0099',
      },
      wallet: {
        id: wallet?.id,
        points: wallet?.total_points || 0,
        coupon_count: wallet?.total_coupon_count || 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
