'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Gift, Ticket, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

interface GiftInfo {
  title: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  store_name?: string;
  sender_name?: string;
  expires_at?: string;
}

export default function GiftAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<'loading' | 'preview' | 'accepting' | 'success' | 'error'>('loading');
  const [giftInfo, setGiftInfo] = useState<GiftInfo | null>(null);
  const [result, setResult] = useState<{
    issue_id?: string;
    title?: string;
    discount_value?: number;
    error?: string;
  } | null>(null);

  // 선물 정보 미리보기
  useEffect(() => {
    const fetchGiftInfo = async () => {
      try {
        const res = await fetch(`/api/coupons/gift/info?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setGiftInfo(data);
            setStatus('preview');
            return;
          }
        }
      } catch {
        // info API가 없는 경우 바로 preview로 전환
      }
      // 정보를 못 가져와도 수락 가능하게
      setStatus('preview');
    };

    if (token) fetchGiftInfo();
  }, [token]);

  const handleAccept = async () => {
    setStatus('accepting');
    try {
      const receiverId = getUserId();
      const res = await fetch('/api/coupons/gift/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gift_token: token,
          receiver_id: receiverId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setResult({
          issue_id: data.issue_id,
          title: data.title,
          discount_value: data.discount_value,
        });
        setStatus('success');
      } else {
        setResult({ error: getErrorMessage(data.error) });
        setStatus('error');
      }
    } catch {
      setResult({ error: '서버 연결에 실패했습니다.' });
      setStatus('error');
    }
  };

  const goToWallet = () => {
    router.push('/consumer/wallet');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}
    >
      {/* Stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.2,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 2 + 1}s`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Loading */}
        {status === 'loading' && (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm">선물 정보를 확인하는 중...</p>
          </div>
        )}

        {/* Preview */}
        {status === 'preview' && (
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Gift className="w-10 h-10 text-white" />
              </div>

              <h1 className="text-2xl font-black text-white mb-2">
                선물이 도착했어요!
              </h1>
              <p className="text-white/50 text-sm mb-6">
                누군가 쿠폰을 선물했습니다
              </p>

              {giftInfo && (
                <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <Ticket className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
                  <div className="text-xl font-black text-white">
                    {giftInfo.discount_type === 'percent'
                      ? `${giftInfo.discount_value}% OFF`
                      : `${giftInfo.discount_value.toLocaleString()}원`}
                  </div>
                  <div className="text-sm text-white/60 mt-1">{giftInfo.title}</div>
                  {giftInfo.store_name && (
                    <div className="text-xs text-white/40 mt-1">
                      {giftInfo.store_name}
                    </div>
                  )}
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAccept}
                className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-purple-500/30 active:shadow-none transition-shadow"
              >
                🎁 선물 받기
              </motion.button>

              <p className="text-white/30 text-xs mt-4">
                수락하면 내 쿠폰 지갑에 저장됩니다
              </p>
            </motion.div>
          </div>
        )}

        {/* Accepting */}
        {status === 'accepting' && (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm">선물을 수락하는 중...</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="bg-black/40 backdrop-blur-xl border border-green-500/20 rounded-3xl p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>

              <h1 className="text-2xl font-black text-white mb-2">
                선물 수락 완료!
              </h1>

              {result?.title && (
                <div className="mb-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                  <div className="text-xl font-black text-green-400">
                    {result.discount_value}% OFF
                  </div>
                  <div className="text-sm text-white/60 mt-1">{result.title}</div>
                </div>
              )}

              <p className="text-white/50 text-sm mb-6">
                쿠폰이 지갑에 저장되었습니다
              </p>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={goToWallet}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                지갑에서 확인하기
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="bg-black/40 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-2xl font-black text-white mb-2">
              수락 실패
            </h1>

            <p className="text-red-300 text-sm mb-6">
              {result?.error || '알 수 없는 오류가 발생했습니다'}
            </p>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAccept}
                className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl border border-white/20"
              >
                다시 시도
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={goToWallet}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-3 rounded-xl"
              >
                지갑으로
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function getUserId(): string {
  if (typeof window === 'undefined') return 'anonymous';
  try {
    const session = localStorage.getItem('airctt_consumer_session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.user_id || parsed.consumer_id || 'anonymous';
    }
  } catch { /* ignore */ }
  return 'anonymous';
}

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'GIFT_NOT_FOUND_OR_EXPIRED': '선물 링크가 만료되었거나 존재하지 않습니다.',
    'CANNOT_GIFT_SELF': '자신에게 선물한 쿠폰은 수락할 수 없습니다.',
    'RECEIVER_HAS_BETTER': '이미 더 좋은 할인 쿠폰을 보유하고 있습니다.',
    'COUPON_NOT_FOUND': '쿠폰 정보를 찾을 수 없습니다.',
    'ACCEPT_FAILED': '선물 수락에 실패했습니다.',
  };
  return messages[code] || code || '알 수 없는 오류가 발생했습니다.';
}
