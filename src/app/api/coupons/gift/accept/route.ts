import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * POST /api/coupons/gift/accept
 * 선물 수락 API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gift_token, receiver_id } = body;

    if (!gift_token || !receiver_id) {
      return NextResponse.json(
        { success: false, error: 'gift_token과 receiver_id가 필요합니다.' },
        { status: 400 }
      );
    }

    const postgrest = createPostgrestClient();

    // DB 함수 호출
    const { data, error } = await postgrest.rpc('accept_gift', {
      p_gift_token: gift_token,
      p_receiver_id: receiver_id,
    });

    if (error) {
      console.error('Accept gift RPC error:', error);

      // 폴백: 직접 처리
      return await acceptGiftFallback(postgrest, gift_token, receiver_id);
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'ACCEPT_FAILED' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      issue_id: data.issue_id,
      title: data.title,
      discount_value: data.discount_value,
    });
  } catch (error) {
    console.error('Accept gift API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function acceptGiftFallback(
  postgrest: ReturnType<typeof createPostgrestClient>,
  giftToken: string,
  receiverId: string
) {
  // 1. 선물 쿠폰 확인
  const { data: issue } = await postgrest
    .from('coupon_issues')
    .select('*')
    .eq('gift_token', giftToken)
    .eq('status', 'active')
    .single();

  if (!issue || (issue.gift_expires_at && new Date(issue.gift_expires_at) < new Date())) {
    return NextResponse.json(
      { success: false, error: 'GIFT_NOT_FOUND_OR_EXPIRED' },
      { status: 404 }
    );
  }

  if (issue.user_id === receiverId) {
    return NextResponse.json(
      { success: false, error: 'CANNOT_GIFT_SELF' },
      { status: 400 }
    );
  }

  // 2. 쿠폰 정보
  const { data: coupon } = await postgrest
    .from('coupons')
    .select('*')
    .eq('id', issue.coupon_id)
    .single();

  if (!coupon) {
    return NextResponse.json(
      { success: false, error: 'COUPON_NOT_FOUND' },
      { status: 404 }
    );
  }

  // 3. 수신자 기존 보유 확인 (coupon_group_key 정책)
  if (coupon.coupon_group_key) {
    const { data: existing } = await postgrest
      .from('coupon_issues')
      .select('id, coupon_id')
      .eq('user_id', receiverId)
      .eq('coupon_group_key', coupon.coupon_group_key)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      const { data: existCoupon } = await postgrest
        .from('coupons')
        .select('discount_type, discount_value')
        .eq('id', existing.coupon_id)
        .single();

      if (existCoupon && existCoupon.discount_value >= coupon.discount_value
          && existCoupon.discount_type === coupon.discount_type) {
        return NextResponse.json(
          { success: false, error: 'RECEIVER_HAS_BETTER', existing_discount: existCoupon.discount_value },
          { status: 400 }
        );
      }

      // 기존 REPLACED
      await postgrest.from('coupon_issues').update({ status: 'cancelled' }).eq('id', existing.id);
    }
  }

  // 4. 송신자 쿠폰 상태 변경
  await postgrest.from('coupon_issues').update({
    status: 'cancelled',
    gifted_to: receiverId,
  }).eq('id', issue.id);

  // 5. 수신자에게 새 쿠폰 발행
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

  const { data: newIssue } = await postgrest
    .from('coupon_issues')
    .insert({
      coupon_id: issue.coupon_id,
      user_id: receiverId,
      code,
      coupon_code: issue.coupon_code,
      status: 'active',
      issued_at: new Date().toISOString(),
      expires_at: issue.expires_at,
      claimed_via: 'share',
      coupon_group_key: coupon.coupon_group_key,
      gifted_from: issue.user_id,
    })
    .select()
    .single();

  // 6. 이벤트
  await postgrest.from('coupon_events').insert({
    user_id: receiverId,
    coupon_id: issue.coupon_id,
    coupon_issue_id: newIssue?.id,
    event_type: 'GIFT_ACCEPTED',
    meta: { from_user: issue.user_id, original_issue: issue.id },
  });

  return NextResponse.json({
    success: true,
    issue_id: newIssue?.id,
    title: coupon.title,
    discount_value: coupon.discount_value,
  });
}
