
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Ticket, Calendar, Ban, CheckCircle2, Copy, MapPin, Clock, Globe, Map } from 'lucide-react';

// ★ 지도 컴포넌트 (SSR 방지 - Leaflet은 window 필요)
const CouponRadiusMap = dynamic(() => import('@/components/merchant/CouponRadiusMap'), { ssr: false });
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function CouponCreatePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);

    // Coupon Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        discountType: 'PERCENT',
        discountValue: '',
        totalQuantity: 100,
        minOrderAmount: 0,
        imageUrl: '',
        // ★ 유효기간 (시작~종료)
        validFrom: new Date().toISOString().split('T')[0],
        validTo: '',
        // ★ 반경 설정 (미터 단위, 안전핀2 반영)
        radiusType: 'store' as 'store' | 'custom' | 'nationwide',
        radiusM: 5000,
        // ★ 배포 중심 좌표
        centerLat: 37.5665,
        centerLng: 126.978,
        // ★ 배포 시간
        distributionStartTime: '09:00',
        distributionEndTime: '22:00',
        perUserLimit: 1,
    });

    // 반경 표시 포맷
    const formatRadius = (m: number) => {
        if (m >= 1000000) return `${(m / 1000).toLocaleString()}km`;
        if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
        return `${m}m`;
    };

    const handleCreate = async () => {
        if (!formData.title || !formData.discountValue) {
            toast.error('쿠폰 이름과 할인 혜택을 입력해주세요.');
            return;
        }

        setLoading(true);

        try {
            // ★ 실제 API 호출 (CUT-2 해결!)
            const res = await fetch('/api/merchant/coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchant_id: localStorage.getItem('airctt_merchant_id') || '',
                    store_id: localStorage.getItem('airctt_store_id') || '',
                    title: formData.title,
                    description: formData.description,
                    discount_type: formData.discountType.toLowerCase(),
                    discount_value: parseFloat(formData.discountValue),
                    total_issuable: formData.totalQuantity,
                    valid_from: formData.validFrom || null,
                    valid_to: formData.validTo || null,
                    radius_km: formData.radiusType === 'nationwide' ? 20001 : formData.radiusM / 1000,
                    min_order_amount: formData.minOrderAmount,
                    per_user_limit: formData.perUserLimit,
                }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || '발행 실패');

            toast.success('쿠폰이 성공적으로 발행되었습니다! 🎟️');
            router.push('/merchant/coupons');
        } catch (e: any) {
            toast.error(`발행 실패: ${e.message || '다시 시도해주세요.'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center text-[1.1rem]">
            <div className="w-full max-w-3xl space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">새 쿠폰 만들기</h1>
                        <p className="text-lg text-slate-500">고객들을 끌어당길 매력적인 혜택을 만들어보세요.</p>
                    </div>
                    <Button variant="ghost" className="text-lg px-5 py-3" onClick={() => router.back()}>취소</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Left: Form */}
                    <Card className="md:col-span-2 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-2xl">쿠폰 상세 설정</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <div className="space-y-2">
                                <Label className="text-base font-semibold">쿠폰 이름</Label>
                                <Input
                                    placeholder="예: 전 메뉴 10% 할인, 아메리카노 1잔 무료"
                                    className="h-12 text-base"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>혜택 유형</Label>
                                    <Select
                                        value={formData.discountType}
                                        onValueChange={(v) => setFormData({ ...formData, discountType: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PERCENT">퍼센트(%) 할인</SelectItem>
                                            <SelectItem value="FIXED_AMOUNT">금액(원) 할인</SelectItem>
                                            <SelectItem value="FREE_ITEM">무료 메뉴 증정</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>혜택 값</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            placeholder={formData.discountType === 'FREE_ITEM' ? '0' : '10'}
                                            value={formData.discountValue}
                                            onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                            disabled={formData.discountType === 'FREE_ITEM'}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                            {formData.discountType === 'PERCENT' ? '%' : formData.discountType === 'FIXED_AMOUNT' ? '원' : '개'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>설명 / 유의사항</Label>
                                <Textarea
                                    placeholder="예: 1만원 이상 주문 시 사용 가능, 타 쿠폰 중복 불가"
                                    className="h-24 resize-none"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>발행 수량 (선착순)</Label>
                                    <Input
                                        type="number"
                                        value={formData.totalQuantity}
                                        onChange={(e) => setFormData({ ...formData, totalQuantity: parseInt(e.target.value) || 100 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>1인당 수량 제한</Label>
                                    <Input
                                        type="number"
                                        min={1} max={10}
                                        value={formData.perUserLimit}
                                        onChange={(e) => setFormData({ ...formData, perUserLimit: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>

                            {/* ★ 유효기간 (시작일/종료일 캘린더) */}
                            <div className="space-y-3 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    <Label className="text-indigo-700 font-semibold">유효기간</Label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">시작일</Label>
                                        <Input type="date" value={formData.validFrom}
                                            onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">종료일</Label>
                                        <Input type="date" value={formData.validTo}
                                            onChange={(e) => setFormData({ ...formData, validTo: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* ★ 반경 설정 (50m ~ 20,000km) */}
                            <div className="space-y-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <MapPin className="w-4 h-4 text-emerald-500" />
                                    <Label className="text-emerald-700 font-semibold">배포 반경</Label>
                                </div>
                                <Select
                                    value={formData.radiusType}
                                    onValueChange={(v: any) => {
                                        setFormData({ ...formData, radiusType: v });
                                        if (v === 'custom') setShowMap(true);
                                    }}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="store">매장 기준 반경</SelectItem>
                                        <SelectItem value="custom">위치 직접 지정</SelectItem>
                                        <SelectItem value="nationwide">전국 배포</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* ★ 인라인 미니 지도 + 반경 슬라이더 (전국배포 제외) */}
                                {formData.radiusType !== 'nationwide' && (
                                    <div className="space-y-3">
                                        {/* 미니 지도 — 클릭하면 팝업 확대 */}
                                        <div
                                            className="relative rounded-xl overflow-hidden border-2 border-emerald-200 cursor-pointer hover:border-emerald-400 transition-all group"
                                            onClick={() => setShowMap(true)}
                                        >
                                            <div className="w-full h-[200px]">
                                                <CouponRadiusMap
                                                    radiusM={formData.radiusM}
                                                    onRadiusChange={(m) => setFormData((prev) => ({ ...prev, radiusM: m }))}
                                                    centerLat={formData.centerLat}
                                                    centerLng={formData.centerLng}
                                                    onCenterChange={(lat, lng) => setFormData((prev) => ({ ...prev, centerLat: lat, centerLng: lng }))}
                                                    onClose={() => {}}
                                                    onConfirm={() => {}}
                                                    inline={true}
                                                />
                                            </div>
                                            {/* 확대 오버레이 */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                                                <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2">
                                                    <Map className="w-5 h-5 text-indigo-600" />
                                                    <span className="font-bold text-indigo-600 text-base">탭하여 확대 🔍</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 반경 표시 + 슬라이더 */}
                                        <div className="flex justify-between text-base">
                                            <span className="font-bold text-emerald-700">
                                                📍 반경: {formatRadius(formData.radiusM)}
                                            </span>
                                            <span className="text-slate-400 text-sm">50m ~ 20,000km</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={50} max={20000000}
                                            step={formData.radiusM < 1000 ? 50 : formData.radiusM < 10000 ? 500 : formData.radiusM < 100000 ? 5000 : 50000}
                                            value={formData.radiusM}
                                            onChange={(e) => setFormData({ ...formData, radiusM: parseInt(e.target.value) })}
                                            className="w-full accent-emerald-500 h-3"
                                        />
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>50m</span><span>500m</span><span>5km</span><span>50km</span><span>500km</span><span>20,000km</span>
                                        </div>
                                        {formData.centerLat !== 37.5665 && (
                                            <p className="text-sm text-emerald-600 text-center font-medium">
                                                ✅ 설정됨: {formData.centerLat.toFixed(4)}, {formData.centerLng.toFixed(4)} / 반경 {formatRadius(formData.radiusM)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {formData.radiusType === 'nationwide' && (
                                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg">
                                        <Globe className="w-5 h-5 text-blue-500" />
                                        <span className="text-sm text-slate-600">전국 모든 고객에게 노출됩니다</span>
                                    </div>
                                )}
                            </div>

                            {/* ★ 배포 시간 */}
                            <div className="space-y-3 p-5 bg-amber-50 rounded-xl border border-amber-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="w-5 h-5 text-amber-500" />
                                    <Label className="text-amber-700 font-bold text-base">배포 시간</Label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-sm text-slate-500">시작</Label>
                                        <Input type="time" className="h-12 text-base" value={formData.distributionStartTime}
                                            onChange={(e) => setFormData({ ...formData, distributionStartTime: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-sm text-slate-500">종료</Label>
                                        <Input type="time" className="h-12 text-base" value={formData.distributionEndTime}
                                            onChange={(e) => setFormData({ ...formData, distributionEndTime: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-base font-semibold">대표 이미지 업로드</Label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 gap-3 hover:bg-slate-50 hover:border-indigo-300 transition-colors cursor-pointer">
                                    <div className="bg-slate-100 p-3 rounded-full">
                                        <Copy className="w-8 h-8" />
                                    </div>
                                    <span className="text-base">클릭하여 이미지 업로드 (최대 5MB)</span>
                                </div>
                            </div>

                        </CardContent>
                    </Card>

                    {/* Right: Preview */}
                    <div className="space-y-6">
                        <h3 className="font-bold text-slate-700">미리보기 (고객 화면)</h3>

                        {/* Coupon Card Preview */}
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100 relative">
                            <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-500 relative">
                                <div className="absolute inset-0 bg-black/10" />
                                <div className="absolute bottom-3 left-4 text-white">
                                    <p className="text-xs font-bold opacity-80 mb-1">AIRCTT 강남점</p>
                                    <h3 className="font-bold text-xl">{formData.title || '쿠폰 이름'}</h3>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between items-center pb-3 border-b border-dashed border-slate-200">
                                    <div>
                                        <span className="text-3xl font-extrabold text-indigo-600">
                                            {formData.discountType === 'PERCENT' ? `${formData.discountValue || 0}%` :
                                                formData.discountType === 'FIXED_AMOUNT' ? `${formData.discountValue || 0}원` :
                                                    'FREE'}
                                        </span>
                                        <span className="text-sm font-bold text-slate-500 ml-1">OFF</span>
                                    </div>
                                    <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">
                                        {formData.validTo ? `~${formData.validTo}` : '무기한'}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    {formData.description || '쿠폰 상세 설명이 여기에 표시됩니다.'}
                                </p>
                                <Button className="w-full bg-slate-900 h-10 text-sm">쿠폰 받기</Button>
                            </div>

                            {/* Punch Hole Decoration */}
                            <div className="absolute top-32 left-0 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-slate-50 rounded-full" />
                            <div className="absolute top-32 right-0 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-slate-50 rounded-full" />
                        </div>

                        <Button
                            size="lg"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 h-16 text-xl font-bold shadow-lg shadow-indigo-200 rounded-xl"
                            onClick={handleCreate}
                            disabled={loading}
                        >
                            {loading ? '발행 중...' : '🎟️ 쿠폰 발행하기'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ★ 쿠폰 배포 위치 지도 모달 */}
            {showMap && (
                <CouponRadiusMap
                    radiusM={formData.radiusM}
                    onRadiusChange={(m) => setFormData((prev) => ({ ...prev, radiusM: m }))}
                    centerLat={formData.centerLat}
                    centerLng={formData.centerLng}
                    onCenterChange={(lat, lng) => setFormData((prev) => ({ ...prev, centerLat: lat, centerLng: lng }))}
                    onClose={() => setShowMap(false)}
                    onConfirm={() => {
                        setShowMap(false);
                        toast.success(`배포 위치 설정 완료! 반경 ${formatRadius(formData.radiusM)}`);
                    }}
                />
            )}
        </div>
    );
}
