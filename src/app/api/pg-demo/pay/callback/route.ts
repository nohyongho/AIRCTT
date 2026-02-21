import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * POST /api/pg-demo/pay/callback
 * 다우데이터 결제 결과 처리 (순환구조 Step 3→4)
 *
 * 결제 성공시:
 *  1. payments.status → 'paid'
 *  2. coupon_issues.status → 'USED' (기존 패턴) + used_at
 *  3. wallets 쿠폰 카운트 감소
 *  4. wallet_transactions 기록
 *  5. event_logs 기록
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payment_id, result } = body;
    // result: 'SUCCESS' | 'FAIL' | 'CANCEL'

    if (!payment_id || !result) {
      return NextResponse.json({ error: 'payment_id, result 필수' }, { status: 400 });
    }

    const client = createPostgrestClient();

    // 1. 결제 조회
    const { data: payment, error: pErr } = await client
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (pErr || !payment) {
      return NextResponse.json({ error: '결제를 찾을 수 없습니다' }, { status: 404 });
    }

    if (payment.status !== 'pending' && payment.status !== 'ready') {
      return NextResponse.json(
        { error: `처리 불가 상태: ${payment.status}` },
        { status: 400 }
      );
    }

    const txId = `DAOU_MOCK_${Date.now()}`;

    if (result === 'SUCCESS') {
      // ====== 결제 성공 ======

      // 1) payments → paid
      await client
        .from('payments')
        .update({
          status: 'paid',
          pg_transaction_id: txId,
          card_company: body.card_company || '신한카드',
          card_number: body.card_number || '1234-****-****-5678',
          installment_months: body.installment_months || 0,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment_id);

      // 2) 쿠폰 사용 처리 (ISSUED → USED)
      if (payment.coupon_issue_id) {
        await client
          .from('coupon_issues')
          .update({
            status: 'USED',
            used_at: new Date().toISOString(),
            redeemed_at: new Date().toISOString(),
            payment_id: payment_id,
            used_store_id: payment.store_id,
          })
          .eq('id', payment.coupon_issue_id);

        // 3) 지갑 쿠폰 카운트 감소
        if (payment.consumer_id) {
          const { data: wallet } = await client
            .from('wallets')
            .select('id, total_coupon_count')
            .eq('consumer_id', payment.consumer_id)
            .single();

          if (wallet) {
            await client
              .from('wallets')
              .update({
                total_coupon_count: Math.max(0, (wallet.total_coupon_count || 0) - 1),
              })
              .eq('id', wallet.id);

            // 4) wallet_transactions 기록
            await client.from('wallet_transactions').insert({
              wallet_id: wallet.id,
              tx_type: 'coupon_use',
              amount_points: 0,
              related_coupon_issue_id: payment.coupon_issue_id,
              note: `쿠폰 사용 (결제 ${payment.pg_order_id})`,
            });
          }
        }

        // event_logs: 쿠폰 사용
        await client.from('event_logs').insert({
          event_type: 'COUPON_REDEEMED',
          actor_id: payment.consumer_id,
          actor_type: 'SYSTEM',
          target_type: 'coupon_issue',
          target_id: payment.coupon_issue_id,
          details: {
            payment_id,
            pg_order_id: payment.pg_order_id,
            discount_amount: payment.discount_amount,
          },
        });
      }

      // event_logs: 결제 성공
      await client.from('event_logs').insert({
        event_type: 'PAYMENT_APPROVED',
        actor_id: payment.consumer_id,
        actor_type: 'SYSTEM',
        target_type: 'payment',
        target_id: payment_id,
        details: {
          pg_order_id: payment.pg_order_id,
          pg_transaction_id: txId,
          final_amount: payment.final_amount,
          payment_method: payment.payment_method,
        },
      });

      return NextResponse.json({
        success: true,
        status: 'paid',
        message: '결제가 완료되었습니다! ✅',
        payment: {
          id: payment_id,
          pg_order_id: payment.pg_order_id,
          final_amount: payment.final_amount,
          pg_transaction_id: txId,
        },
      });
    } else {
      // ====== 결제 실패/취소 ======
      const newStatus = result === 'CANCEL' ? 'cancelled' : 'failed';

      await client
        .from('payments')
        .update({
          status: newStatus,
          [result === 'CANCEL' ? 'metadata' : 'failed_at']:
            result === 'CANCEL'
              ? { ...payment.metadata, cancel_reason: '사용자 취소' }
              : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment_id);

      await client.from('event_logs').insert({
        event_type: result === 'CANCEL' ? 'PAYMENT_CANCELED' : 'PAYMENT_FAILED',
        actor_id: payment.consumer_id,
        actor_type: 'SYSTEM',
        target_type: 'payment',
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
