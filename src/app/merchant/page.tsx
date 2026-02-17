
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  QrCode,
  MapPin,
  Ticket,
  TrendingUp,
  Wallet,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Bell,
  Zap,
  Gift,
  Users,
  CreditCard,
  BarChart3,
  Clock,
  CheckCircle2,
  Star,
  Package,
  Banknote,
  Store, // Added from diff
  ChevronRight, // Added from diff
  Plus, // Added from diff
  Search, // Added from diff
  Filter, // Added from diff
  MoreHorizontal, // Added from diff
  Video, // Added from diff
  Image as ImageIcon, // Merged and renamed
  FileSpreadsheet, // Added from diff
  Upload,
  Loader2,
  CheckCircle,
  X as XIcon,
} from 'lucide-react';
import GoogleSheetsLog from '@/components/merchant/GoogleSheetsLog'; // Added from diff
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  merchantProfileService,
  outletService,
  couponService,
  couponUsageService,
  initMerchantDemo
} from '@/lib/merchant-service';
import { MerchantProfile, Outlet, MerchantCoupon } from '@/lib/merchant-types';

export default function MerchantHomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [coupons, setCoupons] = useState<MerchantCoupon[]>([]);
  const [todayUsage, setTodayUsage] = useState(0);
  const [weeklyUsage, setWeeklyUsage] = useState(0);
  const [totalUsed, setTotalUsed] = useState(0);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedDetailCoupon, setSelectedDetailCoupon] = useState<MerchantCoupon | null>(null);

  // 업로드 관련
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ url: string; type: 'IMAGE' | 'VIDEO' } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // 파일 업로드 핸들러
  const handleFileUpload = useCallback(async (file: File) => {
    if (!selectedDetailCoupon) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('coupon_id', selectedDetailCoupon.id);

      const res = await fetch('/api/merchant/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setUploadResult({ url: data.url, type: data.media_type });
        // 로컬 쿠폰 데이터도 업데이트
        setSelectedDetailCoupon(prev => prev ? {
          ...prev,
          imageUrl: data.url,
          mediaType: data.media_type,
        } : null);
        setCoupons(prev => prev.map(c =>
          c.id === selectedDetailCoupon.id
            ? { ...c, imageUrl: data.url, mediaType: data.media_type }
            : c
        ));
      } else {
        alert(data.error || '업로드 실패');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }, [selectedDetailCoupon]);

  // 드래그 앤 드롭
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0">
            <Zap className="w-3 h-3 mr-1" />
            활성
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-rose-600 border-0">
            <Clock className="w-3 h-3 mr-1" />
            만료
          </Badge>
        );
      case 'USED':
        return (
          <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            사용됨
          </Badge>
        );
      case 'INACTIVE':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Clock className="w-3 h-3 mr-1" />
            대기
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCouponName = (coupon: MerchantCoupon) => {
    return coupon.name ?? coupon.title;
  };

  const getDiscountDisplay = (coupon: MerchantCoupon) => {
    if (coupon.discountType === 'PERCENTAGE') {
      return `${coupon.discountValue}%`;
    }
    if (coupon.discountType === 'FIXED_AMOUNT') {
      return `${coupon.discountValue.toLocaleString()}원`;
    }
    return '무료 제공';
  };

  const loadData = useCallback(() => {
    setProfile(merchantProfileService.get());
    setOutlets(outletService.getAll());
    setCoupons(couponService.getAll());

    const usages = couponUsageService.getAll();
    const today = new Date().toDateString();
    const todayCount = usages.filter(u =>
      new Date(u.usedAt).toDateString() === today
    ).length;
    setTodayUsage(todayCount);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = usages.filter(u =>
      new Date(u.usedAt) >= weekAgo
    ).length;
    setWeeklyUsage(weekCount);
    setTotalUsed(usages.length);
  }, []);

  useEffect(() => {
    initMerchantDemo();
    loadData();
  }, [loadData]);

  const stats = [
    {
      label: '오늘 사용',
      value: todayUsage,
      icon: Ticket,
      color: 'from-pink-500 to-rose-500',
      bgColor: 'bg-pink-500/20',
      trend: '+12%',
    },
    {
      label: '활성 쿠폰',
      value: coupons.filter(c => c.status === 'ACTIVE').length,
      icon: Gift,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/20',
      trend: '+5',
    },
    {
      label: '매장 수',
      value: outlets.length,
      icon: MapPin,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/20',
      trend: 'Active',
    },
    {
      label: '주간 사용',
      value: weeklyUsage,
      icon: BarChart3,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/20',
      trend: '+28%',
    },
  ];

  const quickActions = [
    {
      label: '쿠폰 발급',
      description: '새 쿠폰 만들기',
      icon: Ticket,
      color: 'from-violet-500 to-purple-600',
      href: '/merchant/coupons',
    },
    {
      label: '주문 확인',
      description: '실시간 주문',
      icon: ShoppingBag,
      color: 'from-blue-500 to-cyan-500',
      href: '/merchant/orders',
    },
    {
      label: '충전하기',
      description: '잔액 충전',
      icon: Wallet,
      color: 'from-emerald-500 to-green-500',
      href: '/merchant/topup',
    },
    {
      label: '통계 보기',
      description: '매출 분석',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500',
      href: '/merchant/stats',
    },
  ];

  const menuItems = [
    {
      label: '상품 관리',
      description: '메뉴 및 상품 등록',
      icon: Package,
      href: '/merchant/products',
    },
    {
      label: '매장 관리',
      description: '매장 정보 수정',
      icon: MapPin,
      href: '/merchant/outlets',
    },
    {
      label: '정산 관리',
      description: '거래 내역 및 출금',
      icon: Banknote,
      href: '/merchant/settlements',
    },
  ];

  const recentActivities = [
    { id: '1', type: 'use', message: '쿠폰 "10% 할인" 사용됨', time: '5분 전', store: '강남점' }, // Modified from diff
    { id: '2', type: 'issue', message: '새 쿠폰 "무료 커피" 발급', time: '12분 전', store: '본점' }, // Modified from diff
    { id: '3', type: 'review', message: '새 리뷰 ★★★★★', time: '1시간 전', store: '홍대점' }, // Modified from diff
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass-dark">
        <div className="flex items-center justify-between h-16 px-4">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl sm:text-2xl">구름장터</h1>
              <p className="text-white/70 text-sm sm:text-base">사장님 전용</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadData}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <QrCode className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Active Coupons Section (Top) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              활성 쿠폰
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white text-xs"
              onClick={() => router.push('/merchant/coupons')}
            >
              전체보기
            </Button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
            {coupons.filter(c => c.status === 'ACTIVE').length > 0 ? (
              coupons.filter(c => c.status === 'ACTIVE').map((coupon, index) => (
                <motion.div
                  key={coupon.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="min-w-[280px]"
                >
                  <Card
                    className="glass-card hover-lift overflow-hidden cursor-pointer h-full"
                    onClick={() => {
                      setSelectedDetailCoupon(coupon);
                      setIsDetailOpen(true);
                    }}
                  >
                    <div className="aspect-video relative bg-black/20">
                      {coupon.imageUrl ? (
                        coupon.mediaType === 'VIDEO' || (coupon.imageUrl.startsWith('blob:') && coupon.imageUrl.includes('video')) ? (
                          <video
                            src={coupon.imageUrl}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coupon.imageUrl}
                            alt={getCouponName(coupon)}
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                          <Ticket className="w-10 h-10 text-white/20" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-500 text-white border-0 animate-pulse">
                          LIVE
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h4 className="font-bold text-lg mb-1 truncate">{getCouponName(coupon)}</h4>
                      <p className="text-2xl font-bold gradient-text mb-2">{getDiscountDisplay(coupon)}</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{coupon.usedQuantity}명 사용</span>
                        <span>{new Date(coupon.validUntil).toLocaleDateString()}까지</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="w-full text-center py-8 glass-card rounded-xl">
                <p className="text-muted-foreground mb-2">활성 쿠폰이 없습니다</p>
                <Button
                  size="sm"
                  onClick={() => router.push('/merchant/coupons')}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  쿠폰 만들기
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Orange LED Stats Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="led-btn-orange flex-col gap-1 py-4 h-auto">
            <span className="text-sm opacity-90">발급 쿠폰</span>
            <span className="text-2xl font-bold">{coupons.filter(c => c.status === 'ACTIVE').length}</span>
          </div>
          <div className="led-btn-orange flex-col gap-1 py-4 h-auto">
            <span className="text-sm opacity-90">완료 쿠폰</span>
            <span className="text-2xl font-bold">{totalUsed}</span>
          </div>
        </motion.div>
        {profile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card overflow-hidden card-3d">
              <div className="card-3d-inner">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-2xl">
                            {profile.name.charAt(0)}
                          </span>
                        </div>
                        <div className="absolute -top-1 -right-1">
                          <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 text-xs px-1.5">
                            PRO
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <h2 className="font-bold text-xl">{profile.name}</h2>
                        <p className="text-sm text-muted-foreground">{profile.type}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-green-500">인증됨</span>
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 shadow-lg">
                      {profile.status}
                    </Badge>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 border border-violet-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-transparent rounded-full blur-2xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">사용 가능 잔액</p>
                        <Zap className="w-4 h-4 text-amber-500" />
                      </div>
                      <p className="text-4xl font-bold gradient-text mb-3">
                        {profile.balance.toLocaleString()}
                        <span className="text-lg ml-1">원</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Progress value={75} className="flex-1 h-2" />
                        <span className="text-xs text-muted-foreground">75%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card className="glass-card hover-lift">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                        <Icon className="w-5 h-5" style={{ color: stat.color.includes('pink') ? '#ec4899' : stat.color.includes('amber') ? '#f59e0b' : stat.color.includes('emerald') ? '#10b981' : '#3b82f6' }} />
                      </div>
                      <Badge variant="outline" className="text-xs border-green-500/50 text-green-500">
                        {stat.trend}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              빠른 실행
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <Card
                    className="glass-card hover-lift cursor-pointer group overflow-hidden"
                    onClick={() => router.push(action.href)}
                  >
                    <CardContent className="p-4 relative">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-sm block">{action.label}</span>
                          <span className="text-xs text-muted-foreground">{action.description}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" />
              관리 메뉴
            </h3>
          </div>

          <Card className="glass-card">
            <CardContent className="p-2">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => router.push(item.href)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity & Google Sheets Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              최근 활동
            </h2>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <Card key={activity.id} className="glass-card hover:bg-white/5 transition-colors cursor-pointer group">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${activity.type === 'issue' ? 'bg-blue-500/20 text-blue-400' :
                          activity.type === 'use' ? 'bg-green-500/20 text-green-400' :
                            'bg-purple-500/20 text-purple-400'
                        }`}>
                        {activity.type === 'issue' ? <Ticket className="w-4 h-4" /> :
                          activity.type === 'use' ? <Gift className="w-4 h-4" /> :
                            <Users className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">
                          {activity.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.time} · {activity.store}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Google Sheets Log Integration */}
            <GoogleSheetsLog />
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              내 매장
            </h2>
            <div className="space-y-3">
              {outlets.slice(0, 2).map((outlet, index) => (
                <motion.div
                  key={outlet.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                >
                  <Card
                    className="glass-card hover-lift cursor-pointer group"
                    onClick={() => router.push(`/merchant/outlets/${outlet.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {outlet.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={outlet.imageUrl}
                            alt={outlet.name}
                            className="w-16 h-16 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate">{outlet.name}</h4>
                            {outlet.status === 'ACTIVE' && (
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{outlet.address}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${outlet.status === 'ACTIVE' ? 'border-emerald-500 text-emerald-500' : 'border-gray-500 text-gray-500'}`}
                            >
                              {outlet.status === 'ACTIVE' ? '영업중' : '휴업'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              • 오늘 {Math.floor(Math.random() * 50)}건
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {outlets.length === 0 && (
                <Card className="glass-card">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                      <MapPin className="w-8 h-8 text-violet-500" />
                    </div>
                    <p className="text-muted-foreground mb-4">등록된 매장이 없습니다</p>
                    <Button
                      onClick={() => router.push('/merchant/outlets/new')}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    >
                      매장 등록하기
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="pb-4"
        >
          <Button
            onClick={() => router.push('/merchant/coupons')}
            className="w-full py-6 text-lg font-bold bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:from-violet-600 hover:via-purple-600 hover:to-pink-600 shadow-2xl hover-glow relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            <Ticket className="w-6 h-6 mr-2" />
            쿠폰 발급하기
          </Button>
        </motion.div>
      </div >

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="glass-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              쿠폰 상세 정보
            </DialogTitle>
          </DialogHeader>

          {selectedDetailCoupon && (
            <div className="space-y-6">
              {/* Media Preview + 업로드 영역 */}
              <div
                className={`aspect-video rounded-xl overflow-hidden border-2 border-dashed flex items-center justify-center relative group cursor-pointer transition-all ${
                  dragOver
                    ? 'border-purple-400 bg-purple-500/20'
                    : selectedDetailCoupon.imageUrl
                      ? 'border-transparent bg-black/50'
                      : 'border-white/20 bg-black/30 hover:border-purple-400/50 hover:bg-purple-500/10'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                {/* 숨겨진 파일 input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />

                {/* 업로드 중 */}
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 text-purple-400">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <span className="text-sm font-bold">업로드 중...</span>
                  </div>
                ) : selectedDetailCoupon.imageUrl ? (
                  <>
                    {/* 기존 미디어 표시 */}
                    {selectedDetailCoupon.mediaType === 'VIDEO' || (selectedDetailCoupon.imageUrl.startsWith('blob:') && selectedDetailCoupon.imageUrl.includes('video')) || selectedDetailCoupon.imageUrl.includes('/videos/') ? (
                      <video
                        src={selectedDetailCoupon.imageUrl}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        playsInline
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedDetailCoupon.imageUrl}
                        alt={selectedDetailCoupon.name}
                        className="w-full h-full object-contain"
                      />
                    )}
                    {/* 호버 시 교체 오버레이 */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <Upload className="w-8 h-8 text-white" />
                      <span className="text-white text-sm font-bold">클릭하여 교체</span>
                      <span className="text-white/60 text-xs">이미지 또는 영상</span>
                    </div>
                    {/* 업로드 성공 표시 */}
                    {uploadResult && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-bounce">
                        <CheckCircle className="w-3 h-3" />
                        저장됨!
                      </div>
                    )}
                  </>
                ) : (
                  /* 업로드 안내 (미디어 없을 때) */
                  <div className="flex flex-col items-center gap-3 text-center px-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        이미지 또는 영상을 올려주세요
                      </p>
                      <p className="text-white/50 text-xs mt-1">
                        클릭 또는 드래그 앤 드롭
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 text-[10px]">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        JPG, PNG, GIF
                      </Badge>
                      <Badge variant="secondary" className="bg-pink-500/20 text-pink-300 text-[10px]">
                        <Video className="w-3 h-3 mr-1" />
                        MP4, WebM
                      </Badge>
                    </div>
                    <p className="text-white/30 text-[10px]">최대 50MB</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold gradient-text">
                    {getCouponName(selectedDetailCoupon)}
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {selectedDetailCoupon.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">할인 혜택</div>
                    <div className="font-bold text-lg text-violet-400">
                      {getDiscountDisplay(selectedDetailCoupon)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">유효 기간</div>
                    <div className="font-medium text-sm">
                      {new Date(selectedDetailCoupon.validUntil).toLocaleDateString()} 까지
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">발급 수량</div>
                    <div className="font-medium text-sm">
                      {selectedDetailCoupon.totalQuantity.toLocaleString()}장
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">상태</div>
                    <div>{getStatusBadge(selectedDetailCoupon.status)}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold h-12 text-lg shadow-lg shadow-blue-500/20">
                  <CreditCard className="w-5 h-5 mr-2" />
                  추후결제 모듈 연동
                </Button>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  * 유니티 앱 및 VAN 사 결제 모듈과 연동하여 실시간 쿠폰 발급을 처리합니다.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 쿠폰톡톡 바로가기 플로팅 버튼 */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => router.push('/consumer')}
          className="h-14 px-6 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 hover:from-purple-600 hover:via-pink-600 hover:to-red-600 text-white font-bold shadow-2xl shadow-purple-500/50 rounded-full flex items-center gap-2 hover:scale-110 transition-transform"
        >
          <Sparkles className="w-5 h-5" />
          쿠폰톡톡
        </Button>
      </motion.div>
    </div >
  );
}
