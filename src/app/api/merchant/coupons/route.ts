import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST: 사업자 쿠폰 등록 (승인 대기 상태로 저장)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      merchant_id, store_id, title, description,
      discount_type, discount_value, total_issuable,
      valid_from, valid_to, radius_km,
      min_order_amount, per_user_limit,
      image_url, merchant_url, product_sku,
    } = body;

    if (!title || !discount_value) {
      return NextResponse.json(
        { error: '쿠폰 이름과 할인 혜택은 필수입니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert({
        merchant_id: merchant_id || null,
        store_id: store_id || null,
        title,
        description: description || '',
        discount_type: discount_type || 'percent',
        discount_value: parseFloat(discount_value) || 0,
        total_issuable: total_issuable || 100,
        valid_from: valid_from || null,
        valid_to: valid_to || null,
        radius_km: radius_km || 20001,
        min_order_amount: min_order_amount || 0,
        per_user_limit: per_user_limit || 1,
        image_url: image_url || null,
        merchant_url: merchant_url || null,
        product_sku: product_sku || null,
        approval_status: 'PENDING_APPROVAL',
        asset_type: 'IMAGE_2D',
        asset_url: image_url || null,
        is_active: false,
      })
      .select()
      .single();

    if (error) {
      console.error('쿠폰 등록 에러:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, coupon: data });
  } catch (e: any) {
    console.error('쿠폰 등록 실패:', e);
    return NextResponse.json(
      { error: e.message || '서버 오류' },
      { status: 500 }
    );
  }
}

// GET: 사업자의 쿠폰 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const merchant_id = searchParams.get('merchant_id');
    const store_id = searchParams.get('store_id');

    let query = supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (merchant_id) {
      query = query.eq('merchant_id', merchant_id);
    }
    if (store_id) {
      query = query.eq('store_id', store_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: data || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || '서버 오류' },
      { status: 500 }
    );
  }
}
