import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const anonId = searchParams.get('anon_id');

        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const client = createPostgrestClient(token);

        let consumerKey = '00000000-0000-0000-0000-000000000000'; // Default Mock

        if (token) {
            const { data: userData } = await client.from('users').select('id').single();
            if (userData) {
                consumerKey = userData.id;
            }
        } else if (anonId) {
            // 비로그인 익명 UUID: 게임에서 저장한 쿠폰 조회
            consumerKey = anonId;
        }

        // 로그인 유저: 본인 쿠폰만 / 비로그인: anon ID 쿠폰만
        const query = client
            .from('coupon_issues')
            .select(`
        id,
        is_used,
        issued_at,
        coupons!inner (
          title,
          description,
          discount_value,
          valid_to,
          merchants ( name )
        )
      `)
            .order('issued_at', { ascending: false });

        // mock ID(00000000...)가 아닐 때만 실제 ID로 필터
        const { data, error } = consumerKey !== '00000000-0000-0000-0000-000000000000'
            ? await query.eq('user_id', consumerKey)
            : await query.eq('user_id', '00000000-0000-0000-0000-000000000000');

        if (error) {
            console.error('Wallet Query Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formatted = (data || []).map((issue: any) => ({
            id: issue.id,
            title: issue.coupons.title,
            description: issue.coupons.description,
            brand: issue.coupons.merchants?.name || 'Unknown Brand',
            status: !issue.is_used ? 'available' : 'used',
            expiresAt: issue.coupons.valid_to,
            imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200',
            discountRate: issue.coupons.discount_value,
        }));

        return NextResponse.json(formatted);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        // If no token provided, we might fail or default to mock if explicitly desired,
        // but for "Real User ID" goal, we should require it (or RLS will fail/return empty).

        // MVP Fallback: If no token, maybe use the mock ID for demo testing WITHOUT login?
        // But User asked for "Connect REAL ID". So let's try to use the token.

        const token = authHeader?.replace('Bearer ', '');
        const client = createPostgrestClient(token);

        // Get User ID from Token (via RPC to auth.uid() or simply trusting the token's subject claiming)
        // PostgREST with Auth token automatically applies RLS using the user_id in the token.
        // So we don't need to manually filter by `consumer_id` IF RLS policies are set up to "view own data".
        // HOWEVER, our Schema queries often filter by `consumer_id` explicitly.
        // Let's first get the user ID to ensure we have it for the query.

        // Retrieve user object from Supabase Auth to get the ID securely
        // Or, we can just query the table. If RLS is ON, `select * from coupons` will only return MY coupons.
        // But our table structure relies on `consumer_id` column.

        // Strategy: Use a helper to get user from token? 
        // Actually, `auth.uid()` in RLS is best.
        // For now, let's assume the Client sends the correct `consumer_id` or we derive it.
        // As a robust MVP, let's fetch the user profile first to get the ID.

        let consumerKey = '00000000-0000-0000-0000-000000000000'; // Default Mock

        if (token) {
            // We can't easily verify the token here without supabase-js options or an endpoint.
            // But passing it to PostgREST makes `auth.uid()` available in SQL.
            // But we need the ID *in JS* to pass to `eq('consumer_id', ID)`.

            // Trick: Query `users` table for my own ID using RLS
            const { data: userData } = await client.from('users').select('id').single();
            if (userData) {
                consumerKey = userData.id;
            } else {
                // Maybe token is valid but 'users' entry missing? (Triggers should have handled this)
                // Or maybe RLS blocked it.
            }
        }

        const { data, error } = await client
            .from('coupon_issues')
            .select(`
        id,
        is_used,
        issued_at,
        coupons!inner (
          title,
          description,
          discount_value,
          valid_to,
          merchants ( name )
        )
      `)
            .or(`user_id.eq.${consumerKey},user_id.eq.00000000-0000-0000-0000-000000000000`) // Allow seeing both MyID and DefaultID coupons
            .order('issued_at', { ascending: false });

        if (error) {
            console.error('Wallet Query Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formatted = data.map((issue: any) => ({
            id: issue.id,
            title: issue.coupons.title,
            description: issue.coupons.description,
            brand: issue.coupons.merchants?.name || 'Unknown Brand',
            status: !issue.is_used ? 'available' : 'used', // Map boolean exists
            expiresAt: issue.coupons.valid_to,
            imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200',
            discountRate: issue.coupons.discount_value,
        }));

        return NextResponse.json(formatted);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
