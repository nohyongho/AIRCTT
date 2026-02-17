'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Crosshair, Gamepad2, Sliders, X, Loader2, Gift, Share2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface CouponMarker {
  id: string;
  coupon_id: string;
  name: string;
  storeName: string;
  storeAddress: string;
  discount: string;
  discountType: 'percent' | 'amount';
  discountValue: number;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  distanceKm: number;
  validUntil?: string;
  description?: string;
  couponGroupKey?: string;
}

// API 응답을 CouponMarker로 변환
function apiToCouponMarker(item: any): CouponMarker {
  const colors = ['#FF6B35', '#6C3CE1', '#E11D48', '#2563EB', '#EC4899', '#059669', '#D97706', '#7C3AED'];
  const colorIndex = Math.abs(hashCode(item.coupon_id || item.store_id || '')) % colors.length;

  const discount = item.discount_type === 'percent'
    ? `${item.discount_value}%`
    : `${Number(item.discount_value).toLocaleString()}`;

  return {
    id: item.coupon_id || item.id,
    coupon_id: item.coupon_id || item.id,
    name: item.title,
    storeName: item.store_name,
    storeAddress: item.store_address || '',
    discount,
    discountType: item.discount_type,
    discountValue: item.discount_value,
    lat: item.store_lat || item.lat || 37.5665,
    lng: item.store_lng || item.lng || 126.978,
    radiusM: (item.radius_km || item.distance_km || 1) * 1000,
    color: colors[colorIndex],
    distanceKm: item.distance_km || 0,
    validUntil: item.valid_until,
    description: item.description,
    couponGroupKey: item.coupon_group_key,
  };
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

// 유저 ID (데모)
function getUserId(): string {
  if (typeof window === 'undefined') return 'demo_user';
  let uid = localStorage.getItem('airctt_user_id');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('airctt_user_id', uid);
  }
  return uid;
}

