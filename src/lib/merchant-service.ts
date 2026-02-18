
import { 
  MerchantProfile, 
  Outlet, 
  MerchantCoupon, 
  CouponUsage, 
  MerchantOrder,
  TopUpHistory 
} from './merchant-types';

const MERCHANT_PROFILE_KEY = 'ctt_merchant_profile';
const OUTLETS_KEY = 'ctt_merchant_outlets';
const COUPONS_KEY = 'ctt_merchant_coupons';
const COUPON_USAGE_KEY = 'ctt_coupon_usage';
const ORDERS_KEY = 'ctt_merchant_orders';
const TOPUP_KEY = 'ctt_topup_history';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateCouponCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const merchantProfileService = {
  get: (): MerchantProfile | null => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(MERCHANT_PROFILE_KEY);
    return data ? JSON.parse(data) : null;
  },

  save: (profile: Partial<MerchantProfile>): MerchantProfile => {
    const existing = merchantProfileService.get();
    const updated: MerchantProfile = {
      id: existing?.id || generateId('merchant'),
      name: profile.name || existing?.name || '',
      type: profile.type || existing?.type || 'OTHER',
      businessNumber: profile.businessNumber || existing?.businessNumber || '',
      ownerName: profile.ownerName || existing?.ownerName || '',
      phone: profile.phone || existing?.phone || '',
      email: profile.email || existing?.email || '',
      address: profile.address || existing?.address || '',
      description: profile.description || existing?.description,
      logoUrl: profile.logoUrl || existing?.logoUrl,
      coverImageUrl: profile.coverImageUrl || existing?.coverImageUrl,
      openingHours: profile.openingHours || existing?.openingHours,
      status: profile.status || existing?.status || 'ACTIVE',
      balance: profile.balance ?? existing?.balance ?? 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(MERCHANT_PROFILE_KEY, JSON.stringify(updated));
    return updated;
  },

  initDemo: (): MerchantProfile => {
    const existing = merchantProfileService.get();
    if (existing) return existing;

    return merchantProfileService.save({
      name: 'Jollibee',
      type: 'RESTAURANT',
      businessNumber: '123-45-67890',
      ownerName: 'Tony Tan',
      phone: '+971-50-123-4567',
      email: 'jollibee@ctt.com',
      address: 'Business Bay, Dubai, UAE',
      description: 'Fast food restaurant chain',
      balance: 50000,
      status: 'ACTIVE',
    });
  },
};

export const outletService = {
  getAll: (): Outlet[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(OUTLETS_KEY);
    return data ? JSON.parse(data) : [];
  },

  create: (outlet: Omit<Outlet, 'id' | 'createdAt'>): Outlet => {
    const outlets = outletService.getAll();
    const newOutlet: Outlet = {
      ...outlet,
      id: generateId('outlet'),
      createdAt: new Date().toISOString(),
    };
    outlets.push(newOutlet);
    localStorage.setItem(OUTLETS_KEY, JSON.stringify(outlets));
    return newOutlet;
  },

  update: (id: string, updates: Partial<Outlet>): Outlet | null => {
    const outlets = outletService.getAll();
    const index = outlets.findIndex(o => o.id === id);
    if (index === -1) return null;
    
    outlets[index] = { ...outlets[index], ...updates };
    localStorage.setItem(OUTLETS_KEY, JSON.stringify(outlets));
    return outlets[index];
  },

  delete: (id: string): boolean => {
    const outlets = outletService.getAll();
    const filtered = outlets.filter(o => o.id !== id);
    if (filtered.length === outlets.length) return false;
    
    localStorage.setItem(OUTLETS_KEY, JSON.stringify(filtered));
    return true;
  },

  initDemo: (): void => {
    const existing = outletService.getAll();
    if (existing.length > 0) return;

    const profile = merchantProfileService.get();
    if (!profile) return;

    outletService.create({
      merchantId: profile.id,
      name: 'Business Bay',
      address: 'Marasi Drive, Business Bay',
      phone: '+971-50-111-2222',
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
      latitude: 25.1857,
      longitude: 55.2744,
      status: 'ACTIVE',
    });

    outletService.create({
      merchantId: profile.id,
      name: 'Dubai Mall',
      address: 'Sheikh Zayed Road, Downtown Dubai',
      phone: '+971-50-333-4444',
      imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200',
      latitude: 25.1972,
      longitude: 55.2744,
      status: 'ACTIVE',
    });
  },
};

