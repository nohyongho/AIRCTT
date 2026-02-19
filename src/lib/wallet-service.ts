
import { Coupon, PointHistory } from './consumer-types';

// 비로그인 anon ID 가져오기
function getAnonId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('airctt_anon_user_id');
}

// localStorage에서 게임 쿠폰 읽기
function getLocalGameCoupons(): Coupon[] {
    if (typeof window === 'undefined') return [];
    try {
          const raw = localStorage.getItem('airctt_game_coupons');
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return [];
          return parsed.map((c: any) => ({
                  id: c.id || `local-${Date.now()}-${Math.random()}`,
                  title: c.title || c.name || 'Game Coupon',
                  description: c.description || `${c.discount || c.discountRate || c.points || ''}`,
                  brand: c.brand || c.storeName || 'CouponTalkTalk',
                  status: (c.status === 'active' ? 'active' : c.status) || 'available' as Coupon['status'],
                  expiresAt: c.expiresAt || c.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  imageUrl: c.imageUrl,
                  discountRate: c.discountRate || c.discount || c.points || 0,
          }));
    } catch (e) {
          console.error('Error reading local game coupons', e);
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
                            } catch (e) {
                                        console.error('Error parsing session', e);
                            }
                  }
          }
          return { 'Content-Type': 'application/json' };
    },

    getCoupons: async (): Promise<Coupon[]> => {
          try {
                  // DB에서 쿠폰 조회
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

            // localStorage 게임 쿠폰도 합치기
            const localCoupons = getLocalGameCoupons();

            // DB 쿠폰 ID 목록으로 중복 제거
            const dbIds = new Set(dbCoupons.map(c => c.id));
                  const uniqueLocalCoupons = localCoupons.filter(c => !dbIds.has(c.id));

            return [...dbCoupons, ...uniqueLocalCoupons];
          } catch (e) {
                  console.error(e);
                  // API 실패해도 localStorage 쿠폰은 보여주기
            return getLocalGameCoupons();
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
