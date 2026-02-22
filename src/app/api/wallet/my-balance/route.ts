
import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const client = createPostgrestClient(token);

        let consumerKey = '00000000-0000-0000-0000-000000000000'; // Default Mock

        if (token) {
            const { data: userData } = await client.from('users').select('id').single();
            if (userData) consumerKey = userData.id;
        }

        const { data, error } = await client
            .from('wallets')
            .select('total_points')
            .eq('user_id', consumerKey)
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ balance: data ? data.total_points : 0 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