export const couponService = {
  getAll: (): MerchantCoupon[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(COUPONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  getById: (id: string): MerchantCoupon | null => {
    const coupons = couponService.getAll();
    return coupons.find(c => c.id === id) || null;
  },

  create: (coupon: Omit<MerchantCoupon, 'id' | 'code' | 'usedQuantity' | 'createdAt'>): MerchantCoupon => {
    const coupons = couponService.getAll();
    const newCoupon: MerchantCoupon = {
      ...coupon,
      id: generateId('coupon'),
      code: generateCouponCode(),
      usedQuantity: 0,
      createdAt: new Date().toISOString(),
    };
    coupons.push(newCoupon);
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
    return newCoupon;
  },

  update: (id: string, updates: Partial<MerchantCoupon>): MerchantCoupon | null => {
    const coupons = couponService.getAll();
    const index = coupons.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    coupons[index] = { ...coupons[index], ...updates };
    localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
    return coupons[index];
  },

  delete: (id: string): boolean => {
    const coupons = couponService.getAll();
    const filtered = coupons.filter(c => c.id !== id);
    if (filtered.length === coupons.length) return false;
    
    localStorage.setItem(COUPONS_KEY, JSON.stringify(filtered));
    return true;
  },

  initDemo: (): void => {
    const existing = couponService.getAll();
    
    // 만료된 쿠폰 자동 완료 처리
    const now = new Date();
    existing.forEach(c => {
      if (c.status === 'ACTIVE' && c.validUntil && new Date(c.validUntil) < now) {
        couponService.update(c.id, { status: 'INACTIVE' });
      }
    });

    // 활성 쿠폰이 없으면 새 데모 생성 (만료된 것만 있어도 새로 만듦)
    const refreshed = couponService.getAll();
    const hasActive = refreshed.some(c => c.status === 'ACTIVE');
    if (hasActive) return;

    const profile = merchantProfileService.get();
    if (!profile) return;

    couponService.create({
      merchantId: profile.id,
      title: 'Chicken Burger',
      description: '10% discount on Chicken Burger',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minPurchaseAmount: 50000,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450f58cd?w=400&q=80',
      validFrom: '2025-01-01',
      validUntil: '2026-12-31',
      totalQuantity: 100,
      status: 'ACTIVE',
    });
  },
};

export const couponUsageService = {
  getAll: (): CouponUsage[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(COUPON_USAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  create: (usage: Omit<CouponUsage, 'id' | 'usedAt'>): CouponUsage => {
    const usages = couponUsageService.getAll();
    const newUsage: CouponUsage = {
      ...usage,
      id: generateId('usage'),
      usedAt: new Date().toISOString(),
    };
    usages.push(newUsage);
    localStorage.setItem(COUPON_USAGE_KEY, JSON.stringify(usages));

    const coupon = couponService.getById(usage.couponId);
    if (coupon) {
      couponService.update(coupon.id, {
        usedQuantity: coupon.usedQuantity + 1,
      });
    }

    return newUsage;
  },

  search: (query: string): CouponUsage[] => {
    const usages = couponUsageService.getAll();
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return usages;

    return usages.filter(u =>
      u.couponCode.toLowerCase().includes(lowerQuery) ||
      u.customerName.toLowerCase().includes(lowerQuery)
    );
  },

  initDemo: (): void => {
    const existing = couponUsageService.getAll();
    if (existing.length > 0) return;

    const coupons = couponService.getAll();
    if (coupons.length === 0) return;

    const coupon = coupons[0];
    couponUsageService.create({
      couponId: coupon.id,
      couponCode: coupon.code,
      couponTitle: coupon.title,
      customerId: 'customer_1',
      customerName: 'Hassan Shahroon',
      originalPrice: 100000,
      discountAmount: 10000,
      finalPrice: 90000,
      status: 'USED',
    });
  },
};

export const topUpService = {
  getAll: (): TopUpHistory[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(TOPUP_KEY);
    return data ? JSON.parse(data) : [];
  },

  create: (topUp: Omit<TopUpHistory, 'id' | 'createdAt' | 'status'>): TopUpHistory => {
    const history = topUpService.getAll();
    const newTopUp: TopUpHistory = {
      ...topUp,
      id: generateId('topup'),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    history.push(newTopUp);
    localStorage.setItem(TOPUP_KEY, JSON.stringify(history));
    return newTopUp;
  },

  complete: (id: string): TopUpHistory | null => {
    const history = topUpService.getAll();
    const index = history.findIndex(h => h.id === id);
    if (index === -1) return null;

    history[index] = {
      ...history[index],
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(TOPUP_KEY, JSON.stringify(history));

    const profile = merchantProfileService.get();
    if (profile) {
      merchantProfileService.save({
        balance: profile.balance + history[index].amount,
      });
    }

    return history[index];
  },
};

export function initMerchantDemo(): void {
  merchantProfileService.initDemo();
  outletService.initDemo();
  couponService.initDemo();
  couponUsageService.initDemo();
}
