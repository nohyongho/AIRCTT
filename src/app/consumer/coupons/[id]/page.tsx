'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    MapPin,
    Navigation,
    Clock,
    Ticket,
    Store,
    Loader2,
    Check,
    AlertCircle,
    Phone,
    ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/contexts/I18nContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
    getCouponDetail,
    claimCoupon,
    formatDiscount,
    getDaysLeft,
    getStatusText
} from '@/lib/ctt-api';
import type { CouponWithStore } from '@/types/coupon';

export default function CouponDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { language } = useI18n();
    const couponId = params.id as string;

    const [coupon, setCoupon] = useState<CouponWithStore | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [claimed, setClaimed] = useState(false);
    const [claimCode, setClaimCode] = useState<string | null>(null);

    const { latitude, longitude } = useGeolocation({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
    });

    // 쿠폰 상세 로드
    useEffect(() => {
        const loadCoupon = async () => {
            try {
                const data = await getCouponDetail(couponId);
                setCoupon(data);
            } catch (err: any) {
                setError(err.message || 'Failed to load coupon');
            } finally {
                setLoading(false);
            }
        };

        if (couponId) {
            loadCoupon();
        }
    }, [couponId]);

    // 쿠폰 클레임 핸들러
    const handleClaim = async () => {
        if (!coupon) return;

        // 임시 사용자 ID (실제로는 인증된 사용자 ID 사용)
        const userId = 'demo-user-' + Date.now();

        setClaiming(true);
        try {
            const result = await claimCoupon(couponId, {
                user_id: userId,
                lat: latitude || undefined,
                lng: longitude || undefined,
                claimed_via: 'list',
            });

            if (result.success) {
                setClaimed(true);
                setClaimCode(result.code || null);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setClaiming(false);
        }
    };

    // 길찾기 열기
    const openDirections = () => {
        if (!coupon?.store) return;

        const { latitude: storeLat, longitude: storeLng, name } = coupon.store;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${storeLat},${storeLng}&destination_place_id=${encodeURIComponent(name)}`;
        window.open(url, '_blank');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !coupon) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-center text-muted-foreground">
                    {error || (language === 'ko' ? '쿠폰을 찾을 수 없습니다' : 'Coupon not found')}
                </p>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {language === 'ko' ? '뒤로 가기' : 'Go Back'}
                </Button>
            </div>
        );
    }

    const daysLeft = getDaysLeft(coupon.valid_to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    const isExpiringSoon = daysLeft <= 3;

    return (
        <div className="container mx-auto px-4 py-4 space-y-4 pb-32">
            {/* 뒤로가기 */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="-ml-2"
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {language === 'ko' ? '뒤로' : 'Back'}
            </Button>

            {/* 쿠폰 카드 */}
            <Card className="overflow-hidden">
                {/* 할인 배너 */}
                <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 text-center">
                    <p className="text-sm opacity-90">
                        {coupon.discount_type === 'percent' ? 'DISCOUNT' : 'SAVE'}
                    </p>
                    <p className="text-4xl font-bold mt-1">
                        {formatDiscount(coupon.discount_type, coupon.discount_value, language)}
                    </p>
                    {coupon.max_discount_amount && coupon.discount_type === 'percent' && (
                        <p className="text-sm opacity-75 mt-1">
                            {language === 'ko'
                                ? `최대 ${coupon.max_discount_amount.toLocaleString()}원`
                                : `Up to $${coupon.max_discount_amount.toLocaleString()}`}
                        </p>
                    )}
                </div>

                <CardContent className="p-4 space-y-4">
                    {/* 제목 및 상태 */}
                    <div className="flex items-start justify-between gap-2">
                        <h1 className="text-xl font-bold">{coupon.title}</h1>
                        <div className="flex gap-1">
                            {isExpiringSoon && (
                                <Badge variant="destructive">
                                    {language === 'ko' ? '곧 만료' : 'Expiring'}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* 설명 */}
                    {coupon.description && (
                        <p className="text-muted-foreground text-sm">
                            {coupon.description}
                        </p>
                    )}

                    {/* 매장 정보 */}
                    {coupon.store && (
                        <Card className="bg-muted/50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center">
                                        <Store className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium">{coupon.store.name}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {coupon.store.address}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={openDirections}
                                    >
                                        <Navigation className="h-4 w-4 mr-1" />
                                        {language === 'ko' ? '길찾기' : 'Directions'}
                                    </Button>
                                    {coupon.store.phone && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            asChild
                                        >
                                            <a href={`tel:${coupon.store.phone}`}>
                                                <Phone className="h-4 w-4 mr-1" />
                                                {language === 'ko' ? '전화' : 'Call'}
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 유효기간 */}
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                            {language === 'ko' ? '유효기간: ' : 'Valid until: '}
                            {coupon.valid_to
                                ? new Date(coupon.valid_to).toLocaleDateString()
                                : (language === 'ko' ? '무제한' : 'No limit')}
                        </span>
                        <Badge variant="secondary" className="ml-auto">
                            {daysLeft}{language === 'ko' ? '일 남음' : ' days left'}
                        </Badge>
                    </div>

                    {/* 최소 주문 금액 */}
                    {coupon.min_order_amount > 0 && (
                        <div className="text-sm text-muted-foreground">
                            {language === 'ko'
                                ? `최소 주문 금액: ${coupon.min_order_amount.toLocaleString()}원`
                                : `Minimum order: $${coupon.min_order_amount.toLocaleString()}`}
                        </div>
                    )}

                    {/* 이용 약관 */}
                    {coupon.terms && (
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-2">
                                {language === 'ko' ? '이용 약관' : 'Terms & Conditions'}
                            </h4>
                            <p className="text-xs text-muted-foreground whitespace-pre-line">
                                {coupon.terms}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 클레임 성공 카드 */}
            {claimed && claimCode && (
                <Card className="border-green-500 bg-green-50">
                    <CardContent className="p-4 text-center">
                        <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
                        <h3 className="font-bold text-green-700">
                            {language === 'ko' ? '쿠폰 받기 완료!' : 'Coupon Claimed!'}
                        </h3>
                        <p className="text-sm text-green-600 mt-1">
                            {language === 'ko' ? '쿠폰 코드:' : 'Coupon Code:'}
                        </p>
                        <p className="text-2xl font-mono font-bold text-green-700 mt-2 tracking-wider">
                            {claimCode}
                        </p>
                        <p className="text-xs text-green-600 mt-2">
                            {language === 'ko'
                                ? '이 코드를 매장에서 보여주세요'
                                : 'Show this code at the store'}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* 하단 고정 버튼 */}
            {!claimed && (
                <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t">
                    <Button
                        className="w-full h-12 text-lg"
                        onClick={handleClaim}
                        disabled={claiming}
                    >
                        {claiming ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                {language === 'ko' ? '발급 중...' : 'Claiming...'}
                            </>
                        ) : (
                            <>
                                <Ticket className="h-5 w-5 mr-2" />
                                {language === 'ko' ? '쿠폰 받기' : 'Claim Coupon'}
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
