'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Crosshair, Gamepad2, Sliders, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface CouponMarker {
  id: string;
  name: string;
  storeName: string;
  discount: string;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
}

export default function CouponMapMain() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [L, setL] = useState<any>(null);
  const [userLocation, setUserLocation] = useState({ lat: 37.5665, lng: 126.978 }); // 서울 기본
  const [radiusFilter, setRadiusFilter] = useState(5000); // 5km 기본
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponMarker | null>(null);
  const [claiming, setClaiming] = useState(false);

  // 데모 쿠폰 데이터
  const [coupons] = useState<CouponMarker[]>([
    { id: '1', name: '피자 30% 할인', storeName: '피자헛 강남점', discount: '30%', lat: 37.5665, lng: 126.978, radiusM: 1000, color: '#FF6B35' },
    { id: '2', name: '커피 50% 할인', storeName: '스타벅스 역삼점', discount: '50%', lat: 37.5000, lng: 127.0363, radiusM: 2000, color: '#6C3CE1' },
    { id: '3', name: '치킨 1+1', storeName: 'BBQ 선릉점', discount: '1+1', lat: 37.5048, lng: 127.0489, radiusM: 1500, color: '#E11D48' },
    { id: '4', name: '영화 예매 40%', storeName: 'CGV 강남', discount: '40%', lat: 37.5013, lng: 127.0268, radiusM: 3000, color: '#2563EB' },
    { id: '5', name: '디저트 무료', storeName: '설빙 삼성점', discount: 'FREE', lat: 37.5090, lng: 127.0636, radiusM: 800, color: '#EC4899' },
  ]);

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
        },
        () => {
          console.log('위치 권한 거부됨, 서울 기본값 사용');
        }
      );
    }
  }, []);

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
      zoomControl: false, // 기본 줌 컨트롤 숨김
    }).setView([userLocation.lat, userLocation.lng], 13);

    // 타일 레이어
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // 줌 컨트롤 우상단에 추가
    L.control.zoom({ position: 'topright' }).addTo(map);

    leafletMap.current = map;

    // 마커 생성
    renderMarkers();

    return () => {
      map.remove();
    };
  }, [L, userLocation]);

  // 마커 렌더링
  const renderMarkers = () => {
    if (!L || !leafletMap.current) return;

    // 기존 마커 제거
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

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
    coupons.forEach((coupon) => {
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
              ${coupon.discount} ${coupon.name.split(' ')[0]}
            </div>
          `,
          iconSize: [100, 40],
        }),
      }).addTo(leafletMap.current);

      marker.on('click', () => {
        setSelectedCoupon(coupon);
      });

      // 반경 표시
      L.circle([coupon.lat, coupon.lng], {
        radius: coupon.radiusM,
        color: coupon.color,
        fillColor: coupon.color,
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(leafletMap.current);

      markersRef.current.push(marker);
    });
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

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 지도 */}
      <div ref={mapRef} className="w-full h-full" />

      {/* 상단 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-extrabold text-2xl drop-shadow-lg">AIRCTT</h1>
            <p className="text-white/90 text-xs">위치 기반 쿠폰 지도</p>
          </div>
          <Button
            size="icon"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30"
          >
            <Sliders className="w-5 h-5" />
          </Button>
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
                <div>
                  <Badge style={{ backgroundColor: selectedCoupon.color }} className="text-white mb-2">
                    {selectedCoupon.discount} OFF
                  </Badge>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedCoupon.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {selectedCoupon.storeName}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCoupon(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  onClick={async () => {
                    setClaiming(true);
                    try {
                      const response = await fetch('/api/coupons/claim', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          couponId: selectedCoupon.id,
                          userId: 'demo_user', // TODO: 실제 유저 ID
                        }),
                      });

                      const data = await response.json();

                      if (data.success) {
                        toast.success('🎉 ' + data.message);

                        // localStorage에 저장
                        const existing = JSON.parse(localStorage.getItem('my-coupons') || '[]');
                        localStorage.setItem('my-coupons', JSON.stringify([
                          ...existing,
                          {
                            ...selectedCoupon,
                            claimedAt: data.data.claimedAt,
                            status: 'available',
                          }
                        ]));

                        // 팝업 닫기
                        setTimeout(() => setSelectedCoupon(null), 1500);
                      } else {
                        toast.error(data.error || '쿠폰 받기 실패');
                      }
                    } catch (error) {
                      console.error(error);
                      toast.error('쿠폰 받기 중 오류 발생');
                    } finally {
                      setClaiming(false);
                    }
                  }}
                  disabled={claiming}
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
                  onClick={() => router.push(`/consumer/stores/${selectedCoupon.id}`)}
                >
                  매장 상세
                </Button>
              </div>
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
