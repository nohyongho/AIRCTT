import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * GET /api/pg-demo/logs
 * 관리자 이벤트 로그 조회 (순환구조 Step 5)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get('event_type');
    const limit = parseInt(searchParams.get('limit') || '50');

    const client = createPostgrestClient();

    let query = client
      .from('event_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 24시간 집계
    const now = new Date();
    const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recent } = await client
      .from('event_logs')
      .select('event_type')
      .gte('created_at', h24ago);

    const typeCounts: Record<string, number> = {};
    (recent || []).forEach((r: any) => {
      typeCounts[r.event_type] = (typeCounts[r.event_type] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      logs: logs || [],
      summary: {
        total_24h: recent?.length || 0,
        by_type: typeCounts,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
