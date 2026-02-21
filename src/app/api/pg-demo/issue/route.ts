import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * POST /api/pg-demo/issue
 * 쿠폰 발급 (순환구조 Step 1→2)
 *
 * 기존 coupon_issues + wallets 테이블 사용
 * consumer_id 기반 (user_id 아님)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { consumer_id, coupon_id } = body;

    if (!consumer_id || !coupon_id) {
      return NextResponse.json(
        { error: 'consumer_id, coupon_id 필수' },
        { status: 400 }
      );
    }

    const client = createPostgrestClient();

    // 1. 쿠폰 확인
    const { data: coupon, error: cErr } = await client
      .from('coupons')
      .select('*')
      .eq('id', coupon_id)
      .single();

    if (cErr || !coupon) {
      return NextResponse.json({ error: '쿠폰을 찾을 수 없습니다' }, { status: 404 });
    }

    // 2. 중복 발급 체크
    const { data: existing } = await client
      .from('coupon_issues')
      .select('id')
      .eq('consumer_id', consumer_id)
      .eq('coupon_id', coupon_id)
      .in('status', ['ISSUED', 'active'])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: '이미 발급된 쿠폰입니다', coupon_issue_id: existing[0].id },
        { status: 409 }
      );
    }

    // 3. coupon_issues 생성
    const { data: issue, error: iErr } = await client
      .from('coupon_issues')
      .insert({
        consumer_id,
        coupon_id,
        status: 'ISSUED',
        issued_at: new Date().toISOString(),
        issued_reason: 'PG_DEMO',
      })
      .select('id, status, issued_at')
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 500 });
    }

    // 4. wallet 쿠폰 카운트 증가
    const { data: wallet } = await client
      .from('wallets')
      .select('id, total_coupon_count')
      .eq('consumer_id', consumer_id)
      .single();

    if (wallet) {
      await client
        .from('wallets')
        .update({
          total_coupon_count: (wallet.total_coupon_count || 0) + 1,
        })
        .eq('id', wallet.id);

      // wallet_transactions 기록
      await client.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        tx_type: 'coupon_issue',
        amount_points: 0,
        related_coupon_issue_id: issue.id,
        note: `쿠폰 발급: ${coupon.title || coupon_id}`,
      });
    }

    // 5. event_logs
    await client.from('event_logs').insert({
      event_type: 'COUPON_ISSUED',
      actor_id: consumer_id,
      actor_type: 'USER',
      target_type: 'coupon_issue',
      target_id: issue.id,
      details: {
        coupon_id,
        coupon_title: coupon.title,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
    });

    return NextResponse.json({
      success: true,
      coupon_issue: {
        id: issue.id,
        coupon_id,
        coupon_title: coupon.title,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        status: 'ISSUED',
        issued_at: issue.issued_at,
      },
      message: '쿠폰이 발급되었습니다! 🎉',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
