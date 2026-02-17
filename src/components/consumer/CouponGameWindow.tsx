'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Gift, Trophy, Coins, Loader2 } from 'lucide-react';

// ===== 게임에서 사용할 nearby 쿠폰 데이터 =====
interface GameCouponData {
  coupon_id: string;
  store_id: string;
  store_name: string;
  coupon_group_key?: string;
  display_label: string; // "30% / PANTS-001"
  asset_type?: string;
  asset_url?: string | null;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  title: string;
}

interface FallingItem {
  id: number;
  x: number;
  y: number;
  emoji: string;
  speed: number;
  size: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  caught: boolean;
  // 실제 쿠폰 데이터 연결
  couponData?: GameCouponData;
}

interface CouponGameWindowProps {
  onCouponAcquired: (amount: number, name: string) => void;
  onClose?: () => void;
  lang: 'ko' | 'en';
}

const RARITY_COLORS = {
  common: { bg: 'from-gray-400 to-gray-500', glow: 'rgba(156,163,175,0.5)', label: 'COMMON' },
  rare: { bg: 'from-blue-400 to-blue-600', glow: 'rgba(59,130,246,0.5)', label: 'RARE' },
  epic: { bg: 'from-purple-400 to-purple-600', glow: 'rgba(168,85,247,0.5)', label: 'EPIC' },
  legendary: { bg: 'from-yellow-400 to-orange-500', glow: 'rgba(251,191,36,0.7)', label: 'LEGENDARY' },
};

// 에셋 타입별 이모지 매핑
const ASSET_EMOJIS: Record<string, string> = {
  'IMAGE_2D': '🎫',
  'MODEL_3D': '💎',
  'VIDEO': '🎬',
  'AR_EVENT': '🌟',
  'SMARTGLASS': '🕶️',
  'AI_AVATAR_EVENT': '🤖',
  'AVATAR_SHOW': '🎭',
};

const FALLBACK_EMOJIS = ['🎫', '🎟️', '💎', '🎁', '🏷️', '💰', '🌟', '🎪', '🎯', '🍀'];

function discountToRarity(discountType: string, discountValue: number): FallingItem['rarity'] {
  if (discountType === 'percent') {
    if (discountValue >= 50) return 'legendary';
    if (discountValue >= 30) return 'epic';
    if (discountValue >= 15) return 'rare';
    return 'common';
  }
  // amount
  if (discountValue >= 10000) return 'legendary';
  if (discountValue >= 5000) return 'epic';
  if (discountValue >= 2000) return 'rare';
  return 'common';
}

function rarityToPoints(rarity: FallingItem['rarity']): number {
  const map = { common: 10, rare: 30, epic: 80, legendary: 200 };
  return map[rarity];
}

function rarityToSpeed(rarity: FallingItem['rarity']): number {
  const base = { common: 1.5, rare: 2, epic: 2.5, legendary: 3 };
  return base[rarity] + Math.random();
}

function rarityToSize(rarity: FallingItem['rarity']): number {
  const map = { common: 40, rare: 45, epic: 50, legendary: 55 };
  return map[rarity];
}

function createItemFromCoupon(id: number, containerWidth: number, coupon: GameCouponData): FallingItem {
  const rarity = discountToRarity(coupon.discount_type, coupon.discount_value);
  const emoji = ASSET_EMOJIS[coupon.asset_type || 'IMAGE_2D'] || '🎫';
  return {
    id,
    x: Math.random() * (containerWidth - 60) + 30,
    y: -60 - Math.random() * 200,
    emoji,
    speed: rarityToSpeed(rarity),
    size: rarityToSize(rarity),
    rarity,
    points: rarityToPoints(rarity),
    caught: false,
    couponData: coupon,
  };
}

