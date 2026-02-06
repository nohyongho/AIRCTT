'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapPin, Ticket, Navigation, Filter, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getNearbyCoupons, formatDiscount, getDaysLeft } from '@/lib/ctt-api';
import type { NearbyCoupon } from '@/types/coupon';

export default function CouponsPage() {
    const { language } = useI18n();
    const [coupons, setCoupons] = useState<NearbyCoupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [radius, setRadius] = useState(3); // km

    const {
        latitude,
        longitude,
        loading: locationLoading,
        error: locationError,
        refresh: refreshLocation
    } = useGeolocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
    });

    // 쿠폰 로드
    const loadCoupons = async () => {
        if (!latitude || !longitude) return;

        setLoading(true);
        setError(null);

        try {
            const data = await getNearbyCoupons({
                lat: latitude,
                lng: longitude,
                radius,
                limit: 50,
            });
            setCoupons(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load coupons');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (latitude && longitude) {
            loadCoupons();
        }
    }, [latitude, longitude, radius]);

    // 거리별 필터링 옵션
    const radiusOptions = [1, 3, 5, 10];

    // 쿠폰 그룹핑 (거리별)
    const groupedCoupons = useMemo(() => {
        const groups: { label: string; coupons: NearbyCoupon[] }[] = [
            { label: language === 'ko' ? '500m 이내' : 'Within 500m', coupons: [] },
            { label: language === 'ko' ? '1km 이내' : 'Within 1km', coupons: [] },
            { label: language === 'ko' ? '3km 이내' : 'Within 3km', coupons: [] },
            { label: language === 'ko' ? '그 외' : 'Others', coupons: [] },
        ];

        coupons.forEach(coupon => {
            const dist = coupon.distance_km;
            if (dist <= 0.5) {
                groups[0].coupons.push(coupon);
            } else if (dist <= 1) {
                groups[1].coupons.push(coupon);
            } else if (dist <= 3) {
                groups[2].coupons.push(coupon);
            } else {
                groups[3].coupons.push(coupon);
            }
        });

        return groups.filter(g => g.coupons.length > 0);
    }, [coupons, language]);

    // 위치 로딩 중
    if (locationLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">
                    {language === 'ko' ? '위치를 확인하는 중...' : 'Getting your location...'}
                </p>
            </div>
        );
    }

    // 위치 에러
    if (locationError || (!latitude && !locationLoading)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
                <MapPin className="h-12 w-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                    {language === 'ko'
                        ? '위치 권한이 필요합니다.\n근처 쿠폰을 찾으려면 위치 접근을 허용해주세요.'
                        : 'Location permission required.\nPlease allow location access to find nearby coupons.'}
                </p>
                <Button onClick={refreshLocation}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {language === 'ko' ? '다시 시도' : 'Try Again'}
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-4 space-y-4 pb-24">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">
                        {language === 'ko' ? '근처 쿠폰' : 'Nearby Coupons'}
                    </h1>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {language === 'ko' ? '내 위치 기준' : 'Based on your location'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        refreshLocation();
                        loadCoupons();
                    }}
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* 반경 필터 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {radiusOptions.map((r) => (
                    <Badge
                        key={r}
                        variant={radius === r ? 'default' : 'outline'}
                        className="cursor-pointer whitespace-nowrap px-4 py-2"
                        onClick={() => setRadius(r)}
                    >
                        {r}km
                    </Badge>
                ))}
            </div>

            {/* 로딩 */}
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            )}

            {/* 에러 */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 text-center text-red-600">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* 쿠폰 없음 */}
            {!loading && !error && coupons.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                            {language === 'ko'
                                ? `${radius}km 이내에 사용 가능한 쿠폰이 없습니다`
                                : `No coupons available within ${radius}km`}
                        </p>
                        <Button
                            variant="link"
                            onClick={() => setRadius(Math.min(radius + 2, 10))}
                            className="mt-2"
                        >
                            {language === 'ko' ? '검색 범위 넓히기' : 'Expand search area'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* 쿠폰 목록 (거리별 그룹) */}
            {!loading && groupedCoupons.map((group) => (
                <div key={group.label} className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {group.label}
                        <Badge variant="secondary" className="ml-auto">
                            {group.coupons.length}
                        </Badge>
                    </h2>

                    {group.coupons.map((coupon) => (
                        <CouponListItem
                            key={coupon.id}
                            coupon={coupon}
                            language={language}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

// 쿠폰 리스트 아이템 컴포넌트
function CouponListItem({
    coupon,
    language,
}: {
    coupon: NearbyCoupon;
    language: 'ko' | 'en';
}) {
    const daysLeft = getDaysLeft(coupon.valid_to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    const isExpiringSoon = daysLeft <= 3;

    return (
        <Link href={`/consumer/coupons/${coupon.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        {/* 할인 배지 */}
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-bold text-primary">
                                {formatDiscount(coupon.discount_type, coupon.discount_value, language)}
                            </span>
                        </div>

                        {/* 쿠폰 정보 */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="font-medium text-sm line-clamp-1">
                                    {coupon.title}
                                </h3>
                                {isExpiringSoon && (
                                    <Badge variant="destructive" className="text-[10px] px-1.5">
                                        {language === 'ko' ? '곧 만료' : 'Expiring'}
                                    </Badge>
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground mt-1">
                                {coupon.store_name}
                            </p>

                            <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className="flex items-center gap-1 text-green-600">
                                    <Navigation className="h-3 w-3" />
                                    {coupon.distance_km < 1
                                        ? `${Math.round(coupon.distance_km * 1000)}m`
                                        : `${coupon.distance_km.toFixed(1)}km`}
                                </span>
                                <span className="text-muted-foreground">
                                    {daysLeft}{language === 'ko' ? '일 남음' : ' days left'}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
