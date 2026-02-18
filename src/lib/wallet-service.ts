
import { Coupon, PointHistory } from './consumer-types';

// 비로그인 anon ID 가져오기
function getAnonId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('airctt_anon_user_id');
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
      if (!res.ok) throw new Error('Failed to fetch coupons');
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
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
