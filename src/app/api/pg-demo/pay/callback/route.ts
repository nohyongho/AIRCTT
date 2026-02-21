import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payment_id, result } = body;

    if (!payment_id || !result) {
      return NextResponse.json({ error: 'payment_id, result 필수' }, { status: 400 });
    }

    const client = createPostgrestClient();

    // 1. 결제 조회
    const { data: payment, error: pErr } = await client
      .from('pg_demo_payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (pErr || !payment) {
      return NextResponse.json({ error: '결제를 찾을 수 없습니다' }, { status: 404 });
    }

    if (payment.status !== 'pending') {
      return NextResponse.json({ error: `이미 처리된 결제: ${payment.status}` }, { status: 400 });
    }

    const txId = 'DAOU_MOCK_' + Date.now();

    if (result === 'SUCCESS') {
      // === 결제 성공 ===

      // 1) pg_demo_payments → approved
      await client
        .from('pg_demo_payments')
        .update({
          status: 'approved',
          pg_transaction_id: txId,
          card_company: body.card_company || '신한카드',
          card_number: body.card_number || '1234-****-****-5678',
          installment_months: body.installment_months || 0,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment_id);

      // 2) 쿠폰 사용 처리
      if (payment.coupon_issue_id) {
        await client
          .from('coupon_issues')
          .update({
            status: 'USED',
            is_used: true,
            used_at: new Date().toISOString(),
            redeemed_at: new Date().toISOString(),
            payment_id: payment_id,
          })
          .eq('id', payment.coupon_issue_id);

        // 3) 지갑 쿠폰 카운트 감소
        const { data: wallet } = await client
          .from('pg_demo_wallets')
          .select('id, total_coupon_count')
          .eq('user_id', payment.user_id)
          .single();

        if (wallet) {
          await client
            .from('pg_demo_wallets')
            .update({ total_coupon_count: Math.max(0, (wallet.total_coupon_count || 0) - 1), updated_at: new Date().toISOString() })
            .eq('id', wallet.id);

          // 4) 거래 기록
          await client.from('pg_demo_transactions').insert({
            wallet_id: wallet.id,
            user_id: payment.user_id,
            tx_type: 'coupon_use',
            amount_points: 0,
            related_coupon_issue_id: payment.coupon_issue_id,
            related_payment_id: payment_id,
            note: `쿠폰 사용 결제 (${payment.pg_order_id})`,
          });
        }

        // event_logs: 쿠폰 사용
        await client.from('event_logs').insert({
          event_type: 'COUPON_REDEEMED',
          actor_id: payment.user_id,
          actor_type: 'SYSTEM',
          target_type: 'coupon_issue',
          target_id: payment.coupon_issue_id,
          details: { payment_id, pg_order_id: payment.pg_order_id, discount_amount: payment.discount_amount },
        });
      }

      // event_logs: 결제 성공
      await client.from('event_logs').insert({
        event_type: 'PAYMENT_APPROVED',
        actor_id: payment.user_id,
        actor_type: 'SYSTEM',
        target_type: 'pg_demo_payment',
        target_id: payment_id,
        details: { pg_order_id: payment.pg_order_id, pg_transaction_id: txId, final_amount: payment.final_amount },
      });

      return NextResponse.json({
        success: true,
        status: 'approved',
        message: '결제가 완료되었습니다!',
        payment: { id: payment_id, pg_order_id: payment.pg_order_id, final_amount: payment.final_amount, pg_transaction_id: txId },
      });

    } else {
      // === 결제 실패/취소 ===
      const newStatus = result === 'CANCEL' ? 'cancelled' : 'failed';

      await client
        .from('pg_demo_payments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', payment_id);

      await client.from('event_logs').insert({
        event_type: result === 'CANCEL' ? 'PAYMENT_CANCELED' : 'PAYMENT_FAILED',
        actor_id: payment.user_id,
        actor_type: 'SYSTEM',
        target_type: 'pg_demo_payment',
        target_id: payment_id,
        details: { pg_order_id: payment.pg_order_id, reason: result },
      });

      return NextResponse.json({
        success: false,
        status: newStatus,
        message: result === 'CANCEL' ? '결제가 취소되었습니다' : '결제에 실패했습니다',
      });
    }
  } catch (err: any) {
    console.error('[pg-demo/pay/callback] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
