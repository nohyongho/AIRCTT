import { Coupon, PointHistory } from './consumer-types';

// 비로그인 anon ID 가져오기
function getAnonId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('airctt_anon_user_id');
}

// ✅ 게임 데모 쿠폰(localStorage 'my-coupons') → Coupon 형식으로 변환
function getLocalDemoCoupons(): Coupon[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('my-coupons');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return arr.map((c: any) => ({
      id: c.id || `demo_${Math.random().toString(36).slice(2)}`,
      title: c.title || c.name || '게임 획득 쿠폰',
      description: c.description || `게임에서 획득한 ${c.discount || ''} 할인 쿠폰`,
      brand: c.brand || c.storeName || '게임 보상',
      status: 'available' as const,
      expiresAt: c.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200',
      discountRate: c.points || 10,
      discountType: 'percent',
      couponCode: (c.id || '').slice(-8).toUpperCase() || 'GAME0000',
      isDemo: true,
    }));
  } catch (e) {
    return [];
  }
}

export const walletService = {
  getHeaders: () => {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('airctt_consumer_session');
      if (session) {
        try {
          const { access_token } = JSON.parse(session);
          return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
          };
        } catch (e) { console.error('Error parsing session', e); }
      }
    }
    return { 'Content-Type': 'application/json' };
  },

  getCoupons: async (): Promise<Coupon[]> => {
    // ✅ 데모 쿠폰 먼저 읽기 (로컬, 항상 존재)
    const demoCoupons = getLocalDemoCoupons();

    try {
      const anonId = getAnonId();
      const url = anonId
        ? `/api/wallet/my-coupons?anon_id=${anonId}`
        : '/api/wallet/my-coupons';
      const res = await fetch(url, {
        headers: walletService.getHeaders() as any
      });

      if (!res.ok) {
        // DB 실패 → 데모 쿠폰만이라도 보여줌
        return demoCoupons;
      }

      const dbCoupons: Coupon[] = await res.json();

      // DB에 이미 있는 id는 데모에서 제거 (중복 방지)
      const dbIds = new Set(dbCoupons.map((c: any) => c.id));
      const uniqueDemo = demoCoupons.filter(c => !dbIds.has(c.id));

      // ✅ DB 쿠폰 + 데모 쿠폰 합치기
      return [...dbCoupons, ...uniqueDemo];
    } catch (e) {
      console.error('getCoupons error:', e);
      // DB 오류여도 데모 쿠폰은 보여줌
      return demoCoupons;
    }
  },

  getPointBalance: async (): Promise<number> => {
    try {
      const res = await fetch('/api/wallet/my-balance', {
        headers: walletService.getHeaders() as any
      });
      if (!res.ok) throw new Error('Failed to fetch balance');
      const data = await res.json();
      return data.balance;
    } catch (e) {
      console.error(e);
      return 0;
    }
  },

  getPointHistory: async (): Promise<PointHistory[]> => {
    try {
      const res = await fetch('/api/wallet/my-history', {
        headers: walletService.getHeaders() as any
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },
};
