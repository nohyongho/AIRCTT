
import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const client = createPostgrestClient(token);

        // URL에서 anon_id 파라미터 추출 (비로그인 게임 유저)
        const url = new URL(request.url);
        const anonId = url.searchParams.get('anon_id');

        let consumerKey = '00000000-0000-0000-0000-000000000000';

        if (token) {
            const { data: userData } = await client.from('users').select('id').single();
            if (userData) {
                consumerKey = userData.id;
            }
        } else if (anonId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(anonId)) {
            // 비로그인: localStorage의 anon UUID 사용
            consumerKey = anonId;
        }

        const { data, error } = await client
            .from('coupon_issues')
            .select(`
        id,
        is_used,
        issued_at,
        status,
        code,
        expires_at,
        coupons!inner (
          title,
          description,
          discount_value,
          discount_type,
          valid_to,
          merchants ( name )
        )
      `)
            .eq('user_id', consumerKey)
            .order('issued_at', { ascending: false });

        if (error) {
            console.error('Wallet Query Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formatted = (data || []).map((issue: any) => ({
            id: issue.id,
            title: issue.coupons.title,
            description: issue.coupons.description,
            brand: issue.coupons.merchants?.name || 'Unknown Brand',
            status: issue.status || (!issue.is_used ? 'active' : 'used'),
            expiresAt: issue.expires_at || issue.coupons.valid_to,
            couponCode: issue.code,
            imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200',
            discountRate: issue.coupons.discount_value,
            discountType: issue.coupons.discount_type,
        }));

        return NextResponse.json(formatted);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
