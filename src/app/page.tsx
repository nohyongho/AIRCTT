
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Store,
  Wallet,
  ArrowRight,
  Zap,
  Shield,
  MapPin,
  Scan,
  Radio,
  Layers,
  Navigation,
  Eye,
  Cpu,
  Wifi,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mainButtons = [
    {
      id: 'coupon',
      label: '쿠폰톡톡',
      sublabel: 'CouponTalkTalk',
      description: '쿠폰 게임 & 스마트 지갑',
      icon: ShoppingBag,
      color: 'from-cyan-500 via-blue-500 to-indigo-500',
      shadowColor: 'shadow-cyan-500/30',
      href: '/consumer',
      features: ['쿠폰 게임', '스마트 지갑', '포인트 적립'],
    },
    {
      id: 'market',
      label: '구름장터',
      sublabel: 'Cloud Market',
      description: '가맹점 & 거래소',
      icon: Store,
      color: 'from-violet-500 via-purple-500 to-pink-500',
      shadowColor: 'shadow-violet-500/30',
      href: '/merchant',
      features: ['가맹점 관리', '쿠폰 발급', '매출 분석'],
    },
    {
      id: 'wallet',
      label: '지갑',
      sublabel: 'Wallet',
      description: '디지털 쿠폰 & 포인트',
      icon: Wallet,
      color: 'from-amber-500 via-orange-500 to-red-500',
      shadowColor: 'shadow-amber-500/30',
      href: '/consumer/wallet',
      features: ['포인트 충전', '쿠폰 거래', '결제 내역'],
    },
    {
      id: 'admin',
      label: '쿠폰 승인',
      sublabel: 'Coupon Approval',
      description: '본사 관리자 쿠폰 승인/거절',
      icon: Shield,
      color: 'from-red-500 via-rose-500 to-pink-500',
      shadowColor: 'shadow-red-500/30',
      href: '/admin/coupon-approvals',
      features: ['쿠폰 승인', '쿠폰 거절', '관리자 전용'],
    },
  ];

  const features = [
    {
      icon: MapPin,
      title: '위치기반 쿠폰',
      description: 'GPS 기반 맞춤 쿠폰 추천',
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
    {
      icon: Scan,
      title: '쿠폰 게임',
      description: '재미있는 게임으로 쿠폰 획득',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: Layers,
      title: '쿠폰 거래소',
      description: '구름장터에서 쿠폰 거래',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      icon: TrendingUp,
      title: '가맹점 분석',
      description: '매출 및 고객 데이터 분석',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  const techFeatures = [
    {
      icon: Navigation,
      title: '위치기반 쿠폰 배포',
      description: '사용자 위치에 따른 맞춤형 쿠폰 노출',
      patent: '특허 10-2019-0071298',
    },
    {
      icon: Eye,
      title: '스마트 알고리즘',
      description: '어려운 분들에게 자연스럽게 행운의 쿠폰을',
      patent: '자체 알고리즘',
    },
    {
      icon: Cpu,
      title: 'AI 추천 시스템',
      description: '사용자 행동 분석 기반 맞춤 쿠폰 추천',
      patent: 'AI/ML 기술',
    },
    {
      icon: Wifi,
      title: '실시간 거래소',
      description: '구름장터에서 쿠폰 실시간 거래',
      patent: '클라우드 기술',
    },
  ];

  const stats = [
    { value: '50K+', label: '활성 사용자' },
    { value: '1,200+', label: '제휴 매장' },
    { value: '100K+', label: '발급 쿠폰' },
    { value: '99.9%', label: '서비스 안정성' },
  ];

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-0 left-1/4 w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-48 sm:w-72 md:w-96 h-48 sm:h-72 md:h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[450px] md:w-[600px] h-[300px] sm:h-[450px] md:h-[600px] bg-pink-500/5 rounded-full blur-3xl" />

        {/* 3D Grid Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px] sm:bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass safe-area-top">
        <div className="container mx-auto flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4">
          <motion.div
            className="flex items-center gap-2 sm:gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <motion.div
                className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-background"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">AIRCTT</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">AR Coupon Platform</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/login')}
              className="hidden sm:flex text-xs sm:text-sm"
            >
              로그인
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-28 md:pt-32 pb-8 sm:pb-12 md:pb-16 px-3 sm:px-4">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >


            <Badge className="mb-4 sm:mb-6 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 text-primary border-purple-500/20 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm">
              <MapPin className="w-3 h-3 mr-1" />
              위치기반 AR 플랫폼
            </Badge>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              <span className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">쿠폰톡톡</span>
              <br />
              <span className="text-foreground">누구나 쉽게, 누구나 행복하게</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
              게임으로 쿠폰을 얻고, 구름장터에서 거래하는
              <br className="hidden sm:block" />
              차세대 디지털 쿠폰 플랫폼
            </p>

            {/* Patent Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-2 mb-6 sm:mb-8"
            >
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                <Shield className="w-3 h-3 mr-1" />
                특허 10-2019-0071298
              </Badge>
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                <Shield className="w-3 h-3 mr-1" />
                특허 10-2022-0166543
              </Badge>
            </motion.div>
          </motion.div>

          {/* Real-time Event Button (Restored) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex justify-center mb-8"
          >
            <Button
              className="rounded-full bg-black/80 backdrop-blur-xl border-2 border-[#FFD600] text-[#FFD600] px-10 py-6 text-2xl font-black tracking-wider shadow-[0_0_30px_rgba(255,214,0,0.4)] hover:shadow-[0_0_50px_rgba(255,214,0,0.6)] hover:bg-black transition-all animate-pulse"
              onClick={() => router.push('/consumer')}
            >
              <Zap className="w-6 h-6 mr-2 fill-[#FFD600]" />
              실시간 이벤트
            </Button>
          </motion.div>

          {/* Main Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto mb-8 sm:mb-12 md:mb-16"
          >
            {mainButtons.map((button, index) => {
              const Icon = button.icon;
              return (
                <motion.div
                  key={button.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={`glass-card cursor-pointer group overflow-hidden hover-glow ${button.shadowColor} relative touch-manipulation`}
                    onClick={() => router.push(button.href)}
                  >
                    <CardContent className="p-4 sm:p-6 relative">
                      {/* Background Gradient */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${button.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                      {/* 3D Floating Icon */}
                      <motion.div
                        className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-xl sm:rounded-2xl bg-gradient-to-br ${button.color} flex items-center justify-center shadow-lg ${button.shadowColor}`}
                        whileHover={{
                          rotateY: 15,
                          rotateX: -15,
                          scale: 1.1
                        }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                      </motion.div>

                      {/* Text */}
                      <div className="text-center mb-3 sm:mb-4">
                        <h3 className="text-lg sm:text-xl font-bold mb-1">{button.label}</h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2">{button.sublabel}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{button.description}</p>
                      </div>

                      {/* Features */}
                      <div className="flex flex-wrap justify-center gap-1 mb-3 sm:mb-4">
                        {button.features.map((feature, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] sm:text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center text-primary">
                        <span className="text-xs sm:text-sm font-medium mr-1">시작하기</span>
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                className="text-center p-3 sm:p-4"
              >
                <p className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 sm:py-12 md:py-16 px-3 sm:px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
              <span className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">핵심 기능</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              AIRCTT만의 특별한 기술을 경험해보세요
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="glass-card hover-lift h-full">
                    <CardContent className="p-4 sm:p-6 text-center">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 rounded-lg sm:rounded-xl ${feature.bgColor} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${feature.color}`} />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2">{feature.title}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-8 sm:py-12 md:py-16 px-3 sm:px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8 sm:mb-12"
          >
            <Badge className="mb-3 sm:mb-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-primary border-purple-500/20 text-xs sm:text-sm">
              <Shield className="w-3 h-3 mr-1" />
              특허 기술
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
              <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">기술 혁신</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              위치기반 증강현실 디지털 재화 광고 시스템
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {techFeatures.map((tech, index) => {
              const Icon = tech.icon;
              return (
                <motion.div
                  key={tech.title}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="glass-card hover-lift h-full">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base mb-1">{tech.title}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-2">{tech.description}</p>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {tech.patent}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 md:py-16 px-3 sm:px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-6 sm:p-8 md:p-12 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10" />
                <div className="relative text-center">
                  <motion.div
                    className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30"
                    animate={{
                      rotateY: [0, 360],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  >
                    <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </motion.div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">
                    지금 바로 시작하세요
                  </h2>
                  <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-6 sm:mb-8 max-w-md mx-auto">
                    AIRCTT와 함께 쿠폰의 새로운 세계를 경험하세요.
                    무료로 시작할 수 있습니다.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/30 text-sm sm:text-base"
                      onClick={() => router.push('/merchant')}
                    >
                      <Store className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      사업자로 시작
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => router.push('/consumer')}
                      className="text-sm sm:text-base"
                    >
                      <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      소비자로 시작
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-3 sm:px-4 border-t safe-area-bottom">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Radio className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <span className="font-semibold text-sm sm:text-base">AIRCTT</span>
            </div>
            <p className="text-[10px] sm:text-sm text-muted-foreground text-center">
              © 2025 AIRCTT (주)발로레. All rights reserved. | airctt.com
            </p>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" className="text-muted-foreground text-[10px] sm:text-sm h-8">
                이용약관
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground text-[10px] sm:text-sm h-8">
                개인정보처리방침
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
