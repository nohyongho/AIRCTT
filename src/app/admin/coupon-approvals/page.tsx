'use client';

import { useEffect, useState } from 'react';

interface Coupon {
  id: string;
  title: string;
  description: string;
  discount_type: string;
  discount_value: number;
  approval_status: string;
  merchant_url: string;
  image_url: string;
  created_at: string;
  merchant_id: string;
  store_id: string;
}

const ADMIN_EMAIL = 'zeus1404@gmail.com';

export default function CouponApprovalsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING_APPROVAL');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/coupon-approvals?status=${filter}`);
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (e) {
      console.error('조회 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [filter]);

  const handleAction = async (couponId: string, action: 'approve' | 'reject') => {
    setProcessing(couponId);
    try {
      const res = await fetch('/api/admin/coupon-approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_id: couponId,
          action,
          admin_email: ADMIN_EMAIL,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchCoupons();
      } else {
        alert('오류: ' + (data.error || '처리 실패'));
      }
    } catch (e) {
      alert('네트워크 오류');
    } finally {
      setProcessing(null);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING_APPROVAL: 'bg-yellow-500',
    APPROVED: 'bg-green-500',
    REJECTED: 'bg-red-500',
    DRAFT: 'bg-gray-500',
  };

  const statusLabels: Record<string, string> = {
    PENDING_APPROVAL: '승인 대기',
    APPROVED: '승인됨',
    REJECTED: '거절됨',
    DRAFT: '초안',
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">쿠폰 승인 대시보드</h1>
        <p className="text-slate-400 mb-6">사업자가 등록한 쿠폰을 승인하거나 거절합니다.</p>

        <div className="flex gap-2 mb-6">
          {['PENDING_APPROVAL', 'APPROVED', 'REJECTED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">로딩 중...</div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {statusLabels[filter]} 상태의 쿠폰이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="bg-slate-800 rounded-xl p-5 border border-slate-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-bold">{coupon.title}</h3>
                    <p className="text-slate-400 text-sm mt-1">{coupon.description}</p>
                  </div>
                  <span className={`${statusColors[coupon.approval_status]} px-3 py-1 rounded-full text-xs font-bold`}>
                    {statusLabels[coupon.approval_status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 mb-4">
                  <div>할인: {coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : `${coupon.discount_value}원`}</div>
                  <div>등록일: {new Date(coupon.created_at).toLocaleDateString('ko-KR')}</div>
                  {coupon.merchant_url && <div className="col-span-2">사이트: {coupon.merchant_url}</div>}
                </div>

                {filter === 'PENDING_APPROVAL' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction(coupon.id, 'approve')}
                      disabled={processing === coupon.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold transition disabled:opacity-50"
                    >
                      {processing === coupon.id ? '처리 중...' : '승인'}
                    </button>
                    <button
                      onClick={() => handleAction(coupon.id, 'reject')}
                      disabled={processing === coupon.id}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold transition disabled:opacity-50"
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/merchant/coupons" className="text-indigo-400 hover:text-indigo-300 mr-4">
            사업자 쿠폰 관리
          </a>
          <a href="/consumer/game" className="text-emerald-400 hover:text-emerald-300">
            크래커 게임
          </a>
        </div>
      </div>
    </div>
  );
}
