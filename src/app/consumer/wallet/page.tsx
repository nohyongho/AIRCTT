
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Coins, Ticket, CreditCard, MapPin, Navigation, Filter, Search, Trash2, Gift, Share2, ExternalLink, Copy, Check, Link2, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CouponCard from '@/components/consumer/CouponCard';
import LocationStatus from '@/components/consumer/LocationStatus';
import { useI18n } from '@/contexts/I18nContext';
import { useGeolocation, calculateDistance, formatDistance } from '@/hooks/useGeolocation';
import { walletService } from '@/lib/wallet-service';
import { storeService } from '@/lib/store-service';
import { Coupon, PointHistory, Store } from '@/lib/consumer-types';

// 쿠폰에 매장 정보 추가
interface CouponWithStore extends Coupon {
  store?: Store;
  distance?: string;
}

export default function WalletPage() {
  const { t, language } = useI18n();
  const [coupons, setCoupons] = useState<CouponWithStore[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const [pointHistory, setPointHistory] = useState<PointHistory[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'used' | 'expired'>('all');
  const [sortByDistance, setSortByDistance] = useState(true);
  const [giftingCouponId, setGiftingCouponId] = useState<string | null>(null);
  const [giftUrl, setGiftUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // 실제 기기 위치 연동
  const {
    latitude,
    longitude,
    loading: locationLoading,
    error: locationError
  } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
  });

  // 사용자 위치
  const userLocation = useMemo(() => ({
    lat: latitude ?? 37.5665,
    lng: longitude ?? 126.9780,
  }), [latitude, longitude]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [couponsData, balance, history, storesData] = await Promise.all([
          walletService.getCoupons(),
          walletService.getPointBalance(),
          walletService.getPointHistory(),
          storeService.getNearbyStores(),
        ]);

        // 매장 정보와 거리 계산하여 쿠폰에 추가
        const couponsWithStore: CouponWithStore[] = couponsData.map(coupon => {
          // 브랜드명으로 매장 찾기
          const matchedStore = storesData.find(store =>
            store.name.includes(coupon.brand) || coupon.brand.includes(store.name)
          );

          let distance: string | undefined;
          if (matchedStore && latitude && longitude) {
            const dist = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              matchedStore.latitude,
              matchedStore.longitude
            );
            distance = formatDistance(dist);
          }

          return {
            ...coupon,
            store: matchedStore,
            distance,
          };
        });

        setCoupons(couponsWithStore);
        setPointBalance(balance);
        setPointHistory(history);
        setStores(storesData);
      } catch (error) {
        console.error('Failed to fetch wallet data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [latitude, longitude, userLocation.lat, userLocation.lng]);

  // 필터링 및 정렬된 쿠폰
  const filteredCoupons = useMemo(() => {
    let result = coupons;

    // 상태 필터
    if (filterStatus !== 'all') {
      result = result.filter(coupon => coupon.status === filterStatus);
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(coupon =>
        coupon.title.toLowerCase().includes(query) ||
        coupon.brand.toLowerCase().includes(query) ||
        coupon.description.toLowerCase().includes(query)
      );
    }

    // 거리순 정렬
    if (sortByDistance && latitude && longitude) {
      result = [...result].sort((a, b) => {
        if (!a.distance && !b.distance) return 0;
        if (!a.distance) return 1;
        if (!b.distance) return -1;

        const distA = parseFloat(a.distance.replace(/[^0-9.]/g, ''));
        const distB = parseFloat(b.distance.replace(/[^0-9.]/g, ''));
        return distA - distB;
      });
    }

    return result;
  }, [coupons, filterStatus, searchQuery, sortByDistance, latitude, longitude]);

  // 가까운 매장 쿠폰 (3km 이내)
  const nearbyCoupons = useMemo(() => {
    if (!latitude || !longitude) return [];

    return coupons.filter(coupon => {
      if (!coupon.distance || coupon.status !== 'available') return false;

          // 쿠폰 사용하기 핸들러 (사업자 사이트 이동)
              const handleRedeemCoupon = async (couponId: string) => {
                    try {
                            const res = await fetch('/api/coupons/redeem', {
                                      method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                          body: JSON.stringify({ coupon_id: couponId }),
                                                                  });
                                                                          const data = await res.json();
                                                                                  if (data.success && data.redirect_url) {
                                                                                            // 쿠폰 상태 업데이트
                                                                                                      setCoupons(prev => prev.map(c => c.id === couponId ? { ...c, status: 'used' } : c));
                                                                                                                // 사업자 사이트로 이동
                                                                                                                          window.open(data.redirect_url, '_blank');
                                                                                                                                  } else if (data.success) {
                                                                                                                                            setCoupons(prev => prev.map(c => c.id === couponId ? { ...c, status: 'used' } : c));
                                                                                                                                                      alert(data.message || '쿠폰이 사용되었습니다!');
                                                                                                                                                              } else {
                                                                                                                                                                        alert(data.error || '쿠폰 사용에 실패했습니다.');
                                                                                                                                                                                }
                                                                                                                                                                                      } catch (e) {
                                                                                                                                                                                              console.error('쿠폰 사용 에러:', e);
                                                                                                                                                                                                      alert('쿠폰 사용 중 오류가 발생했습니다.');
                                                                                                                                                                                                            }
                                                                                                                                                                                                                };
      const dist = parseFloat(coupon.distance.replace(/[^0-9.]/g, ''));
      return dist <= 3;
    });
  }, [coupons, latitude, longitude]);

  // 개별 쿠폰 삭제 핸들러
  const handleDelete = (id: string) => {
    if (confirm(language === 'ko' ? '정말 이 쿠폰을 삭제하시겠습니까?' : 'Delete this coupon?')) {
      setCoupons(prev => prev.filter(c => c.id !== id));
    }
  };

  // 선물하기 핸들러
  const handleGift = async (couponId: string) => {
    setGiftingCouponId(couponId);
    setGiftUrl(null);
    try {
      const senderId = getSenderId();
      const res = await fetch('/api/coupons/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_issue_id: couponId,
          sender_id: senderId,
        }),
      });
      const data = await res.json();
      if (data.success && data.gift_url) {
        setGiftUrl(data.gift_url);
      } else {
        alert(data.error || '선물 링크 생성에 실패했습니다.');
        setGiftingCouponId(null);
      }
    } catch {
      alert('서버 연결에 실패했습니다.');
      setGiftingCouponId(null);
    }
  };

  // 링크 복사
  const handleCopyLink = async () => {
    if (!giftUrl) return;
    try {
      await navigator.clipboard.writeText(giftUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // 폴백: 텍스트 선택 방식
      const textArea = document.createElement('textarea');
      textArea.value = giftUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // 카카오톡 / 메시지 공유 (딥링크)
  const handleKakaoShare = () => {
    if (!giftUrl) return;
    const text = encodeURIComponent(`🎁 쿠폰을 선물합니다!\n아래 링크를 눌러 받아보세요.\n${giftUrl}`);
    // 카카오톡 공유 (모바일 앱이 있으면 열림, 없으면 SMS 폴백)
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      window.open(`kakaotalk://msg/text/${text}`, '_blank');
      // 폴백: 0.5초 뒤에 안 열렸으면 SMS로
      setTimeout(() => {
        window.open(`sms:?body=${text}`, '_blank');
      }, 500);
    } else {
      // 데스크톱: 클립보드 + 안내
      handleCopyLink();
    }
  };

  // 네이티브 공유 (SNS/앱)
  const handleNativeShare = async () => {
    if (!giftUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AIRCTT 쿠폰 선물 🎁',
          text: '쿠폰을 선물합니다! 아래 링크를 눌러 받아보세요.',
          url: giftUrl,
        });
      } else {
        // 네이티브 공유 미지원 → 링크 복사 폴백
        await handleCopyLink();
      }
    } catch {
      // 취소 또는 에러 → 무시
    }
  };

  // 선물 모달 닫기
  const handleCloseGiftModal = () => {
    setGiftingCouponId(null);
    setGiftUrl(null);
    setLinkCopied(false);
  };

  // 매장으로 이동 (딥링크)
  const handleGoToStore = (storeName?: string, storeLocation?: { lat: number; lng: number }) => {
    if (storeLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${storeLocation.lat},${storeLocation.lng}`;
      window.open(url, '_blank');
    } else if (storeName) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeName)}`;
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 relative min-h-screen">
      {/* 포인트 잔액 카드 */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm opacity-90">{t('wallet.pointBalance')}</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">
                {pointBalance.toLocaleString()}P
              </p>
            </div>
            <Coins className="h-10 w-10 sm:h-12 sm:w-12 opacity-80" />
          </div>
        </CardContent>
      </Card>

      {/* 위치 상태 */}
      <LocationStatus
        showRefresh={true}
        compact={true}
      />

      {/* 가까운 매장 쿠폰 알림 */}
      {nearbyCoupons.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {language === 'ko'
                    ? `근처에서 사용 가능한 쿠폰 ${nearbyCoupons.length}개!`
                    : `${nearbyCoupons.length} coupons available nearby!`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ko' ? '3km 이내 매장' : 'Within 3km'}
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                {nearbyCoupons.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="coupons" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="coupons" className="text-xs sm:text-sm">
            <Ticket className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {t('wallet.coupons')}
          </TabsTrigger>
          <TabsTrigger value="points" className="text-xs sm:text-sm">
            <Coins className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {t('wallet.points')}
          </TabsTrigger>
          <TabsTrigger value="membership" className="text-xs sm:text-sm">
            <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('wallet.membership')}</span>
            <span className="sm:hidden">{language === 'ko' ? '멤버십' : 'Member'}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coupons" className="space-y-3 sm:space-y-4 mt-4">
          {/* 검색 및 필터 */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ko' ? '쿠폰 검색...' : 'Search coupons...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
              {(['all', 'available', 'used'] as const).map((status) => (
                <Badge
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  className="cursor-pointer whitespace-nowrap px-4 py-2"
                  onClick={() => setFilterStatus(status)}
                >
                  {status === 'all' && (language === 'ko' ? '전체' : 'All')}
                  {status === 'available' && (language === 'ko' ? '사용가능' : 'Available')}
                  {status === 'used' && (language === 'ko' ? '사용완료' : 'Used')}
                </Badge>
              ))}

              <Button
                variant={sortByDistance ? 'default' : 'outline'}
                size="sm"
                className="ml-auto whitespace-nowrap"
                onClick={() => setSortByDistance(!sortByDistance)}
                disabled={!latitude || !longitude}
              >
                <MapPin className="h-3 w-3 mr-1" />
                {language === 'ko' ? '거리순' : 'By Distance'}
              </Button>
            </div>
          </div>

          {/* 쿠폰 목록 */}
          {filteredCoupons.length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">
                  {searchQuery || filterStatus !== 'all'
                    ? (language === 'ko' ? '검색 결과가 없습니다' : 'No results found')
                    : (language === 'ko' ? '쿠폰이 없습니다' : 'No coupons available')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 pb-20">
              {filteredCoupons.map((coupon) => (
                <div key={coupon.id} className="relative group">
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 min-w-0">
                      <CouponCard
                        coupon={coupon}
                        distance={coupon.distance}
                        storeName={coupon.store?.name}
                      />
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {/* 쿠폰 사용하기 버튼 */}
                      {coupon.status === 'available' && (
                        <Button
                          variant="outline"
                          className={`h-auto w-14 flex-1 flex flex-col items-center justify-center rounded-xl transition-all ${
                            giftingCouponId === coupon.id && giftUrl
                              ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30'
                              : 'border-purple-300 hover:bg-purple-50 text-purple-600'
                          }`}
                          onClick={() => handleGift(coupon.id)}
                          disabled={giftingCouponId === coupon.id && !giftUrl}
                        >
                          {giftingCouponId === coupon.id && !giftUrl ? (
                            <>
                              <div className="h-4 w-4 mb-0.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                              <span className="text-[10px] font-bold">{language === 'ko' ? '생성중' : '...'}</span>
                            </>
                          ) : (
                            <>
                              <Gift className="h-4 w-4 mb-0.5" />
                              <span className="text-[10px] font-bold">{language === 'ko' ? '선물' : 'Gift'}</span>
                            </>
                          )}
                        </Button>
                      )}

                      {/* 매장 가기 버튼 */}
                      {coupon.store && coupon.status === 'available' && (
                        <Button
                          variant="outline"
                          className="h-auto w-14 flex-1 flex flex-col items-center justify-center rounded-xl border-blue-300 hover:bg-blue-50 text-blue-600"
                          onClick={() => handleGoToStore(
                            coupon.store?.name,
                            coupon.store ? { lat: coupon.store.latitude, lng: coupon.store.longitude } : undefined
                          )}
                        >
                          <ExternalLink className="h-4 w-4 mb-0.5" />
                          <span className="text-[10px] font-bold">{language === 'ko' ? '매장' : 'Store'}</span>
                        </Button>
                      )}

                      {/* 삭제 버튼 */}
                      <Button
                        variant="destructive"
                        className="h-auto w-14 flex-1 flex flex-col items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 shadow-sm"
                        onClick={() => handleDelete(coupon.id)}
                      >
                        <Trash2 className="h-4 w-4 mb-0.5" />
                        <span className="text-[10px] font-bold">{language === 'ko' ? '삭제' : 'Del'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* 선물 링크 모달 (스타벅스형 3버튼) */}
                  {giftingCouponId === coupon.id && giftUrl && (
                    <div className="mt-2 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700/50">
                      {/* 상단 안내 */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                          <Gift className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                            {language === 'ko' ? '🎉 선물 링크가 생성되었습니다!' : '🎉 Gift link created!'}
                          </p>
                          <p className="text-[10px] text-purple-400 dark:text-purple-500 truncate">{giftUrl}</p>
                        </div>
                      </div>

                      {/* 공유 버튼 3종 (스타벅스형) */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {/* 링크 복사 */}
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-auto py-2 flex flex-col items-center gap-1 rounded-xl transition-all ${
                            linkCopied
                              ? 'bg-green-50 border-green-300 text-green-600 dark:bg-green-900/20 dark:border-green-700'
                              : 'border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400'
                          }`}
                          onClick={handleCopyLink}
                        >
                          {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span className="text-[10px] font-bold">
                            {linkCopied
                              ? (language === 'ko' ? '복사됨!' : 'Copied!')
                              : (language === 'ko' ? '링크복사' : 'Copy')}
                          </span>
                        </Button>

                        {/* 카카오톡 / 메시지 */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-auto py-2 flex flex-col items-center gap-1 rounded-xl border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-400"
                          onClick={handleKakaoShare}
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-[10px] font-bold">
                            {language === 'ko' ? '메시지' : 'Message'}
                          </span>
                        </Button>

                        {/* SNS 공유 */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-auto py-2 flex flex-col items-center gap-1 rounded-xl border-cyan-300 text-cyan-600 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-400"
                          onClick={handleNativeShare}
                        >
                          <Share2 className="h-4 w-4" />
                          <span className="text-[10px] font-bold">
                            {language === 'ko' ? '공유하기' : 'Share'}
                          </span>
                        </Button>
                      </div>

                      {/* 닫기 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-purple-400 hover:text-purple-600"
                        onClick={handleCloseGiftModal}
                      >
                        {language === 'ko' ? '닫기' : 'Close'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="points" className="space-y-3 sm:space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-sm sm:text-base">{t('wallet.recentHistory')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3">
              {pointHistory.map((history) => (
                <div
                  key={history.id}
                  className="flex items-center justify-between py-2 sm:py-3 border-b last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm sm:text-base">{history.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(history.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p
                    className={`font-bold text-sm sm:text-base ${history.type === 'earned'
                      ? 'text-green-600'
                      : 'text-red-600'
                      }`}
                  >
                    {history.type === 'earned' ? '+' : '-'}
                    {Math.abs(history.amount).toLocaleString()}P
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="membership" className="space-y-3 sm:space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 sm:p-8 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm sm:text-base">
                {language === 'ko' ? '멤버십 서비스 준비중' : 'Membership service coming soon'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getSenderId(): string {
  if (typeof window === 'undefined') return '00000000-0000-0000-0000-000000000000';
  try {
    const session = localStorage.getItem('airctt_consumer_session');
    if (session) {
      const parsed = JSON.parse(session);
      const id = parsed.user_id || parsed.consumer_id;
      if (id && id !== 'anonymous') return id;
    }
    // 비로그인: 게임과 동일한 UUID anon ID 재사용
    let anonId = localStorage.getItem('airctt_anon_user_id');
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem('airctt_anon_user_id', anonId);
    }
    return anonId;
  } catch { /* ignore */ }
  return '00000000-0000-0000-0000-000000000000';
}
