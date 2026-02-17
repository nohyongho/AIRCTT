import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * POST /api/coupons/gift
 * 쿠폰 선물하기 (gift_token 생성)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coupon_issue_id, sender_id } = body;

    if (!coupon_issue_id || !sender_id) {
      return NextResponse.json(
        { success: false, error: 'coupon_issue_id와 sender_id가 필요합니다.' },
        { status: 400 }
      );
    }

    const postgrest = createPostgrestClient();

    // DB 함수 호출
    const { data, error } = await postgrest.rpc('create_gift', {
      p_coupon_issue_id: coupon_issue_id,
      p_sender_id: sender_id,
    });

    if (error) {
      console.error('Create gift RPC error:', error);

      // 폴백: 직접 처리
      return await createGiftFallback(postgrest, coupon_issue_id, sender_id);
    }

    if (!data?.success) {
      return NextResponse.json(
        { success: false, error: data?.error || 'GIFT_FAILED' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://airctt.com';

    return NextResponse.json({
      success: true,
      gift_token: data.gift_token,
      gift_url: `${appUrl}/gift/${data.gift_token}`,
      expires_at: data.expires_at,
    });
  } catch (error) {
    console.error('Gift API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function createGiftFallback(
  postgrest: ReturnType<typeof createPostgrestClient>,
  couponIssueId: string,
  senderId: string
) {
  // 1. 쿠폰 확인
  const { data: issue, error } = await postgrest
    .from('coupon_issues')
    .select('*')
    .eq('id', couponIssueId)
    .eq('user_id', senderId)
    .eq('status', 'active')
    .single();

  if (error || !issue) {
    return NextResponse.json(
      { success: false, error: 'COUPON_NOT_FOUND_OR_NOT_ACTIVE' },
      { status: 404 }
    );
  }

  // 2. 토큰 생성
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 3. 업데이트
  await postgrest
    .from('coupon_issues')
    .update({
      gift_token: token.slice(0, 64),
      gift_expires_at: expiresAt,
      gifted_from: senderId,
    })
    .eq('id', couponIssueId);

  // 4. 이벤트 기록
  await postgrest.from('coupon_events').insert({
    user_id: senderId,
    coupon_id: issue.coupon_id,
    coupon_issue_id: couponIssueId,
    event_type: 'GIFTED',
    meta: { gift_token: token.slice(0, 64) },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://airctt.com';

  return NextResponse.json({
    success: true,
    gift_token: token.slice(0, 64),
    gift_url: `${appUrl}/gift/${token.slice(0, 64)}`,
    expires_at: expiresAt,
  });
}
