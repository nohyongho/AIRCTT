'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Minus, Plus, Navigation, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────────────
// Leaflet CDN 동적 로드 (API 키 불필요!)
// ─────────────────────────────────────────────
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) { resolve((window as any).L); return; }
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────
// 헬퍼 함수들
// ─────────────────────────────────────────────
function formatRadius(m: number): string {
  if (m >= 1_000_000) return `${(m / 1000).toLocaleString()}km`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

function radiusToZoom(m: number): number {
  if (m <= 100) return 17;
  if (m <= 300) return 16;
  if (m <= 500) return 15;
  if (m <= 1000) return 14;
  if (m <= 3000) return 13;
  if (m <= 5000) return 12;
  if (m <= 10000) return 11;
  if (m <= 30000) return 10;
  if (m <= 50000) return 9;
  if (m <= 100000) return 8;
  if (m <= 500000) return 7;
  if (m <= 1000000) return 6;
  if (m <= 3000000) return 5;
  if (m <= 5000000) return 4;
  if (m <= 10000000) return 3;
  return 2;
}

function getStep(m: number): number {
  if (m < 500) return 50;
  if (m < 2000) return 100;
  if (m < 10000) return 500;
  if (m < 50000) return 1000;
  if (m < 200000) return 5000;
  if (m < 1000000) return 10000;
  if (m < 5000000) return 50000;
  return 100000;
}

// ─────────────────────────────────────────────
// 원 가장자리 좌표 계산 (동쪽 방향)
// ─────────────────────────────────────────────
function getEdgePoint(lat: number, lng: number, radiusM: number): [number, number] {
  // 동쪽(90°) 방향으로 반경만큼 이동한 좌표
  const R = 6371000; // 지구 반지름 (m)
  const dLng = (radiusM / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lat, lng + dLng];
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface CouponRadiusMapProps {
  radiusM: number;
  onRadiusChange: (m: number) => void;
  centerLat?: number;
  centerLng?: number;
  onCenterChange?: (lat: number, lng: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  inline?: boolean;  // true = 인라인 미니지도 모드 (모달 X, 지도만)
}

export default function CouponRadiusMap({
  radiusM,
  onRadiusChange,
  centerLat,
  centerLng,
  onCenterChange,
  onClose,
  onConfirm,
  inline = false,
}: CouponRadiusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const edgeMarkerRef = useRef<any>(null);
  const [L, setL] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isDraggingEdge, setIsDraggingEdge] = useState(false);
  const [currentCenter, setCurrentCenter] = useState({
    lat: centerLat || 37.5665,
    lng: centerLng || 126.978,
  });
  const [localRadius, setLocalRadius] = useState(radiusM);
  const [gettingLocation, setGettingLocation] = useState(false);

  // ── Leaflet 로드 ──
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((leaflet) => {
      if (cancelled) return;
      setL(leaflet);
    });
    return () => { cancelled = true; };
  }, []);

  // ── 지도 초기화 ──
  useEffect(() => {
    if (!L || !mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [currentCenter.lat, currentCenter.lng],
      zoom: radiusToZoom(localRadius),
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const circle = L.circle([currentCenter.lat, currentCenter.lng], {
      radius: localRadius,
      color: '#6366f1',
      fillColor: '#818cf8',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '8 4',
    }).addTo(map);

    const markerIcon = L.divIcon({
      className: 'custom-pin',
      html: `<div style="
        width:32px; height:32px; background:#6366f1; border-radius:50% 50% 50% 0;
        transform:rotate(-45deg); border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex; align-items:center; justify-content:center;
      "><span style="transform:rotate(45deg); font-size:14px;">📍</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker([currentCenter.lat, currentCenter.lng], {
      icon: markerIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setCurrentCenter({ lat: pos.lat, lng: pos.lng });
      circle.setLatLng(pos);
      map.panTo(pos);
      onCenterChange?.(pos.lat, pos.lng);
      // 엣지 핸들도 같이 이동
      updateEdgeHandle(pos.lat, pos.lng, circle.getRadius(), L, map);
    });

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      setCurrentCenter({ lat, lng });
      onCenterChange?.(lat, lng);
      // 엣지 핸들도 이동
      updateEdgeHandle(lat, lng, circle.getRadius(), L, map);
    });

    // ★ 반경 조절 엣지 핸들 (원 가장자리 드래그!)
    const edgePos = getEdgePoint(currentCenter.lat, currentCenter.lng, localRadius);
    const edgeIcon = L.divIcon({
      className: 'edge-handle',
      html: `<div style="
        width:24px; height:24px; background:white; border:3px solid #6366f1;
        border-radius:50%; box-shadow:0 2px 8px rgba(0,0,0,0.3); cursor:grab;
        display:flex; align-items:center; justify-content:center; font-size:10px;
      ">↔</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const edgeMarker = L.marker(edgePos, {
      icon: edgeIcon,
      draggable: true,
    }).addTo(map);

    // 엣지 드래그 → 반경 실시간 변경!
    edgeMarker.on('dragstart', () => { setIsDraggingEdge(true); });
    edgeMarker.on('drag', () => {
      const edgeLatlng = edgeMarker.getLatLng();
      const centerLatlng = marker.getLatLng();
      const newRadius = Math.round(
        centerLatlng.distanceTo(edgeLatlng) // Leaflet 내장 거리계산 (미터)
      );
      const clampedRadius = Math.max(50, Math.min(20000000, newRadius));
      circle.setRadius(clampedRadius);
      setLocalRadius(clampedRadius);
      onRadiusChange(clampedRadius);
    });
    edgeMarker.on('dragend', () => {
      setIsDraggingEdge(false);
      const edgeLatlng = edgeMarker.getLatLng();
      const centerLatlng = marker.getLatLng();
      const newRadius = Math.max(50, Math.min(20000000,
        Math.round(centerLatlng.distanceTo(edgeLatlng))
      ));
      // 드래그 끝나면 핸들을 정확한 동쪽 위치로 스냅
      const snapped = getEdgePoint(centerLatlng.lat, centerLatlng.lng, newRadius);
      edgeMarker.setLatLng(snapped);
    });

    leafletMap.current = map;
    circleRef.current = circle;
    markerRef.current = marker;
    edgeMarkerRef.current = edgeMarker;
    setMapReady(true);

    return () => {
      map.remove();
      leafletMap.current = null;
      circleRef.current = null;
      markerRef.current = null;
      edgeMarkerRef.current = null;
      setMapReady(false);
    };
  }, [L]);

  // ── 엣지 핸들 위치 업데이트 헬퍼 ──
  const updateEdgeHandle = useCallback((lat: number, lng: number, radius: number, _L?: any, _map?: any) => {
    if (!edgeMarkerRef.current) return;
    const pos = getEdgePoint(lat, lng, radius);
    edgeMarkerRef.current.setLatLng(pos);
  }, []);

  // ── 반경 변경 시 원 + 엣지 핸들 업데이트 ──
  useEffect(() => {
    if (!circleRef.current || !leafletMap.current) return;
    circleRef.current.setRadius(localRadius);
    // 엣지 드래그 중엔 줌 변경 안 함 (깜빡임 방지)
    if (!isDraggingEdge) {
      leafletMap.current.setView(
        [currentCenter.lat, currentCenter.lng],
        radiusToZoom(localRadius),
        { animate: true }
      );
    }
    updateEdgeHandle(currentCenter.lat, currentCenter.lng, localRadius);
  }, [localRadius, currentCenter, isDraggingEdge, updateEdgeHandle]);

  const handleSlider = useCallback((val: number) => {
    setLocalRadius(val);
    onRadiusChange(val);
  }, [onRadiusChange]);

  // ── 내 위치 ──
  const getMyLocation = () => {
    if (!navigator.geolocation) { alert('위치 서비스를 지원하지 않습니다.'); return; }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentCenter({ lat: latitude, lng: longitude });
        onCenterChange?.(latitude, longitude);
        if (leafletMap.current && markerRef.current && circleRef.current) {
          leafletMap.current.setView([latitude, longitude], radiusToZoom(localRadius));
          markerRef.current.setLatLng([latitude, longitude]);
          circleRef.current.setLatLng([latitude, longitude]);
        }
        setGettingLocation(false);
      },
      () => { alert('위치를 가져올 수 없습니다.'); setGettingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const presets = [
    { label: '100m', value: 100 },
    { label: '500m', value: 500 },
    { label: '1km', value: 1000 },
    { label: '5km', value: 5000 },
    { label: '10km', value: 10000 },
    { label: '50km', value: 50000 },
    { label: '100km', value: 100000 },
    { label: '500km', value: 500000 },
  ];

  // ── 인라인 모드: 지도만 렌더 ──
  if (inline) {
    return (
      <div className="relative w-full h-full">
        <div ref={mapRef} className="w-full h-full bg-slate-200 rounded-xl" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-xl">
            <div className="animate-spin w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full" />
            <span className="ml-2 text-slate-500 text-sm">지도 로딩...</span>
          </div>
        )}
        {/* 반경 표시 배지 */}
        <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow text-sm font-bold text-indigo-600">
          📍 {formatRadius(localRadius)}
        </div>
      </div>
    );
  }

  // ── 모달 모드 (팝업 확대) ──
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            <span className="font-bold text-lg">쿠폰 배포 위치 설정</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 지도 */}
        <div className="relative">
          <div ref={mapRef} className="w-full h-[300px] bg-slate-200" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
              <span className="ml-3 text-slate-600">지도 로딩 중...</span>
            </div>
          )}
          <button
            onClick={getMyLocation}
            disabled={gettingLocation}
            className="absolute top-3 right-3 z-[1000] bg-white shadow-lg rounded-full p-2.5 hover:bg-indigo-50 transition active:scale-95"
            title="내 위치"
          >
            <Navigation className={`w-5 h-5 text-indigo-600 ${gettingLocation ? 'animate-pulse' : ''}`} />
          </button>
        </div>

        {/* 반경 컨트롤 */}
        <div className="p-4 space-y-4">
          <div className="text-center">
            <span className="text-3xl font-extrabold text-indigo-600">{formatRadius(localRadius)}</span>
            <p className="text-xs text-slate-400 mt-1">배포 반경 (50m ~ 20,000km)</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSlider(Math.max(50, localRadius - getStep(localRadius)))}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 transition"
            >
              <Minus className="w-4 h-4 text-slate-600" />
            </button>
            <input
              type="range" min={50} max={20000000}
              step={getStep(localRadius)}
              value={localRadius}
              onChange={(e) => handleSlider(parseInt(e.target.value))}
              className="flex-1 accent-indigo-500 h-2"
            />
            <button
              onClick={() => handleSlider(Math.min(20000000, localRadius + getStep(localRadius)))}
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 transition"
            >
              <Plus className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => handleSlider(p.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                  localRadius === p.value
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="text-center text-xs text-slate-400 space-y-0.5">
            <p>📍 중심: {currentCenter.lat.toFixed(5)}, {currentCenter.lng.toFixed(5)}</p>
            <p>🔵 원 가장자리 ↔ 핸들을 드래그하여 반경 조절</p>
            <p>📌 핀 드래그 or 지도 탭 → 위치 변경</p>
          </div>

          <Button
            onClick={onConfirm}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-lg font-bold shadow-lg"
          >
            <Check className="w-5 h-5 mr-2" />
            이 위치로 설정 완료
          </Button>
        </div>
      </div>
    </div>
  );
}
