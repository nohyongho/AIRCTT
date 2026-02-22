import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      coupon_issue_id,
      amount,
      discount_amount = 0,
      payment_method = 'card',
    } = body;

    if (!user_id || !amount) {
      return NextResponse.json({ error: 'user_id, amount 필수' }, { status: 400 });
    }

    const client = createPostgrestClient();

    // 쿠폰 유효성 확인 (있는 경우)
    if (coupon_issue_id) {
      const { data: ci } = await client
        .from('coupon_issues')
        .select('id, status, is_used')
        .eq('id', coupon_issue_id)
        .single();

      if (!ci || ci.status !== 'ISSUED' || ci.is_used) {
        return NextResponse.json({ error: '사용할 수 없는 쿠폰입니다' }, { status: 400 });
      }
    }

    const finalAmount = Math.max(0, amount - discount_amount);
    const pgOrderId = 'PG_DEMO_' + Date.now();

    // pg_demo_payments 생성
    const { data: payment, error: pErr } = await client
      .from('pg_demo_payments')
      .insert({
        user_id,
        coupon_issue_id: coupon_issue_id || null,
        pg_order_id: pgOrderId,
        amount,
        discount_amount,
        final_amount: finalAmount,
        payment_method,
        status: 'pending',
      })
      .select('id')
      .single();

    if (pErr || !payment) {
      return NextResponse.json({ error: pErr?.message || '결제 생성 실패' }, { status: 500 });
    }

    // event_logs
    await client.from('event_logs').insert({
      event_type: 'PAYMENT_CREATED',
      actor_id: user_id,
      actor_type: 'USER',
      target_type: 'pg_demo_payment',
      target_id: payment.id,
      details: { pg_order_id: pgOrderId, amount, discount_amount, final_amount: finalAmount },
    });

    // 모의 PG 게이트웨이 URL
    const gatewayUrl = `/pg-demo/gateway?payment_id=${payment.id}&amount=${finalAmount}&method=${payment_method}`;

    return NextResponse.json({
      success: true,
      payment_id: payment.id,
      pg_order_id: pgOrderId,
      final_amount: finalAmount,
      gateway_url: gatewayUrl,
    });
  } catch (err: any) {
    console.error('[pg-demo/pay/create] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
