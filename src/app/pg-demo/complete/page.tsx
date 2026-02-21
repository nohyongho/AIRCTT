'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CompletePage() {
  const router = useRouter();
  const [paymentId, setPaymentId] = useState('');
  const [status, setStatus] = useState('unknown');
  const [txId, setTxId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPaymentId(params.get('payment_id') || '');
    setStatus(params.get('status') || 'unknown');
    setTxId(params.get('tx_id') || '');
  }, []);

  const isPaid = status === 'paid';
  const isCancelled = status === 'cancelled';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', color: '#fff', fontFamily: "Pretendard, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '5rem', marginBottom: '16px' }}>
          {isPaid ? '\u2705' : isCancelled ? '\ud83d\udead' : '\u274c'}
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
          {isPaid ? '\uacb0\uc81c \uc644\ub8cc!' : isCancelled ? '\uacb0\uc81c \ucde8\uc18c' : '\uacb0\uc81c \uc2e4\ud328'}
        </h1>
        <p style={{ opacity: 0.7, marginBottom: '32px', fontSize: '1rem' }}>
          {isPaid ? '\ucfe0\ud3f0\uc774 \uc0ac\uc6a9 \ucc98\ub9ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4' : isCancelled ? '\uc0ac\uc6a9\uc790\uc5d0 \uc758\ud574 \uacb0\uc81c\uac00 \ucde8\uc18c\ub418\uc5c8\uc2b5\ub2c8\ub2e4' : '\uacb0\uc81c \ucc98\ub9ac \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4'}
        </p>
        {isPaid && (
          <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(0,255,100,0.1)', border: '1px solid rgba(0,255,100,0.2)', marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ opacity: 0.6 }}>{'\uacb0\uc81c ID'}</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{paymentId.slice(0, 12)}...</span>
            </div>
            {txId && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ opacity: 0.6 }}>{'\uac70\ub798 \ubc88\ud638'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{txId}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.6 }}>{'\uc0c1\ud0dc'}</span>
              <span style={{ color: '#00ff88', fontWeight: 700 }}>{'\uc2b9\uc778 \uc644\ub8cc'}</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => router.push(`/pg-demo?payment_complete=${paymentId}&status=${status}`)}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #00d4ff, #0066ff)', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {'\ud83d\udccb \ub370\ubaa8 \ud654\uba74\uc73c\ub85c \ub3cc\uc544\uac00\uae30'}
          </button>
          <button
            onClick={() => router.push('/pg-demo')}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {'\ud83d\udd04 \ucc98\uc74c\ubd80\ud130 \ub2e4\uc2dc'}
          </button>
        </div>
      </div>
      <footer style={{ position: 'absolute', bottom: '24px', opacity: 0.3, fontSize: '0.75rem' }}>
        AIRCTT x Daoudata PG Demo
      </footer>
    </div>
  );
}
