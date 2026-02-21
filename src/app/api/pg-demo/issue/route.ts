import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, coupon_id } = body;

    if (!user_id || !coupon_id) {
      return NextResponse.json({ error: 'user_id, coupon_id 필수' }, { status: 400 });
    }

    const client = createPostgrestClient();

    // 1. 쿠폰 존재 확인
    const { data: coupon, error: cErr } = await client
      .from('coupons')
      .select('*')
      .eq('id', coupon_id)
      .eq('is_active', true)
      .eq('approval_status', 'APPROVED')
      .single();

    if (cErr || !coupon) {
      return NextResponse.json({ error: '유효한 쿠폰이 아닙니다' }, { status: 404 });
    }

    // 2. 중복 발급 확인
    const { data: existing } = await client
      .from('coupon_issues')
      .select('id')
      .eq('user_id', user_id)
      .eq('coupon_id', coupon_id)
      .eq('status', 'ISSUED')
      .eq('is_used', false);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: '이미 발급된 쿠폰입니다' }, { status: 400 });
    }

    // 3. coupon_issues에 발급
    const code = 'DEMO-' + Date.now().toString(36).toUpperCase();
    const { data: issue, error: iErr } = await client
      .from('coupon_issues')
      .insert({
        coupon_id,
        user_id,
        issued_from: 'admin',
        status: 'ISSUED',
        is_used: false,
        code,
      })
      .select('id, code')
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 500 });
    }

    // 4. pg_demo_wallets 쿠폰 카운트 증가
    let { data: wallet } = await client
      .from('pg_demo_wallets')
      .select('id, total_coupon_count')
      .eq('user_id', user_id)
      .single();

    if (!wallet) {
      const { data: newWallet } = await client
        .from('pg_demo_wallets')
        .insert({ user_id, total_points: 0, total_coupon_count: 1 })
        .select('id, total_coupon_count')
        .single();
      wallet = newWallet;
    } else {
      await client
        .from('pg_demo_wallets')
        .update({
          total_coupon_count: (wallet.total_coupon_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id);
    }

    // 5. pg_demo_transactions 기록
    if (wallet) {
      await client.from('pg_demo_transactions').insert({
        wallet_id: wallet.id,
        user_id,
        tx_type: 'coupon_issue',
        amount_points: 0,
        related_coupon_issue_id: issue?.id,
        note: `쿠폰 발급: ${coupon.title}`,
      });
    }

    // 6. event_logs
    await client.from('event_logs').insert({
      event_type: 'COUPON_ISSUED',
      actor_id: user_id,
      actor_type: 'USER',
      target_type: 'coupon_issue',
      target_id: issue?.id,
      details: { coupon_id, coupon_title: coupon.title, code },
    });

    return NextResponse.json({
      success: true,
      issue: {
        id: issue?.id,
        coupon_id,
        coupon_title: coupon.title,
        code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
    });
  } catch (err: any) {
    console.error('[pg-demo/issue] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
