'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GatewayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCard, setSelectedCard] = useState('shinhan');
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('card');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPaymentId(params.get('payment_id') || '');
    setAmount(parseInt(params.get('amount') || '0'));
    setMethod(params.get('method') || 'card');
    setReady(true);
  }, []);

  const cards = [
    { code: 'shinhan', name: '신한카드', color: '#0046ff' },
    { code: 'samsung', name: '삼성카드', color: '#1428a0' },
    { code: 'kb', name: 'KB국민카드', color: '#ffb800' },
    { code: 'hyundai', name: '현대카드', color: '#000' },
    { code: 'lotte', name: '롯데카드', color: '#e60012' },
  ];

  const handlePayment = async (result: 'SUCCESS' | 'FAIL' | 'CANCEL') => {
    if (!paymentId) { setError('결제 ID가 없습니다'); return; }
    setLoading(true);
    setError('');
    try {
      const card = cards.find(c => c.code === selectedCard);
      const res = await fetch('/api/pg-demo/pay/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          result,
          card_company: card?.name || '신한카드',
          card_number: `${Math.floor(Math.random() * 9000) + 1000}-****-****-${Math.floor(Math.random() * 9000) + 1000}`,
          installment_months: 0,
        }),
      });
      const data = await res.json();
      if (result === 'SUCCESS' && data.success) {
        router.push(`/pg-demo/complete?payment_id=${paymentId}&status=paid&tx_id=${data.payment?.pg_transaction_id || ''}`);
      } else if (result === 'CANCEL') {
        router.push(`/pg-demo/complete?payment_id=${paymentId}&status=cancelled`);
      } else {
        router.push(`/pg-demo/complete?payment_id=${paymentId}&status=failed`);
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
        ⏳ 로딩 중...
      </div>
    );
  }

  if (!paymentId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', color: '#333' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>결제 정보가 없습니다</h2>
          <button onClick={() => router.push('/pg-demo')} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#0046ff', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            데모로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', color: '#333', fontFamily: "'Pretendard', sans-serif" }}>
      <header style={{ background: '#fff', padding: '16px 24px', borderBottom: '2px solid #0046ff', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #0046ff, #00a8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>DU</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0046ff' }}>다우데이터 결제</h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>SANDBOX MODE</p>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', background: '#fff3cd', color: '#856404' }}>모의 결제</span>
      </header>

      <main style={{ maxWidth: '440px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>결제 금액</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0046ff' }}>{amount.toLocaleString()}원</div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>주문번호: {paymentId.slice(0, 8)}...</div>
        </div>

        {method === 'card' && (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>💳 카드 선택</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cards.map((card) => (
                <label key={card.code} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', border: selectedCard === card.code ? `2px solid ${card.color}` : '1px solid #eee', background: selectedCard === card.code ? `${card.color}08` : '#fff', cursor: 'pointer' }}>
                  <input type="radio" name="card" value={card.code} checked={selectedCard === card.code} onChange={() => setSelectedCard(card.code)} style={{ accentColor: card.color }} />
                  <span style={{ fontWeight: 500 }}>{card.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px', borderRadius: '8px', background: '#fff3f3', border: '1px solid #ffcccc', color: '#cc0000', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => handlePayment('SUCCESS')} disabled={loading} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: loading ? '#ccc' : '#0046ff', color: '#fff', fontSize: '1.1rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? '⏳ 결제 처리 중...' : `💳 ${amount.toLocaleString()}원 결제하기`}
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => handlePayment('FAIL')} disabled={loading} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#ff4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
              ❌ 결제 실패
            </button>
            <button onClick={() => handlePayment('CANCEL')} disabled={loading} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#999', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
              🚫 결제 취소
            </button>
          </div>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', background: '#f8f9fa', fontSize: '0.8rem', color: '#666', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>ℹ️ 모의 결제 안내</p>
          <p style={{ margin: 0 }}>이 화면은 다우데이터 PG 결제창의 모의 버전입니다. 실제 결제가 이루어지지 않으며, 시연 목적으로 사용됩니다.</p>
        </div>
      </main>
    </div>
  );
}
