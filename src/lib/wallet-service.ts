import { Coupon, PointHistory } from './consumer-types';

// 비로그인 anon ID 가져오기
function getAnonId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('airctt_anon_user_id');
}

// ✅ 데모 쿠폰(localStorage) → Coupon 형식으로 변환
function getLocalDemoCoupons(): Coupon[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('my-coupons');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return arr.map((c: any) => ({
      id: c.id || `demo_${Date.now()}`,
      title: c.title || c.name || '게임 획득 쿠폰',
      description: c.description || `게임에서 획득한 ${c.discount || ''} 할인 쿠폰`,
      brand: c.brand || c.storeName || '게임 보상',
      status: c.status || 'active',
      expiresAt: c.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      couponCode: c.id?.slice(-8).toUpperCase() || 'GAME0000',
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200',
      discountRate: c.points || 10,
      discountType: 'percent',
      isDemo: true,
    }));
  } catch (e) {
    return [];
  }
}

export const walletService = {
  // Helper to get headers
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
    try {
      // anon_id 파라미터 추가 (비로그인 유저도 지갑 조회 가능)
      const anonId = getAnonId();
      const url = anonId
        ? `/api/wallet/my-coupons?anon_id=${anonId}`
        : '/api/wallet/my-coupons';
      const res = await fetch(url, {
        headers: walletService.getHeaders() as any
      });

      let dbCoupons: Coupon[] = [];
      if (res.ok) {
        dbCoupons = await res.json();
      }

      // ✅ DB 쿠폰 + 데모 쿠폰(localStorage) 합치기
      const demoCoupons = getLocalDemoCoupons();

      // DB에 이미 있는 id는 데모 중복 제거
      const dbIds = new Set(dbCoupons.map((c: any) => c.id));
      const uniqueDemo = demoCoupons.filter(c => !dbIds.has(c.id));

      return [...dbCoupons, ...uniqueDemo];
    } catch (e) {
      console.error(e);
      // DB 실패해도 데모 쿠폰은 보여줌
      return getLocalDemoCoupons();
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
