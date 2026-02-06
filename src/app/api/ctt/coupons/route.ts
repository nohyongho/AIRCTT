// GET /api/ctt/coupons - 근처 쿠폰 조회

import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';
import type { NearbyCoupon } from '@/types/coupon';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '0');
        const lng = parseFloat(searchParams.get('lng') || '0');
        const radiusKm = parseFloat(searchParams.get('r') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        // 위치 검증
        if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return NextResponse.json(
                { error: 'Invalid location parameters' },
                { status: 400 }
            );
        }

        const client = createPostgrestClient();

        // PostgREST RPC 호출
        const { data, error } = await client.rpc('get_nearby_coupons', {
            user_lat: lat,
            user_lng: lng,
            search_radius_km: radiusKm,
            limit_count: limit
        });

        if (error) {
            console.error('get_nearby_coupons error:', error);
            // RPC 실패시 직접 쿼리 (fallback)
            return await fallbackNearbyCoupons(client, lat, lng, radiusKm, limit);
        }

        const coupons: NearbyCoupon[] = data || [];

        return NextResponse.json({
            coupons,
            count: coupons.length,
            location: { lat, lng },
            radius_km: radiusKm
        });

    } catch (error: any) {
        console.error('Nearby coupons error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// RPC 실패시 직접 쿼리
async function fallbackNearbyCoupons(
    client: any,
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number
) {
    const { data: coupons, error } = await client
        .from('coupons')
        .select(`
            id,
            store_id,
            title,
            description,
            discount_type,
            discount_value,
            radius_km,
            valid_to,
            total_issuable,
            per_user_limit,
            stores!inner (
                id,
                name,
                address,
                lat,
                lng
            )
        `)
        .eq('is_active', true)
        .or('valid_to.is.null,valid_to.gt.now()')
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 클라이언트에서 거리 계산 및 필터링
    const R = 6371;
    const filtered = (coupons || [])
        .map((c: any) => {
            const storeLat = c.stores?.lat;
            const storeLng = c.stores?.lng;
            if (!storeLat || !storeLng) return null;

            const dLat = (storeLat - lat) * Math.PI / 180;
            const dLng = (storeLng - lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat * Math.PI / 180) * Math.cos(storeLat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c2 = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c2;

            const effectiveRadius = c.radius_km || radiusKm;
            if (distance > effectiveRadius) return null;

            return {
                coupon_id: c.id,
                store_id: c.store_id,
                store_name: c.stores.name,
                store_address: c.stores.address,
                title: c.title,
                description: c.description,
                discount_type: c.discount_type,
                discount_value: c.discount_value,
                radius_km: c.radius_km,
                distance_km: Math.round(distance * 100) / 100,
                valid_to: c.valid_to,
                total_issuable: c.total_issuable,
                per_user_limit: c.per_user_limit
            };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distance_km - b.distance_km);

    return NextResponse.json({
        coupons: filtered,
        count: filtered.length,
        location: { lat, lng },
        radius_km: radiusKm
    });
}
