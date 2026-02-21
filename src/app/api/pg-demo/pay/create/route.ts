import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * POST /api/pg-demo/pay/create
 * 다우데이터 결제 요청 생성 (순환구조 Step 3)
 *
 * 기존 payments 테이블에 payment_type='pg_demo'로 구분해서 삽입.
 * 기존 토스 결제와 완전히 분리됨.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      consumer_id,
      store_id,
      coupon_issue_id,
      amount,
      discount_amount,
      payment_method, // 'card' | 'bank_transfer' | 'vbank' | 'kakao_pay'
      order_items,
      merchant_id,
    } = body;

    if (!consumer_id || !amount) {
      return NextResponse.json({ error: 'consumer_id, amount 필수' }, { status: 400 });
    }

    const client = createPostgrestClient();
    const finalAmount = amount - (discount_amount || 0);

    // PG 주문번호 생성
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const pgOrderId = `DAOU_${ts}_${rand}`;

    // merchant_id 결정: 입력값 또는 store에서 가져오기
    let mId = merchant_id;
    if (!mId && store_id) {
      const { data: store } = await client
        .from('stores')
        .select('merchant_id')
        .eq('id', store_id)
        .single();
      mId = store?.merchant_id;
    }

    // 기존 payments에 아무 merchant라도 있으면 넣어야 FK 통과
    if (!mId) {
      const { data: anyMerchant } = await client
        .from('merchants')
        .select('id')
        .limit(1)
        .single();
      mId = anyMerchant?.id;
    }

    if (!mId) {
      return NextResponse.json({ error: '가맹점 정보가 필요합니다' }, { status: 400 });
    }

    // payments 생성 (기존 테이블, payment_type으로 구분)
    const { data: payment, error } = await client
      .from('payments')
      .insert({
        merchant_id: mId,
        store_id: store_id || null,
        consumer_id,
        payment_type: 'pg_demo',
        amount,
        discount_amount: discount_amount || 0,
        final_amount: finalAmount,
        payment_method: payment_method || 'card',
        pg_provider: 'daoudata',
        pg_order_id: pgOrderId,
        pg_merchant_id: 'a0000000-0000-0000-0000-000000000001',
        coupon_issue_id: coupon_issue_id || null,
        status: 'pending',
        metadata: {
          demo: true,
          order_items: order_items || [],
          daou_mid: process.env.DAOU_MID || 'DAOU_SANDBOX_001',
        },
      })
      .select('id, pg_order_id, status')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // event_logs
    await client.from('event_logs').insert({
      event_type: 'PAYMENT_CREATED',
      actor_id: consumer_id,
      actor_type: 'USER',
      target_type: 'payment',
      target_id: payment.id,
      details: {
        pg_order_id: pgOrderId,
        amount, discount_amount, final_amount: finalAmount,
        payment_method, coupon_issue_id, order_items,
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        pg_order_id: pgOrderId,
        amount,
        discount_amount: discount_amount || 0,
        final_amount: finalAmount,
        status: 'pending',
        payment_method,
      },
      // 모의 결제 게이트웨이 URL
      gateway_url: `/pg-demo/gateway?payment_id=${payment.id}&amount=${finalAmount}&method=${payment_method || 'card'}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
