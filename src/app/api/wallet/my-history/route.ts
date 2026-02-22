
import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const client = createPostgrestClient(token);

        let consumerKey = '00000000-0000-0000-0000-000000000000';
        if (token) {
            const { data: userData } = await client.from('users').select('id').single();
            if (userData) consumerKey = userData.id;
        }

        // First get wallet ID
        const { data: wallet } = await client
            .from('wallets')
            .select('id')
            .eq('user_id', consumerKey)
            .single();

        if (!wallet) {
            return NextResponse.json([]);
        }

        const { data, error } = await client
            .from('wallet_transactions')
            .select('*')
            .eq('wallet_id', wallet.id)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formatted = data.map((tx: any) => ({
            id: tx.id,
            userId: consumerKey,
            amount: tx.amount_points,
            type: tx.amount_points >= 0 ? 'earned' : 'used',
            description: tx.tx_type,
            createdAt: tx.created_at
        }));

        return NextResponse.json(formatted);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
