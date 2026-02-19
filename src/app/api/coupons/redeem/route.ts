import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

// POST: 쿠폰 사용 처리 (지갑에서 클릭 → 사업자 사이트 이동)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { issue_id, coupon_id, code: couponCode } = body;

    if (!issue_id && !coupon_id) {
      return NextResponse.json(
        { error: 'issue_id 또는 coupon_id가 필요합니다.' },
        { status: 400 }
      );
    }

    const postgrest = createPostgrestClient();

    // coupon_issues에서 발급 정보 조회
    let issueQuery = postgrest.from('coupon_issues').select('*');
    if (issue_id) {
      issueQuery = issueQuery.eq('id', issue_id);
    } else if (couponCode) {
      issueQuery = issueQuery.eq('code', couponCode);
    } else {
      issueQuery = issueQuery.eq('coupon_id', coupon_id).eq('status', 'active');
    }

    const { data: issue, error: issueError } = await issueQuery.single();

    if (issueError || !issue) {
      return NextResponse.json({ error: '쿠폰 발급 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 쿠폰 정보 조회 (merchant_url 가져오기)
    const { data: coupon, error: couponError } = await postgrest
      .from('coupons')
      .select('id,title,merchant_url,discount_type,discount_value')
      .eq('id', issue.coupon_id)
      .single();

    if (couponError || !coupon) {
      return NextResponse.json({ error: '쿠폰 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 쿠폰 상태를 'used'로 업데이트
    await postgrest
      .from('coupon_issues')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
      })
      .eq('id', issue.id);

    // 사업자 사이트 URL 생성 (쿠폰 코드 포함)
    let redirectUrl = coupon.merchant_url || '';
    if (redirectUrl && issue.code) {
      const separator = redirectUrl.includes('?') ? '&' : '?';
      redirectUrl = redirectUrl + separator + 'coupon_code=' + issue.code;
    }

    return NextResponse.json({
      success: true,
      message: '쿠폰이 사용되었습니다!',
      redirect_url: redirectUrl,
      coupon: {
        title: coupon.title,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        code: issue.code,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
