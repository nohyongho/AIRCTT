'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CouponGame3D from '@/components/consumer/CouponGame3D';
import { toast } from 'sonner';

export default function GamePage() {
    const router = useRouter();

    // 게임 페이지는 몰입감을 위해 기본 다크모드!
    useEffect(() => {
        const html = document.documentElement;
        const wasDark = html.classList.contains('dark');
        html.classList.add('dark');
        return () => {
            if (!wasDark) html.classList.remove('dark');
        };
    }, []);

    const handleCouponAcquired = (amount: number, name: string) => {
        // Game has its own UI for this
    };

    const handleClose = () => {
        router.push('/consumer');
    };

    return (
        <div className="w-full h-screen dark">
            <CouponGame3D
                onCouponAcquired={handleCouponAcquired}
                onClose={handleClose}
                lang="ko"
            />
        </div>
    );
}
