import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

// GET: 게임에서 스폰할 승인된 쿠폰 목록
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const postgrest = createPostgrestClient();
    const { data, error } = await postgrest
      .from('coupons')
      .select('id,title,description,discount_type,discount_value,image_url,merchant_url,asset_type,asset_url,store_id,merchant_id')
      .eq('approval_status', 'APPROVED')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('스폰 쿠폰 조회 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 게임에서 사용할 형식으로 변환
    const spawnCoupons = (data || []).map((coupon: any) => ({
      id: coupon.id,
      title: coupon.title,
      description: coupon.description,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      imageUrl: coupon.image_url || coupon.asset_url,
      merchantUrl: coupon.merchant_url,
      assetType: coupon.asset_type || 'IMAGE_2D',
      assetUrl: coupon.asset_url,
    }));

    return NextResponse.json({
      success: true,
      coupons: spawnCoupons,
      count: spawnCoupons.length,
    });
  } catch (e: any) {
    console.error('스폰 쿠폰 로드 실패:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 쿠폰 획득 기록 (게임에서 크래커 잡았을 때)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { coupon_id, user_id } = body;

    if (!coupon_id) {
      return NextResponse.json(
        { error: 'coupon_id는 필수입니다.' },
        { status: 400 }
      );
    }

    const postgrest = createPostgrestClient();

    // 쿠폰 정보 조회
    const { data: coupon, error: couponError } = await postgrest
      .from('coupons')
      .select('*')
      .eq('id', coupon_id)
      .single();

    if (couponError || !coupon) {
      return NextResponse.json({ error: '쿠폰을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 쿠폰 발급 코드 생성
    const code = 'CTT-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // coupon_issues에 기록
    const { data: issue, error: issueError } = await postgrest
      .from('coupon_issues')
      .insert({
        coupon_id,
        user_id: user_id || null,
        code,
        status: 'active',
        claimed_via: 'game_cracker',
      })
      .select()
      .single();

    if (issueError) {
      console.error('쿠폰 발급 에러:', issueError);
      return NextResponse.json({ error: issueError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '쿠폰을 획득했습니다!',
      issue: {
        id: issue.id,
        code,
        coupon_title: coupon.title,
        merchant_url: coupon.merchant_url,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
