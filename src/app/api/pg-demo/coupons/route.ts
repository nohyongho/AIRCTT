import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function GET() {
  try {
    const client = createPostgrestClient();

    const { data: coupons, error } = await client
      .from('coupons')
      .select('id, title, description, discount_type, discount_value, max_discount_amount, min_order_amount, asset_url, valid_from, valid_to, unit_price')
      .eq('is_active', true)
      .eq('approval_status', 'APPROVED')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: coupons || [] });
  } catch (err: any) {
    console.error('[pg-demo/coupons] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