export default function CouponMapMain() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const [L, setL] = useState<any>(null);
  const [userLocation, setUserLocation] = useState({ lat: 37.5665, lng: 126.978 });
  const [radiusFilter, setRadiusFilter] = useState(5000); // 5km
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponMarker | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [gifting, setGifting] = useState(false);
  const [coupons, setCoupons] = useState<CouponMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationReady, setLocationReady] = useState(false);

  // Leaflet 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((leaflet) => {
        setL(leaflet.default);
      });
    }
  }, []);

  // 사용자 위치 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationReady(true);
        },
        () => {
          console.log('위치 권한 거부됨, 서울 기본값 사용');
          setLocationReady(true);
        }
      );
    } else {
      setLocationReady(true);
    }
  }, []);

  // 근처 쿠폰 API 호출
  useEffect(() => {
    if (!locationReady) return;
    fetchCoupons();
  }, [locationReady, radiusFilter]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const radiusKm = radiusFilter / 1000;
      const res = await fetch(
        `/api/coupons/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radiusKm}&limit=30`
      );
      const result = await res.json();

      if (result.success && result.data) {
        const markers = result.data.map(apiToCouponMarker);
        setCoupons(markers);

        // 지도에 마커 다시 렌더링
        if (leafletMap.current && L) {
          renderMarkers(markers);
        }
      } else {
        console.error('Nearby API error:', result.error);
        // 데이터가 없으면 데모 데이터 사용
        if (result.data?.length === 0) {
          toast.info('주변에 등록된 쿠폰이 아직 없습니다');
        }
      }
    } catch (err) {
      console.error('Fetch coupons error:', err);
      toast.error('쿠폰 조회 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  // 지도 초기화
  useEffect(() => {
    if (!L || !mapRef.current) return;

    // CSS 동적 로드
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // 지도 생성
    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([userLocation.lat, userLocation.lng], 13);

    // 타일 레이어
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // 줌 컨트롤 우상단에 추가
    L.control.zoom({ position: 'topright' }).addTo(map);

    leafletMap.current = map;

    // 마커 생성
    renderMarkers(coupons);

    return () => {
      map.remove();
    };
  }, [L, userLocation]);

  // 쿠폰 변경 시 마커 업데이트
  useEffect(() => {
    if (leafletMap.current && L && coupons.length > 0) {
      renderMarkers(coupons);
    }
  }, [coupons]);

  // 마커 렌더링
  const renderMarkers = (couponList: CouponMarker[]) => {
    if (!L || !leafletMap.current) return;

    // 기존 마커 및 서클 제거
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    circlesRef.current.forEach(c => c.remove());
    circlesRef.current = [];

    // 사용자 위치 마커
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: L.divIcon({
        className: 'custom-user-marker',
        html: `<div style="
          width: 20px;
          height: 20px;
          background: #3B82F6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
      }),
    }).addTo(leafletMap.current);
    markersRef.current.push(userMarker);

    // 쿠폰 마커
    couponList.forEach((coupon) => {
      const marker = L.marker([coupon.lat, coupon.lng], {
        icon: L.divIcon({
          className: 'custom-coupon-marker',
          html: `
            <div style="
              background: ${coupon.color};
              color: white;
              padding: 8px 12px;
              border-radius: 20px;
              font-weight: bold;
              font-size: 12px;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              border: 2px solid white;
              cursor: pointer;
              transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
              ${coupon.discount} ${coupon.name.length > 6 ? coupon.name.slice(0, 6) + '..' : coupon.name}
            </div>
          `,
          iconSize: [120, 40],
        }),
      }).addTo(leafletMap.current);

      marker.on('click', () => {
        setSelectedCoupon(coupon);
      });

      // 반경 표시
      const circle = L.circle([coupon.lat, coupon.lng], {
        radius: coupon.radiusM,
        color: coupon.color,
        fillColor: coupon.color,
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(leafletMap.current);

      markersRef.current.push(marker);
      circlesRef.current.push(circle);
    });

    // 마커가 있으면 모든 마커가 보이도록 지도 조정
    if (couponList.length > 0) {
      const bounds = L.latLngBounds(
        couponList.map((c: CouponMarker) => [c.lat, c.lng])
      );
      bounds.extend([userLocation.lat, userLocation.lng]);
      leafletMap.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  };

  // 내 위치로 이동
  const goToMyLocation = () => {
    if (leafletMap.current) {
      leafletMap.current.setView([userLocation.lat, userLocation.lng], 15);
    }
  };

  // 반경 필터 포맷
  const formatRadius = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
    return `${m}m`;
  };

  // 거리 포맷
  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  // 쿠폰 받기 (acquire API)
  const handleClaimCoupon = async (coupon: CouponMarker) => {
    setClaiming(true);
    try {
      const userId = getUserId();
      const response = await fetch('/api/coupons/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          coupon_id: coupon.coupon_id,
          lat: userLocation.lat,
          lng: userLocation.lng,
          claimed_via: 'map',
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.action === 'ACQUIRED') {
          toast.success(`🎉 쿠폰을 받았어요! ${data.data?.title || coupon.name}`);

          // localStorage에도 저장 (지갑과 연동)
          const existing = JSON.parse(localStorage.getItem('my-coupons') || '[]');
          localStorage.setItem('my-coupons', JSON.stringify([
            ...existing,
            {
              ...coupon,
              issue_id: data.data?.issue_id,
              coupon_code: data.data?.coupon_code,
              claimedAt: new Date().toISOString(),
              status: 'available',
            }
          ]));

          setTimeout(() => setSelectedCoupon(null), 1500);
        } else if (data.action === 'MOTION_ONLY') {
          toast.info('이미 더 좋은 쿠폰을 보유 중이에요!');
        }
      } else {
        if (data.error === 'SOLD_OUT') {
          toast.error('이 쿠폰은 모두 소진되었습니다');
        } else if (data.error === 'COUPON_NOT_APPROVED') {
          toast.error('아직 승인되지 않은 쿠폰입니다');
        } else {
          toast.error(data.error || '쿠폰 받기 실패');
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('쿠폰 받기 중 오류 발생');
    } finally {
      setClaiming(false);
    }
  };

  // 선물하기
  const handleGiftCoupon = async (coupon: CouponMarker) => {
    setGifting(true);
    try {
      const userId = getUserId();

      // 먼저 쿠폰을 획득
      const acquireRes = await fetch('/api/coupons/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          coupon_id: coupon.coupon_id,
          lat: userLocation.lat,
          lng: userLocation.lng,
          claimed_via: 'map',
        }),
      });
      const acquireData = await acquireRes.json();

      if (!acquireData.success || acquireData.action !== 'ACQUIRED') {
        toast.error('쿠폰을 먼저 받아야 선물할 수 있어요');
        setGifting(false);
        return;
      }

      // 선물 토큰 생성
      const giftRes = await fetch('/api/coupons/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_issue_id: acquireData.data.issue_id,
          sender_id: userId,
        }),
      });
      const giftData = await giftRes.json();

      if (giftData.success) {
        const giftUrl = giftData.gift_url;

        // 공유 기능
        if (navigator.share) {
          await navigator.share({
            title: `${coupon.name} 쿠폰 선물`,
            text: `${coupon.storeName}에서 사용할 수 있는 ${coupon.discount} 할인 쿠폰을 선물합니다!`,
            url: giftUrl,
          });
          toast.success('선물 링크를 공유했어요!');
        } else {
          // 클립보드 복사
          await navigator.clipboard.writeText(giftUrl);
          toast.success('선물 링크가 복사되었어요! 친구에게 보내주세요 💝');
        }

        setTimeout(() => setSelectedCoupon(null), 1500);
      } else {
        toast.error(giftData.error || '선물 생성 실패');
      }
    } catch (error) {
      console.error(error);
      toast.error('선물하기 중 오류 발생');
    } finally {
      setGifting(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 지도 */}
      <div ref={mapRef} className="w-full h-full" />

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 z-[1001] bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            <span className="text-sm font-medium">쿠폰 검색 중...</span>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-extrabold text-2xl drop-shadow-lg">AIRCTT</h1>
            <p className="text-white/90 text-xs">위치 기반 쿠폰 지도</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="icon"
              onClick={() => router.push('/consumer/wallet')}
              className="bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30"
            >
              <Wallet className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30"
            >
              <Sliders className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 반경 필터 패널 */}
      {showFilterPanel && (
        <div className="absolute top-20 right-4 z-[1000] bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-4 w-80 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white">반경 필터</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilterPanel(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">검색 반경</span>
              <span className="font-bold text-purple-600">{formatRadius(radiusFilter)}</span>
            </div>
            <Slider
              value={[radiusFilter]}
              onValueChange={([v]) => setRadiusFilter(v)}
              min={100}
              max={20000}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>100m</span>
              <span>5km</span>
              <span>20km</span>
            </div>
          </div>
        </div>
      )}

      {/* 우하단 버튼들 */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-3">
        {/* 내 위치 */}
        <Button
          size="icon"
          onClick={goToMyLocation}
          className="w-14 h-14 rounded-full bg-white hover:bg-slate-100 text-slate-900 shadow-xl"
        >
          <Crosshair className="w-6 h-6" />
        </Button>

        {/* AR 게임 */}
        <Button
          onClick={() => router.push('/consumer/game')}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-xl hover:scale-110 transition-transform"
        >
          <Gamepad2 className="w-6 h-6" />
        </Button>
      </div>

      {/* 쿠폰 상세 팝업 */}
      {selectedCoupon && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] p-4">
          <Card className="max-w-md mx-auto shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <Badge style={{ backgroundColor: selectedCoupon.color }} className="text-white mb-2">
                    {selectedCoupon.discountType === 'percent'
                      ? `${selectedCoupon.discount} OFF`
                      : `${selectedCoupon.discount}원 할인`}
                  </Badge>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedCoupon.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {selectedCoupon.storeName}
                  </p>
                  {selectedCoupon.distanceKm > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDistance(selectedCoupon.distanceKm)} 거리
                    </p>
                  )}
                  {selectedCoupon.description && (
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {selectedCoupon.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCoupon(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  onClick={() => handleClaimCoupon(selectedCoupon)}
                  disabled={claiming || gifting}
                >
                  {claiming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      받는 중...
                    </>
                  ) : (
                    '쿠폰 받기'
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleGiftCoupon(selectedCoupon)}
                  disabled={claiming || gifting}
                >
                  {gifting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      선물하기
                    </>
                  )}
                </Button>
              </div>

              {/* 매장 상세 버튼 */}
              <Button
                variant="ghost"
                className="w-full mt-2 text-sm"
                onClick={() => router.push(`/consumer/stores/${selectedCoupon.id}`)}
              >
                매장 상세 보기
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 하단 상태바 (쿠폰 개수) */}
      <div className="absolute bottom-6 left-6 z-[1000]">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            🎫 주변 쿠폰 <span className="text-purple-600">{coupons.length}</span>개
          </p>
        </div>
      </div>
    </div>
  );
}
