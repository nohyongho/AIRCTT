import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';

/**
 * GET /api/coupons/nearby
 * 반경 기반 쿠폰 조회 API
 *
 * Query Parameters:
 * - lat: 위도 (필수)
 * - lng: 경도 (필수)
 * - radius: 반경 km (기본값: 5)
 * - category: 카테고리 필터 (선택)
 * - limit: 최대 개수 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const radius = parseFloat(searchParams.get('radius') || '5');
    const category = searchParams.get('category') || null;
    const limit = parseInt(searchParams.get('limit') || '20');

    // 위치 정보 검증
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: '위치 정보(lat, lng)가 필요합니다.' },
        { status: 400 }
      );
    }

    const postgrest = createPostgrestClient();

    // RPC 함수 호출 (v2: 승인 필터 + 에셋 정보 포함)
    const { data: nearbyCoupons, error: rpcError } = await postgrest.rpc(
      'get_nearby_coupons_v2',
      {
        user_lat: lat,
        user_lng: lng,
        search_radius_km: radius,
        limit_count: limit,
      }
    ).then(res => {
      // v2 함수가 없으면 v1으로 폴백
      if (res.error?.code === '42883') {
        return postgrest.rpc('get_nearby_coupons', {
          user_lat: lat,
          user_lng: lng,
          search_radius_km: radius,
          limit_count: limit,
        });
      }
      return res;
    });

    if (rpcError) {
      console.error('RPC Error:', rpcError);

      // RPC 실패 시 직접 쿼리 (폴백)
      const { data: coupons, error: queryError } = await postgrest
        .from('coupons')
        .select(`
          id,
          merchant_id,
          store_id,
          title,
          description,
          discount_type,
          discount_value,
          valid_to,
          product_sku,
          coupon_group_key,
          asset_type,
          asset_url,
          approval_status,
          stores!inner(
            id,
            name,
            address,
            lat,
            lng
          )
        `)
        .eq('is_active', true)
        .or(`valid_from.is.null,valid_from.lte.${new Date().toISOString()}`)
        .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString()}`)
        .or('approval_status.is.null,approval_status.eq.APPROVED')
        .limit(limit);

      if (queryError) {
        console.error('Query Error:', queryError);
        return NextResponse.json(
          { success: false, error: '쿠폰 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      // 클라이언트 사이드 거리 계산
      const couponsWithDistance = (coupons || [])
        .map((coupon: any) => {
          const store = coupon.stores;
          if (!store?.lat || !store?.lng) return null;

          const distance = calculateDistance(lat, lng, store.lat, store.lng);
          if (distance > radius) return null;

          return {
            coupon_id: coupon.id,
            merchant_id: coupon.merchant_id,
            store_id: coupon.store_id,
            title: coupon.title,
            description: coupon.description,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            store_name: store.name,
            store_address: store.address,
            distance_km: Math.round(distance * 100) / 100,
            valid_until: coupon.valid_to,
            product_sku: coupon.product_sku,
            coupon_group_key: coupon.coupon_group_key,
            asset_type: coupon.asset_type,
            asset_url: coupon.asset_url,
            approval_status: coupon.approval_status,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distance_km - b.distance_km);

      return NextResponse.json({
        success: true,
        data: couponsWithDistance,
        meta: {
          lat,
          lng,
          radius,
          count: couponsWithDistance.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: nearbyCoupons || [],
      meta: {
        lat,
        lng,
        radius,
        count: nearbyCoupons?.length || 0,
      },
    });
  } catch (error) {
    console.error('Nearby coupons API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * Haversine 공식을 이용한 두 지점 간 거리 계산 (km)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
