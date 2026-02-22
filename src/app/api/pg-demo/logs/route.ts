import { NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const client = createPostgrestClient();

    let query = client
      .from('event_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (type) {
      query = query.eq('event_type', type);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 24시간 집계
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recent } = await client
      .from('event_logs')
      .select('event_type')
      .gte('created_at', h24);

    const summary: Record<string, number> = {};
    (recent || []).forEach((r: any) => {
      summary[r.event_type] = (summary[r.event_type] || 0) + 1;
    });

    return NextResponse.json({
      logs: logs || [],
      summary_24h: summary,
    });
  } catch (err: any) {
    console.error('[pg-demo/logs] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
