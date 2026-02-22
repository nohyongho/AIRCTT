import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_EMAILS = ['zeus1404@gmail.com'];

async function supabaseRest(path: string, options?: RequestInit) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
          ...options,
          headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': `Bearer ${SUPABASE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation',
                  ...(options?.headers || {}),
          },
    });
    return res;
}

// GET: 현재 정책 조회
export async function GET() {
    try {
          const res = await supabaseRest('platform_settings?is_current=eq.true&order=version.desc&limit=1');
          const data = await res.json();

      // 변경 로그 조회
      const logsRes = await supabaseRest('policy_change_logs?order=created_at.desc&limit=20');
          const logs = await logsRes.json();

      return NextResponse.json({
              success: true,
              settings: Array.isArray(data) ? data[0] : data,
              logs: Array.isArray(logs) ? logs : [],
      });
    } catch (e: unknown) {
          return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}

// PATCH: 정책 업데이트 (새 버전 생성)
export async function PATCH(req: NextRequest) {
    try {
          const body = await req.json();
          const { admin_email, coupon_unit_price, market_fee_rate, default_radius_km, payment_mode, settlement_cycle, reason } = body;

      if (!ADMIN_EMAILS.includes(admin_email)) {
              return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
      }
          if (!reason) {
                  return NextResponse.json({ success: false, error: '변경 사유 필수' }, { status: 400 });
          }

      // 현재 정책 조회
      const currentRes = await supabaseRest('platform_settings?is_current=eq.true&order=version.desc&limit=1');
          const currentArr = await currentRes.json();
          const current = Array.isArray(currentArr) ? currentArr[0] : null;
          const currentVersion = current?.version || 0;

      // 기존 정책 비활성화
      if (current) {
              await supabaseRest(`platform_settings?id=eq.${current.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_current: false }),
              });
      }

      // 새 정책 생성
      const newSettings = {
              version: currentVersion + 1,
              coupon_unit_price: coupon_unit_price ?? current?.coupon_unit_price ?? 100,
              market_fee_rate: market_fee_rate ?? current?.market_fee_rate ?? 10,
              default_radius_km: default_radius_km ?? current?.default_radius_km ?? 5,
              payment_mode: payment_mode ?? current?.payment_mode ?? 'demo',
              settlement_cycle: settlement_cycle ?? current?.settlement_cycle ?? 'monthly',
              is_current: true,
              created_by_email: admin_email,
              reason,
      };

      const insertRes = await supabaseRest('platform_settings', {
              method: 'POST',
              body: JSON.stringify(newSettings),
      });
          const inserted = await insertRes.json();
          const newId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

      // 변경 로그 기록
      const changes: Array<{field: string; old_val: string; new_val: string}> = [];
          const fields = ['coupon_unit_price', 'market_fee_rate', 'default_radius_km', 'payment_mode', 'settlement_cycle'] as const;
          for (const f of fields) {
                  const oldVal = String(current?.[f] ?? '');
                  const newVal = String(newSettings[f] ?? '');
                  if (oldVal !== newVal) {
                            changes.push({ field: f, old_val: oldVal, new_val: newVal });
                  }
          }

      for (const c of changes) {
              await supabaseRest('policy_change_logs', {
                        method: 'POST',
                        body: JSON.stringify({
                                    setting_id: newId,
                                    changed_by_email: admin_email,
                                    field_name: c.field,
                                    old_value: c.old_val,
                                    new_value: c.new_val,
                                    reason,
                        }),
              });
      }

      // audit log
      await supabaseRest('audit_logs', {
              method: 'POST',
              body: JSON.stringify({
                        actor_email: admin_email,
                        action: 'SETTINGS_UPDATE',
                        target_type: 'platform_settings',
                        target_id: newId,
                        old_values: current,
                        new_values: newSettings,
                        reason,
              }),
      });

      return NextResponse.json({ success: true, settings: Array.isArray(inserted) ? inserted[0] : inserted, changes });
    } catch (e: unknown) {
          return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
