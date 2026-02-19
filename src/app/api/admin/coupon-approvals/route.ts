import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

const ADMIN_EMAIL = 'zeus1404@gmail.com';

// GET: 승인 대기 쿠폰 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING_APPROVAL';

    const postgrest = createPostgrestClient();
    const { data, error } = await postgrest
      .from('coupons')
      .select('*')
      .eq('approval_status', status)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: 쿠폰 승인/거절 (관리자만)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { coupon_id, action, admin_email } = body;

    if (admin_email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: '관리자 권한이 없습니다.' },
        { status: 403 }
      );
    }

    if (!coupon_id || !action) {
      return NextResponse.json(
        { error: 'coupon_id와 action은 필수입니다.' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action은 approve 또는 reject만 가능합니다.' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const isActive = action === 'approve';

    const postgrest = createPostgrestClient();
    const { data, error } = await postgrest
      .from('coupons')
      .update({
        approval_status: newStatus,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coupon_id)
      .select()
      .single();

    if (error) {
      console.error('승인 처리 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '쿠폰이 승인되었습니다!' : '쿠폰이 거절되었습니다.',
      coupon: data,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
