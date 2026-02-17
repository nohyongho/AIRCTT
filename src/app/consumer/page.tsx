
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, RefreshCw, Loader2, Gamepad2, Wallet, List, X, ChevronUp } from 'lucide-react';

// Leaflet CSS를 동적으로 로드
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

interface NearbyCouponMapItem {
  coupon_id: string;
  store_id: string;
  store_name: string;
  store_address: string;
  title: string;
  description: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  radius_km: number;
  distance_km: number;
  valid_to: string | null;
  product_sku: string | null;
  coupon_group_key: string | null;
  asset_type: string | null;
  center_lat?: number;
  center_lng?: number;
  store_lat?: number;
  store_lng?: number;
}

export default function ConsumerMapPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const circlesRef = useRef<L.LayerGroup | null>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [coupons, setCoupons] = useState<NearbyCouponMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<NearbyCouponMapItem | null>(null);
  const [showList, setShowList] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Leaflet CSS 로드
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
  }, []);

  // 위치 가져오기
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('위치 서비스를 지원하지 않는 브라우저입니다.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error('Geolocation error:', err);
        // 기본 위치: 서울 시청
        setUserLocation({ lat: 37.5665, lng: 126.978 });
        setLocationError('위치를 가져올 수 없어 서울 기본 위치를 사용합니다.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // 근처 쿠폰 가져오기
  const fetchCoupons = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coupons/nearby?lat=${lat}&lng=${lng}&radius=5&limit=50`);
      const data = await res.json();
      if (data.success && data.data) {
        setCoupons(data.data);
      } else {
        setCoupons([]);
      }
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchCoupons(userLocation.lat, userLocation.lng);
    }
  }, [userLocation, fetchCoupons]);

  // Leaflet 지도 초기화
  useEffect(() => {
    if (!userLocation || !mapRef.current || mapReady) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      // 기존 맵 제거
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }

      const map = L.map(mapRef.current!, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      // OpenStreetMap 타일
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // 줌 컨트롤 (우측)
      L.control.zoom({ position: 'topright' }).addTo(map);

      // 내 위치 마커
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="
          width: 20px; height: 20px;
          background: #3b82f6;
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 0 15px rgba(59,130,246,0.6), 0 2px 8px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute; top: -4px; left: -4px;
          width: 28px; height: 28px;
          background: rgba(59,130,246,0.2);
          border-radius: 50%;
          animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>📍 내 위치</b>');

      // 마커 & 원 레이어 그룹
      markersRef.current = L.layerGroup().addTo(map);
      circlesRef.current = L.layerGroup().addTo(map);

      leafletMapRef.current = map;
      setMapReady(true);

      // 리사이즈 핸들러
      const handleResize = () => map.invalidateSize();
      window.addEventListener('resize', handleResize);
      setTimeout(() => map.invalidateSize(), 100);

      return () => window.removeEventListener('resize', handleResize);
    };

    initMap();
  }, [userLocation, mapReady]);

  // 쿠폰 마커 업데이트
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current || !markersRef.current || !circlesRef.current) return;

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default;

      markersRef.current!.clearLayers();
      circlesRef.current!.clearLayers();

      coupons.forEach((coupon) => {
        // 매장 위치 (store_lat/lng 또는 center_lat/lng)
        const lat = coupon.store_lat || coupon.center_lat || (userLocation?.lat || 37.5665) + (Math.random() - 0.5) * 0.02;
        const lng = coupon.store_lng || coupon.center_lng || (userLocation?.lng || 126.978) + (Math.random() - 0.5) * 0.02;

        // 할인 표시
        const discountText = coupon.discount_type === 'percent'
          ? `${coupon.discount_value}%`
          : `${Math.round(coupon.discount_value / 1000)}천`;

        // 색상 (할인율에 따라)
        const getColor = () => {
          if (coupon.discount_type === 'percent') {
            if (coupon.discount_value >= 50) return { bg: '#ef4444', border: '#dc2626', text: 'white' };
            if (coupon.discount_value >= 30) return { bg: '#f97316', border: '#ea580c', text: 'white' };
            if (coupon.discount_value >= 15) return { bg: '#eab308', border: '#ca8a04', text: 'black' };
            return { bg: '#22c55e', border: '#16a34a', text: 'white' };
          }
          if (coupon.discount_value >= 10000) return { bg: '#ef4444', border: '#dc2626', text: 'white' };
          if (coupon.discount_value >= 5000) return { bg: '#f97316', border: '#ea580c', text: 'white' };
          return { bg: '#22c55e', border: '#16a34a', text: 'white' };
        };

        const color = getColor();

        // 카테고리 아이콘
        const getCategoryEmoji = () => {
          const name = (coupon.store_name + coupon.title).toLowerCase();
          if (name.includes('커피') || name.includes('카페') || name.includes('아메리카노')) return '☕';
          if (name.includes('피자') || name.includes('치킨') || name.includes('버거')) return '🍕';
          if (name.includes('케이크') || name.includes('디저트') || name.includes('빵')) return '🍰';
          if (name.includes('뷰티') || name.includes('미용')) return '💄';
          return '🎫';
        };

        // 쿠폰 마커
        const couponIcon = L.divIcon({
          className: 'coupon-marker',
          html: `<div style="
            position: relative; cursor: pointer;
            background: ${color.bg}; color: ${color.text};
            border: 2px solid ${color.border};
            border-radius: 20px;
            padding: 4px 10px;
            font-weight: 800; font-size: 12px;
            white-space: nowrap;
            box-shadow: 0 3px 12px rgba(0,0,0,0.3);
            display: flex; align-items: center; gap: 3px;
            transform: translateX(-50%);
          ">
            <span>${getCategoryEmoji()}</span>
            <span>${discountText} ${coupon.title.length > 4 ? coupon.title.substring(0, 4) : coupon.title}</span>
          </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([lat, lng], { icon: couponIcon });
        marker.on('click', () => setSelectedCoupon(coupon));
        markersRef.current!.addLayer(marker);

        // 배포 반경 원
        if (coupon.radius_km) {
          const circle = L.circle([lat, lng], {
            radius: coupon.radius_km * 1000,
            color: color.bg,
            fillColor: color.bg,
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '5, 5',
            opacity: 0.4,
          });
          circlesRef.current!.addLayer(circle);
        }
      });
    };

    updateMarkers();
  }, [coupons, mapReady, userLocation]);

  // 내 위치로 이동
  const handleCenterMap = () => {
    if (leafletMapRef.current && userLocation) {
      leafletMapRef.current.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 1 });
    }
  };

  // 새로고침
  const handleRefresh = () => {
    if (userLocation) {
      fetchCoupons(userLocation.lat, userLocation.lng);
    }
  };

  // 거리 포맷
  const formatDistance = (km: number) => km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Ping 애니메이션 CSS */}
      <style jsx global>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
        .coupon-marker { background: none !important; border: none !important; }
        .user-location-marker { background: none !important; border: none !important; }
        .leaflet-control-zoom { border-radius: 12px !important; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important; }
        .leaflet-control-zoom a { width: 36px !important; height: 36px !important; line-height: 36px !important; font-size: 18px !important; }
      `}</style>

      {/* 지도 */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <span className="text-slate-700 font-medium">
              {!userLocation ? '위치 확인 중...' : '근처 쿠폰 검색 중...'}
            </span>
          </div>
        </div>
      )}

      {/* 상단 로고 오버레이 */}
      <div className="absolute top-3 left-3 z-20">
        <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <div className="font-extrabold text-white text-sm tracking-wide">AIRCTT</div>
            <div className="text-[10px] text-gray-400">CouponTalkTalk</div>
          </div>
        </div>
      </div>

      {/* 우측 컨트롤 버튼 */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <button
          onClick={handleCenterMap}
          className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition"
        >
          <Navigation className="w-5 h-5 text-blue-500" />
        </button>
        <button
          onClick={handleRefresh}
          className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setShowList(!showList)}
          className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition ${showList ? 'bg-indigo-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          <List className="w-5 h-5" />
        </button>
      </div>

      {/* 쿠폰 개수 표시 */}
      {!loading && coupons.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
            📍 근처 쿠폰 {coupons.length}개
          </div>
        </div>
      )}

      {/* 빠른 액션 버튼 (하단) */}
      <div className="absolute bottom-4 left-4 right-4 z-20">
        {/* 선택된 쿠폰 카드 */}
        {selectedCoupon && (
          <div className="mb-3 bg-white rounded-2xl shadow-xl border overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      selectedCoupon.discount_type === 'percent'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedCoupon.discount_type === 'percent'
                        ? `${selectedCoupon.discount_value}% 할인`
                        : `${selectedCoupon.discount_value.toLocaleString()}원 할인`}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistance(selectedCoupon.distance_km)}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900">{selectedCoupon.title}</h3>
                  <p className="text-sm text-gray-500">{selectedCoupon.store_name}</p>
                  {selectedCoupon.store_address && (
                    <p className="text-xs text-gray-400 mt-1">{selectedCoupon.store_address}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCoupon(null)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => router.push('/consumer/game')}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Gamepad2 className="w-4 h-4" /> 게임으로 획득
                </button>
                <button
                  onClick={() => router.push('/consumer/wallet')}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Wallet className="w-4 h-4" /> 내 지갑
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 빠른 이동 바 (쿠폰 선택 안 됐을 때) */}
        {!selectedCoupon && !showList && (
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/consumer/game')}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
            >
              <Gamepad2 className="w-5 h-5" /> 쿠폰 게임
            </button>
            <button
              onClick={() => router.push('/consumer/wallet')}
              className="flex-1 bg-white text-gray-700 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg border active:scale-95 transition"
            >
              <Wallet className="w-5 h-5" /> 내 지갑
            </button>
          </div>
        )}
      </div>

      {/* 쿠폰 목록 슬라이드 업 패널 */}
      {showList && (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl max-h-[60vh] overflow-y-auto animate-in slide-in-from-bottom">
          <div className="sticky top-0 bg-white rounded-t-3xl border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-gray-900">근처 쿠폰 목록</h3>
              <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {coupons.length}개
              </span>
            </div>
            <button onClick={() => setShowList(false)} className="p-1 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            {coupons.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>근처에 쿠폰이 없어요</p>
              </div>
            ) : (
              coupons.map((coupon) => (
                <button
                  key={coupon.coupon_id}
                  onClick={() => {
                    setSelectedCoupon(coupon);
                    setShowList(false);
                    // 해당 위치로 이동
                    if (leafletMapRef.current) {
                      const lat = coupon.store_lat || coupon.center_lat || userLocation?.lat || 37.5665;
                      const lng = coupon.store_lng || coupon.center_lng || userLocation?.lng || 126.978;
                      leafletMapRef.current.flyTo([lat, lng], 16, { duration: 0.8 });
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition text-left"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                    coupon.discount_type === 'percent'
                      ? coupon.discount_value >= 30 ? 'bg-red-500' : 'bg-orange-500'
                      : coupon.discount_value >= 5000 ? 'bg-red-500' : 'bg-green-500'
                  }`}>
                    {coupon.discount_type === 'percent'
                      ? `${coupon.discount_value}%`
                      : `${Math.round(coupon.discount_value / 1000)}천`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{coupon.title}</p>
                    <p className="text-sm text-gray-500 truncate">{coupon.store_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-blue-500 font-medium">
                        📍 {formatDistance(coupon.distance_km)}
                      </span>
                      {coupon.valid_to && (
                        <span className="text-xs text-gray-400">
                          ⏰ {new Date(coupon.valid_to).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}까지
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronUp className="w-4 h-4 text-gray-300 rotate-90" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 위치 오류 알림 */}
      {locationError && (
        <div className="absolute top-16 left-4 right-4 z-20">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-700 shadow">
            ⚠️ {locationError}
          </div>
        </div>
      )}
    </div>
  );
}
