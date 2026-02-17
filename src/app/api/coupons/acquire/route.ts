import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * POST /api/coupons/acquire
 *
 * 게임/지도에서 쿠폰 획득 API
 * - 1인1장 + 최고할인 정책 자동 적용 (DB 함수 acquire_coupon_with_policy)
 * - coupon_group_key 기준 중복 방지
 * - 기존 보유 쿠폰보다 높은 할인이면 자동 교체
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, coupon_id, lat, lng, claimed_via = 'game' } = body;

    if (!user_id || !coupon_id) {
      return NextResponse.json(
        { success: false, error: 'user_id와 coupon_id가 필요합니다.' },
        { status: 400 }
      );
    }

    const postgrest = createPostgrestClient();

    // DB 함수 호출: acquire_coupon_with_policy
    const { data, error } = await postgrest.rpc('acquire_coupon_with_policy', {
      p_user_id: user_id,
      p_coupon_id: coupon_id,
      p_claimed_lat: lat || null,
      p_claimed_lng: lng || null,
      p_claimed_via: claimed_via,
    });

    if (error) {
      console.error('Acquire coupon error:', error);

      // DB 함수가 없는 경우 폴백 로직
      return await acquireFallback(postgrest, { user_id, coupon_id, lat, lng, claimed_via });
    }

    const result = data;

    if (!result?.success) {
      return NextResponse.json(
        { success: false, error: result?.error || 'ACQUIRE_FAILED' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action: result.action, // 'ACQUIRED' | 'MOTION_ONLY'
      data: {
        issue_id: result.issue_id,
        coupon_code: result.coupon_code,
        discount_type: result.discount_type,
        discount_value: result.discount_value,
        store_name: result.store_name,
        title: result.title,
      },
      ...(result.reason && { reason: result.reason }),
      ...(result.existing_discount && { existing_discount: result.existing_discount }),
    });
  } catch (error) {
    console.error('Acquire coupon API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DB 함수가 없을 때의 폴백 로직
 */
async function acquireFallback(
  postgrest: ReturnType<typeof createPostgrestClient>,
  params: { user_id: string; coupon_id: string; lat?: number; lng?: number; claimed_via: string }
) {
  const { user_id, coupon_id, lat, lng, claimed_via } = params;

  // 1. 쿠폰 조회
  const { data: coupon, error: couponError } = await postgrest
    .from('coupons')
    .select('*')
    .eq('id', coupon_id)
    .eq('is_active', true)
    .single();

  if (couponError || !coupon) {
    return NextResponse.json(
      { success: false, error: 'COUPON_NOT_FOUND' },
      { status: 404 }
    );
  }

  // 2. 승인 확인 (approval_status가 있는 경우)
  if (coupon.approval_status && coupon.approval_status !== 'APPROVED') {
    return NextResponse.json(
      { success: false, error: 'COUPON_NOT_APPROVED' },
      { status: 400 }
    );
  }

  // 3. coupon_group_key 기준 기존 보유 확인
  if (coupon.coupon_group_key) {
    const { data: existing } = await postgrest
      .from('coupon_issues')
      .select('id, coupon_id, status')
      .eq('user_id', user_id)
      .eq('coupon_group_key', coupon.coupon_group_key)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      // 기존 쿠폰의 할인 정보 조회
      const { data: existingCoupon } = await postgrest
        .from('coupons')
        .select('discount_type, discount_value')
        .eq('id', existing.coupon_id)
        .single();

      if (existingCoupon) {
        const isBetter = compareBenefit(
          coupon.discount_type, coupon.discount_value,
          existingCoupon.discount_type, existingCoupon.discount_value
        );

        if (!isBetter) {
          return NextResponse.json({
            success: true,
            action: 'MOTION_ONLY',
            reason: 'EXISTING_BETTER',
            existing_discount: existingCoupon.discount_value,
          });
        }

        // 기존 쿠폰 REPLACED 처리
        await postgrest
          .from('coupon_issues')
          .update({ status: 'cancelled' })
          .eq('id', existing.id);
      }
    }
  }

  // 4. 수량 확인
  if (coupon.total_issuable) {
    const { count } = await postgrest
      .from('coupon_issues')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon_id)
      .in('status', ['active', 'used']);

    if (count && count >= coupon.total_issuable) {
      return NextResponse.json(
        { success: false, error: 'SOLD_OUT' },
        { status: 400 }
      );
    }
  }

  // 5. 쿠폰 코드 생성
  const couponCode = generateCouponCode(coupon.valid_from);
  const shortCode = generateShortCode();

  // 6. 발행
  const { data: issue, error: issueError } = await postgrest
    .from('coupon_issues')
    .insert({
      coupon_id,
      user_id,
      code: shortCode,
      coupon_code: couponCode,
      status: 'active',
      issued_at: new Date().toISOString(),
      expires_at: coupon.valid_to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      claimed_lat: lat,
      claimed_lng: lng,
      claimed_via,
      coupon_group_key: coupon.coupon_group_key,
    })
    .select()
    .single();

  if (issueError) {
    console.error('Issue insert error:', issueError);
    return NextResponse.json(
      { success: false, error: 'ISSUE_FAILED' },
      { status: 500 }
    );
  }

  // 7. 이벤트 기록
  await postgrest.from('coupon_events').insert({
    user_id,
    store_id: coupon.store_id,
    coupon_id,
    coupon_issue_id: issue.id,
    event_type: 'ACQUIRED',
    meta: { claimed_via, discount_type: coupon.discount_type, discount_value: coupon.discount_value },
  });

  // 매장명 조회
  const { data: store } = await postgrest
    .from('stores')
    .select('name')
    .eq('id', coupon.store_id)
    .single();

  return NextResponse.json({
    success: true,
    action: 'ACQUIRED',
    data: {
      issue_id: issue.id,
      coupon_code: couponCode,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      store_name: store?.name || '',
      title: coupon.title,
    },
  });
}

function compareBenefit(
  newType: string, newValue: number,
  existType: string, existValue: number
): boolean {
  // percent > amount
  if (newType === 'percent' && existType === 'amount') return true;
  if (newType === 'amount' && existType === 'percent') return false;
  return newValue > existValue;
}

function generateCouponCode(validFrom?: string): string {
  const date = validFrom ? new Date(validFrom) : new Date();
  const yymm = date.getFullYear().toString().slice(-2) + String(date.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 8; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const check = (parseInt(yymm, 10) + rand.charCodeAt(0) + rand.charCodeAt(7)).toString(16).toUpperCase().slice(-2);
  return `${yymm}-${rand.slice(0, 4)}-${rand.slice(4)}-${check}`;
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