function createRandomItem(id: number, containerWidth: number): FallingItem {
  const rand = Math.random();
  let rarity: FallingItem['rarity'];
  if (rand < 0.5) rarity = 'common';
  else if (rand < 0.8) rarity = 'rare';
  else if (rand < 0.95) rarity = 'epic';
  else rarity = 'legendary';

  return {
    id,
    x: Math.random() * (containerWidth - 60) + 30,
    y: -60 - Math.random() * 200,
    emoji: FALLBACK_EMOJIS[Math.floor(Math.random() * FALLBACK_EMOJIS.length)],
    speed: rarityToSpeed(rarity),
    size: rarityToSize(rarity),
    rarity,
    points: rarityToPoints(rarity),
    caught: false,
  };
}

export default function CouponGameWindow({ onCouponAcquired, onClose, lang }: CouponGameWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [score, setScore] = useState(0);
  const [caughtCount, setCaughtCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameState, setGameState] = useState<'loading' | 'ready' | 'playing' | 'ended'>('loading');
  const [acquireResult, setAcquireResult] = useState<{
    action: string;
    title?: string;
    discount_value?: number;
    discount_type?: string;
    store_name?: string;
    coupon_code?: string;
  } | null>(null);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [caughtCoupons, setCaughtCoupons] = useState<GameCouponData[]>([]);
  const nextIdRef = useRef(0);
  const frameRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);

  // nearby API에서 가져온 실제 쿠폰 목록
  const nearbyCouponsRef = useRef<GameCouponData[]>([]);
  const spawnIndexRef = useRef(0);

  const t = {
    title: lang === 'ko' ? '쿠폰 잡기' : 'COUPON CATCH',
    desc: lang === 'ko' ? '떨어지는 크랙커를 터치해서 쿠폰을 획득하세요!' : 'Tap the falling crackers to get coupons!',
    start: lang === 'ko' ? '게임 시작' : 'START GAME',
    score: lang === 'ko' ? '점수' : 'Score',
    time: lang === 'ko' ? '시간' : 'Time',
    caught: lang === 'ko' ? '획득' : 'Caught',
    gameOver: lang === 'ko' ? '게임 종료!' : 'GAME OVER!',
    reward: lang === 'ko' ? '쿠폰 획득!' : 'COUPON ACQUIRED!',
    motionOnly: lang === 'ko' ? '이미 같은 상품의 쿠폰을 보유 중!' : 'Already have this coupon!',
    close: lang === 'ko' ? '닫기' : 'CLOSE',
    playAgain: lang === 'ko' ? '다시하기' : 'PLAY AGAIN',
    totalScore: lang === 'ko' ? '총 점수' : 'Total Score',
    couponsWon: lang === 'ko' ? '획득 크랙커' : 'Crackers Caught',
    loading: lang === 'ko' ? '주변 쿠폰을 찾는 중...' : 'Finding nearby coupons...',
    noCoupons: lang === 'ko' ? '근처에 쿠폰이 없어요\n위치를 이동해보세요!' : 'No coupons nearby\nTry moving around!',
    wallet: lang === 'ko' ? '지갑 확인' : 'Check Wallet',
  };

  // ===== 1. 시작 시 nearby API 호출 =====
  useEffect(() => {
    const fetchNearbyCoupons = async () => {
      try {
        // 위치 가져오기
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          });
        });

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const res = await fetch(`/api/coupons/nearby?lat=${lat}&lng=${lng}&radius=5&limit=30`);
        const result = await res.json();

        if (result.success && result.data?.length > 0) {
          const gameCoupons: GameCouponData[] = result.data.map((c: any) => ({
            coupon_id: c.coupon_id,
            store_id: c.store_id,
            store_name: c.store_name || '',
            coupon_group_key: c.coupon_group_key,
            display_label: `${c.discount_type === 'percent' ? c.discount_value + '%' : c.discount_value + '원'} / ${c.product_sku || c.title}`,
            asset_type: c.asset_type || 'IMAGE_2D',
            asset_url: c.asset_url,
            discount_type: c.discount_type,
            discount_value: c.discount_value,
            title: c.title,
          }));
          nearbyCouponsRef.current = gameCoupons;
        }
      } catch (e) {
        console.warn('Failed to fetch nearby coupons for game:', e);
      } finally {
        setGameState('ready');
      }
    };

    fetchNearbyCoupons();
  }, []);

  const startGame = useCallback(() => {
    setGameState('playing');
    setScore(0);
    setCaughtCount(0);
    setTimeLeft(30);
    setItems([]);
    setCombo(0);
    setAcquireResult(null);
    setCaughtCoupons([]);
    nextIdRef.current = 0;
    lastSpawnRef.current = 0;
    spawnIndexRef.current = 0;
  }, []);

  // Game timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('ended');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const containerWidth = containerRef.current?.clientWidth || 360;
    const containerHeight = containerRef.current?.clientHeight || 640;

    const gameLoop = (timestamp: number) => {
      // Spawn new items
      if (timestamp - lastSpawnRef.current > 400) {
        lastSpawnRef.current = timestamp;
        const nearby = nearbyCouponsRef.current;

        let newItem: FallingItem;
        if (nearby.length > 0) {
          // 실제 쿠폰에서 순환 생성
          const coupon = nearby[spawnIndexRef.current % nearby.length];
          spawnIndexRef.current++;
          newItem = createItemFromCoupon(nextIdRef.current++, containerWidth, coupon);
        } else {
          // 폴백: 랜덤 아이템
          newItem = createRandomItem(nextIdRef.current++, containerWidth);
        }

        setItems(prev => [...prev.filter(c => !c.caught && c.y < containerHeight + 100), newItem]);
      }

      // Move items
      setItems(prev => prev.map(c => ({
        ...c,
        y: c.caught ? c.y : c.y + c.speed,
      })));

      frameRef.current = requestAnimationFrame(gameLoop);
    };

    frameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [gameState]);

  // ===== 2. 게임 종료 시 → 잡은 쿠폰들 acquire API 호출 =====
  useEffect(() => {
    if (gameState !== 'ended') return;
    if (caughtCoupons.length === 0) return;

    // 가장 높은 할인의 쿠폰으로 acquire 시도
    const bestCoupon = [...caughtCoupons].sort((a, b) => {
      if (a.discount_type === 'percent' && b.discount_type === 'amount') return -1;
      if (a.discount_type === 'amount' && b.discount_type === 'percent') return 1;
      return b.discount_value - a.discount_value;
    })[0];

    (async () => {
      try {
        const res = await fetch('/api/coupons/acquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: getUserId(),
            coupon_id: bestCoupon.coupon_id,
            claimed_via: 'game',
          }),
        });
        const data = await res.json();

        if (data.success) {
          setAcquireResult({
            action: data.action,
            title: data.data?.title || bestCoupon.title,
            discount_value: data.data?.discount_value || bestCoupon.discount_value,
            discount_type: data.data?.discount_type || bestCoupon.discount_type,
            store_name: data.data?.store_name || bestCoupon.store_name,
            coupon_code: data.data?.coupon_code,
          });

          if (data.action === 'ACQUIRED') {
            onCouponAcquired(
              bestCoupon.discount_value,
              `${bestCoupon.discount_type === 'percent' ? bestCoupon.discount_value + '%' : bestCoupon.discount_value + '원'} - ${bestCoupon.title}`
            );
          }
        }
      } catch (e) {
        console.error('Acquire API error:', e);
      }
    })();
  }, [gameState, caughtCoupons, onCouponAcquired]);

  const handleCatch = useCallback((id: number) => {
    setItems(prev => prev.map(c => {
      if (c.id === id && !c.caught) {
        setScore(s => s + c.points * (combo > 2 ? 2 : 1));
        setCaughtCount(n => n + 1);
        setCombo(n => {
          const next = n + 1;
          if (next >= 3) {
            setShowCombo(true);
            setTimeout(() => setShowCombo(false), 800);
          }
          return next;
        });

        // 실제 쿠폰 데이터가 있으면 수집
        if (c.couponData) {
          setCaughtCoupons(prev => {
            // 같은 coupon_group_key는 중복 추가하지 않음
            const key = c.couponData!.coupon_group_key || c.couponData!.coupon_id;
            if (prev.some(p => (p.coupon_group_key || p.coupon_id) === key)) return prev;
            return [...prev, c.couponData!];
          });
        }

        return { ...c, caught: true };
      }
      return c;
    }));
  }, [combo]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.3,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 2 + 1}s`,
            }}
          />
        ))}
      </div>

      {/* Close Button */}
      {onClose && (
        <button onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-black/40 backdrop-blur-md border border-white/20 rounded-full p-2 active:scale-95 transition-transform"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      )}

      {/* HUD */}
      {(gameState === 'playing' || gameState === 'ended') && (
        <div className="absolute top-4 left-4 right-16 z-40 flex gap-2">
          <div className="bg-black/40 backdrop-blur-md border border-cyan-400/30 rounded-xl px-3 py-2 flex-1 text-center">
            <div className="text-[10px] text-cyan-300 font-bold uppercase">{t.score}</div>
            <div className="text-lg font-black text-white font-mono">{score.toLocaleString()}</div>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-yellow-400/30 rounded-xl px-3 py-2 flex-1 text-center">
            <div className="text-[10px] text-yellow-300 font-bold uppercase">{t.caught}</div>
            <div className="text-lg font-black text-yellow-400 font-mono">{caughtCount}</div>
          </div>
          <div className={`bg-black/40 backdrop-blur-md border rounded-xl px-3 py-2 flex-1 text-center ${timeLeft <= 5 ? 'border-red-500/50 animate-pulse' : 'border-white/20'}`}>
            <div className="text-[10px] text-white/70 font-bold uppercase">{t.time}</div>
            <div className={`text-lg font-black font-mono ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}>{timeLeft}s</div>
          </div>
        </div>
      )}

      {/* Combo indicator */}
      <AnimatePresence>
        {showCombo && combo >= 3 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black text-2xl px-6 py-2 rounded-full shadow-lg shadow-orange-500/50">
              {combo}x COMBO!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Screen */}
      {gameState === 'loading' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
          <p className="text-white/70 text-sm">{t.loading}</p>
        </div>
      )}

      {/* Ready Screen */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="text-7xl mb-4">🎫</div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mb-2">
              {t.title}
            </h1>
            <p className="text-white/70 text-sm mb-4">{t.desc}</p>

            {/* 실제 쿠폰 개수 표시 */}
            {nearbyCouponsRef.current.length > 0 && (
              <div className="mb-4 px-4 py-2 bg-white/5 border border-cyan-400/20 rounded-xl">
                <p className="text-cyan-300 text-xs">
                  {lang === 'ko'
                    ? `🎯 주변 크랙커 ${nearbyCouponsRef.current.length}종류`
                    : `🎯 ${nearbyCouponsRef.current.length} cracker types nearby`}
                </p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-3 mb-8 max-w-xs mx-auto">
              {Object.entries(RARITY_COLORS).map(([key, val]) => (
                <div key={key} className="text-center">
                  <div className={`w-10 h-10 mx-auto rounded-lg bg-gradient-to-br ${val.bg} flex items-center justify-center text-lg shadow-lg`}>
                    {key === 'common' ? '🎫' : key === 'rare' ? '💎' : key === 'epic' ? '🌟' : '🏆'}
                  </div>
                  <div className="text-[9px] text-white/50 mt-1 font-bold">{val.label}</div>
                </div>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-black text-xl px-10 py-4 rounded-2xl shadow-lg shadow-purple-500/40 active:shadow-none transition-shadow"
            >
              {t.start}
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Falling Crackers */}
      {gameState === 'playing' && items.map(item => (
        !item.caught && (
          <motion.div
            key={item.id}
            className="absolute cursor-pointer active:scale-90 transition-transform"
            style={{
              left: item.x - item.size / 2,
              top: item.y,
              width: item.size,
              height: item.size,
            }}
            onClick={() => handleCatch(item.id)}
            onTouchStart={() => handleCatch(item.id)}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className={`w-full h-full rounded-xl bg-gradient-to-br ${RARITY_COLORS[item.rarity].bg} flex items-center justify-center shadow-lg relative`}
              style={{ boxShadow: `0 0 15px ${RARITY_COLORS[item.rarity].glow}` }}
            >
              <span className="text-2xl">{item.emoji}</span>
              {/* 쿠폰 라벨 (실제 데이터가 있을 때) */}
              {item.couponData && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/70 text-[7px] text-white px-1.5 py-0.5 rounded-full whitespace-nowrap max-w-[80px] truncate">
                  {item.couponData.discount_type === 'percent'
                    ? `${item.couponData.discount_value}%`
                    : `${item.couponData.discount_value}원`}
                </div>
              )}
            </div>
          </motion.div>
        )
      ))}

      {/* Caught animation particles */}
      {gameState === 'playing' && items.filter(c => c.caught).map(item => (
        <motion.div
          key={`caught-${item.id}`}
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 2, opacity: 0, y: -50 }}
          transition={{ duration: 0.5 }}
          className="absolute pointer-events-none text-3xl"
          style={{ left: item.x - 15, top: item.y }}
        >
          +{item.points}
        </motion.div>
      ))}

      {/* Game Over Screen */}
      {gameState === 'ended' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-sm w-full"
          >
            <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-3xl font-black text-white mb-6">{t.gameOver}</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-3">
                <Coins className="w-6 h-6 mx-auto mb-1 text-cyan-400" />
                <div className="text-2xl font-black text-white">{score.toLocaleString()}</div>
                <div className="text-xs text-white/50">{t.totalScore}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <Gift className="w-6 h-6 mx-auto mb-1 text-purple-400" />
                <div className="text-2xl font-black text-white">{caughtCount}</div>
                <div className="text-xs text-white/50">{t.couponsWon}</div>
              </div>
            </div>

            {/* Acquire Result */}
            {acquireResult && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`mb-6 p-4 rounded-2xl border-2 ${
                  acquireResult.action === 'ACQUIRED'
                    ? 'border-yellow-400/50 bg-gradient-to-br from-yellow-400/10 to-orange-500/10'
                    : 'border-blue-400/30 bg-gradient-to-br from-blue-400/10 to-cyan-500/10'
                }`}
              >
                {acquireResult.action === 'ACQUIRED' ? (
                  <>
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                    <div className="text-lg font-black text-yellow-400">{t.reward}</div>
                    <div className="text-2xl font-black text-white mt-1">
                      {acquireResult.discount_type === 'percent'
                        ? `${acquireResult.discount_value}% OFF`
                        : `${acquireResult.discount_value?.toLocaleString()}원`}
                    </div>
                    <div className="text-sm text-white/60 mt-1">{acquireResult.title}</div>
                    {acquireResult.store_name && (
                      <div className="text-xs text-white/40 mt-1">📍 {acquireResult.store_name}</div>
                    )}
                    {acquireResult.coupon_code && (
                      <div className="mt-2 text-xs text-cyan-300 font-mono bg-black/30 rounded-lg px-3 py-1 inline-block">
                        {acquireResult.coupon_code}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold text-blue-300">✅</div>
                    <div className="text-sm text-blue-300 mt-1">{t.motionOnly}</div>
                    <div className="text-xs text-white/40 mt-1">
                      {lang === 'ko' ? '더 높은 할인 쿠폰이 이미 있어요' : 'You already have a better discount'}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* No real coupons caught */}
            {!acquireResult && caughtCount > 0 && caughtCoupons.length === 0 && (
              <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/50 text-sm">
                  {lang === 'ko' ? '게임은 잘 했지만 쿠폰 데이터가 없었어요' : 'Good game but no real coupon data'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-3 rounded-xl"
              >
                {t.playAgain}
              </motion.button>
              {onClose && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl border border-white/20"
                >
                  {t.close}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ===== 유저 ID 헬퍼 =====
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
