'use client';

import { useState, useCallback, useEffect } from 'react';

interface UserInfo {
  user_id: string;
  name: string;
  email: string;
}

interface WalletInfo {
  id: string;
  total_points: number;
  total_coupon_count: number;
}

interface CouponItem {
  id: string;
  title: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  min_order_amount?: number;
}

interface IssuedCoupon {
  id: string;
  coupon_id: string;
  code?: string;
  status: string;
  is_used: boolean;
  created_at: string;
  coupons?: CouponItem;
}

interface LogEntry {
  id: string;
  event_type: string;
  actor_type: string;
  target_type: string;
  details: any;
  created_at: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

export default function PGDemoPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [issuedCoupon, setIssuedCoupon] = useState<any>(null);
  const [activeCoupons, setActiveCoupons] = useState<IssuedCoupon[]>([]);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logSummary, setLogSummary] = useState<any>(null);

  const api = useCallback(async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  // Handle return from payment complete page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentComplete = params.get('payment_complete');
    const status = params.get('status');
    if (paymentComplete && status) {
      setPaymentResult({
        success: status === 'paid',
        payment_id: paymentComplete,
        status,
      });
      // Clean URL without reload
      window.history.replaceState({}, '', '/pg-demo');
      // Auto-login then show step 4
      (async () => {
        try {
          const loginRes = await api('/api/pg-demo/login', { method: 'POST' });
          setUser(loginRes.user);
          setWallet(loginRes.wallet);
          const couponRes = await api('/api/pg-demo/coupons');
          setCoupons(couponRes.coupons || []);
          setStep(4);
        } catch (e: any) {
          setError((e as Error).message);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const loginRes = await api('/api/pg-demo/login', { method: 'POST' });
      setUser(loginRes.user);
      setWallet(loginRes.wallet);
      const couponRes = await api('/api/pg-demo/coupons');
      setCoupons(couponRes.coupons || []);
      setStep(1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCoupon = async (couponId: string) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/pg-demo/issue', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.user_id, coupon_id: couponId }),
      });
      setIssuedCoupon(res.issue);
      const walletRes = await api(`/api/pg-demo/wallet?user_id=${user.user_id}`);
      setWallet({ id: walletRes.wallet.id, total_points: walletRes.wallet.total_points || 0, total_coupon_count: walletRes.wallet.total_coupon_count || 0 });
      setActiveCoupons(walletRes.active_coupons || []);
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPayment = async (couponIssueId: string) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const couponData = activeCoupons.find((c) => c.id === couponIssueId);
      const amount = 15000;
      const discountAmount = (couponData as any)?.coupons?.discount_value || 3000;
      const res = await api('/api/pg-demo/pay/create', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.user_id,
          coupon_issue_id: couponIssueId,
          amount,
          discount_amount: discountAmount,
          payment_method: 'card',
          order_items: [{ name: 'AR 체험 쿠폰 사용 결제', qty: 1, price: amount }],
        }),
      });
      if (res.gateway_url) window.location.href = res.gateway_url;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleViewLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/pg-demo/logs');
      setLogs(res.logs || []);
      setLogSummary(res.summary_24h || {});
      setStep(5);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = [
    { num: 1, label: '쿠폰 발급', icon: '🎫' },
    { num: 2, label: '지갑 확인', icon: '👛' },
    { num: 3, label: '결제(모의)', icon: '💳' },
    { num: 4, label: '쿠폰 사용', icon: '✅' },
    { num: 5, label: '로그 확인', icon: '📋' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', color: '#fff', fontFamily: "'Pretendard', sans-serif" }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>🎯 AIRCTT × 다우데이터 PG 데모</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>쿠폰톡톡 5단계 순환 시연</p>
        </div>
        {user && (
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            <div>👤 {user.name}</div>
            <div style={{ opacity: 0.6 }}>💰 {wallet?.total_points?.toLocaleString() || 0}P | 🎫 {wallet?.total_coupon_count || 0}장</div>
          </div>
        )}
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', padding: '20px 16px', flexWrap: 'wrap' }}>
        {stepLabels.map((s) => (
          <button key={s.num} onClick={() => setStep(s.num as Step)} style={{ padding: '8px 16px', borderRadius: '20px', border: step === s.num ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)', background: step === s.num ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)', color: step === s.num ? '#00d4ff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: step === s.num ? 700 : 400 }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ margin: '0 24px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.3)', color: '#ff6b6b', fontSize: '0.9rem' }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 24px' }}>
        {!user && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎪</div>
            <h2 style={{ marginBottom: '8px' }}>AIRCTT PG 데모 시작</h2>
            <p style={{ opacity: 0.7, marginBottom: '24px', fontSize: '0.9rem' }}>쿠폰 발급 → 지갑 → 결제 → 사용처리 → 로그 확인</p>
            <button onClick={handleLogin} disabled={loading} style={{ padding: '14px 36px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #00d4ff, #0066ff)', color: '#fff', fontSize: '1.1rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? '⏳ 초기화 중...' : '🚀 데모 시작'}
            </button>
          </div>
        )}

        {user && step === 1 && (
          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>🎫 Step 1: 쿠폰 발급</h2>
            {coupons.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', opacity: 0.6, borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}>
                <p>발급 가능한 쿠폰이 없습니다</p>
                <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Supabase &gt; coupons 테이블에 데이터를 추가해주세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {coupons.map((c) => (
                  <div key={c.id} style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{c.title}</h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                          {c.discount_type === 'amount' ? `${c.discount_value?.toLocaleString()}원 할인` : `${c.discount_value}% 할인`}
                          {c.min_order_amount ? ` (${c.min_order_amount?.toLocaleString()}원 이상)` : ''}
                        </p>
                      </div>
                      <button onClick={() => handleIssueCoupon(c.id)} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontSize: '0.85rem' }}>
                        {loading ? '...' : '발급'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {user && step === 2 && (
          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>👛 Step 2: 지갑 확인</h2>
            {issuedCoupon && (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#00d4ff' }}>🎉 쿠폰 발급 완료!</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>{issuedCoupon.coupon_title}</p>
              </div>
            )}
            <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>보유 현황</h3>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#00d4ff' }}>{wallet?.total_coupon_count || 0}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>보유 쿠폰</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffd700' }}>{wallet?.total_points?.toLocaleString() || 0}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>포인트</div>
                </div>
              </div>
            </div>
            <h3 style={{ fontSize: '1rem', margin: '20px 0 12px' }}>🎫 사용 가능 쿠폰</h3>
            {activeCoupons.length === 0 ? (
              <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>사용 가능한 쿠폰이 없습니다</p>
            ) : (
              activeCoupons.map((c) => (
                <div key={c.id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{(c as any).coupons?.title || '쿠폰'}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>발급: {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => handleStartPayment(c.id)} disabled={loading} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ff6b35, #ff3366)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                    💳 결제하기
                  </button>
                </div>
              ))
            )}
          </section>
        )}

        {user && step === 4 && (
          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>✅ Step 4: 결제 완료 & 쿠폰 사용</h2>
            {paymentResult && (
              <div style={{ padding: '20px', borderRadius: '12px', background: paymentResult.success ? 'rgba(0,255,100,0.1)' : 'rgba(255,50,50,0.1)', border: `1px solid ${paymentResult.success ? 'rgba(0,255,100,0.3)' : 'rgba(255,50,50,0.3)'}`, textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>{paymentResult.success ? '✅' : '❌'}</div>
                <h3 style={{ margin: '0 0 4px' }}>{paymentResult.success ? '결제 성공!' : '결제 실패/취소'}</h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Payment ID: {paymentResult.payment_id?.slice(0, 8)}...</p>
              </div>
            )}
            <button onClick={handleViewLogs} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
              📋 Step 5: 로그 확인하기
            </button>
          </section>
        )}

        {user && step === 5 && (
          <section>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>📋 Step 5: 이벤트 로그</h2>
            {logSummary && (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>최근 24시간 집계</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(logSummary || {}).map(([type, count]) => (
                    <span key={type} style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(0,212,255,0.15)', fontSize: '0.8rem', color: '#00d4ff' }}>
                      {type}: {count as number}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.6 }}>총 {Object.values(logSummary || {}).reduce((a: number, b: any) => a + (b as number), 0)}건</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logs.map((log) => (
                <div key={log.id} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: log.event_type.includes('APPROVED') ? '#00ff88' : log.event_type.includes('ISSUED') ? '#00d4ff' : log.event_type.includes('REDEEMED') ? '#ffd700' : log.event_type.includes('FAIL') || log.event_type.includes('CANCEL') ? '#ff6b6b' : '#fff' }}>
                      {log.event_type}
                    </span>
                    <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>{log.target_type} | {JSON.stringify(log.details).slice(0, 80)}...</div>
                </div>
              ))}
              {logs.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>로그가 없습니다. 먼저 Step 1~4를 진행해주세요.</p>}
            </div>
            <button onClick={() => { setStep(1); setIssuedCoupon(null); setPaymentResult(null); }} style={{ width: '100%', marginTop: '24px', padding: '14px', borderRadius: '12px', border: '2px solid rgba(0,212,255,0.3)', background: 'transparent', color: '#00d4ff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
              🔄 처음부터 다시 시연
            </button>
          </section>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: '24px', opacity: 0.4, fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        AIRCTT × 쿠폰톡톡 × 다우데이터 PG/VAN 데모 | {new Date().getFullYear()}
      </footer>
    </div>
  );
}
