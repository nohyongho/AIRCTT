// GET/POST /api/ctt/merchant/coupons - 가맹점 쿠폰 관리

import { NextRequest, NextResponse } from 'next/server';
import { createPostgrestClient } from '@/lib/postgrest';
import type { Coupon } from '@/types/coupon';

export const dynamic = 'force-dynamic';

// GET - 가맹점의 쿠폰 목록 조회
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const merchant_id = searchParams.get('merchant_id');
        const store_id = searchParams.get('store_id');
        const status = searchParams.get('status'); // active, inactive, expired
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        if (!merchant_id) {
            return NextResponse.json(
                { error: 'merchant_id is required' },
                { status: 400 }
            );
        }

        const client = createPostgrestClient();

        let query = client
            .from('coupons')
            .select(`
                *,
                stores (
                    id,
                    name,
                    address
                )
            `, { count: 'exact' })
            .eq('merchant_id', merchant_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // 특정 매장 필터
        if (store_id) {
            query = query.eq('store_id', store_id);
        }

        // 상태 필터
        if (status === 'active') {
            query = query
                .eq('is_active', true)
                .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString()}`);
        } else if (status === 'inactive') {
            query = query.eq('is_active', false);
        } else if (status === 'expired') {
            query = query.lt('valid_to', new Date().toISOString());
        }

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        return NextResponse.json({
            coupons: data || [],
            total: count || 0,
            limit,
            offset
        });

    } catch (error: any) {
        console.error('Get merchant coupons error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST - 새 쿠폰 생성
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            merchant_id,
            store_id,
            title,
            description,
            discount_type,
            discount_value,
            max_discount_amount,
            min_order_amount,
            valid_from,
            valid_to,
            max_issues,
            max_per_user,
            requires_location,
            location_radius_km,
            ar_enabled,
            ar_asset_url,
            terms,
            // Platform v1 추가 필드
            product_sku,
            asset_type,
            asset_url,
        } = body;

        // 필수 파라미터 검증
        if (!merchant_id || !title || !discount_type || !discount_value) {
            return NextResponse.json(
                { error: 'merchant_id, title, discount_type, and discount_value are required' },
                { status: 400 }
            );
        }

        // 할인 타입 검증
        if (!['percent', 'amount'].includes(discount_type)) {
            return NextResponse.json(
                { error: 'discount_type must be "percent" or "amount"' },
                { status: 400 }
            );
        }

        // 퍼센트 할인 범위 검증
        if (discount_type === 'percent' && (discount_value < 1 || discount_value > 100)) {
            return NextResponse.json(
                { error: 'Percent discount must be between 1 and 100' },
                { status: 400 }
            );
        }

        const client = createPostgrestClient();

        // 가맹점 소유권 검증 (store_id가 있는 경우)
        if (store_id) {
            const { data: store, error: storeError } = await client
                .from('stores')
                .select('id, merchant_id')
                .eq('id', store_id)
                .single();

            if (storeError || !store) {
                return NextResponse.json(
                    { error: 'Store not found' },
                    { status: 404 }
                );
            }

            if (store.merchant_id !== merchant_id) {
                return NextResponse.json(
                    { error: 'Store does not belong to this merchant' },
                    { status: 403 }
                );
            }
        }

        // 쿠폰 생성 (product_sku, asset_type, coupon_group_key 포함)
        const couponData: Partial<Coupon> & Record<string, unknown> = {
            merchant_id,
            store_id: store_id || null,
            title,
            description: description || null,
            discount_type,
            discount_value,
            max_discount_amount: max_discount_amount || null,
            min_order_amount: min_order_amount || 0,
            valid_from: valid_from || new Date().toISOString(),
            valid_to: valid_to || null,
            max_issues: max_issues || null,
            max_per_user: max_per_user || 1,
            requires_location: requires_location ?? true,
            location_radius_km: location_radius_km || 1.0,
            ar_enabled: ar_enabled ?? false,
            ar_asset_url: ar_asset_url || null,
            terms: terms || null,
            is_active: true,
            // Platform v1: 단일상품 정책 + 크랙커 에셋 + 승인 워크플로우
            product_sku: product_sku || null,
            asset_type: asset_type || 'IMAGE_2D',
            asset_url: asset_url || null,
            // coupon_group_key는 DB 트리거가 자동 생성 (store_id:product_sku)
            // 승인 대기 상태로 시작 (에셋이 있으면 PENDING_APPROVAL, 없으면 DRAFT)
            approval_status: (asset_url || product_sku) ? 'PENDING_APPROVAL' : 'DRAFT',
            // 단가 계산
            unit_price: getUnitPrice(asset_type),
        };

        const { data: coupon, error: createError } = await client
            .from('coupons')
            .insert(couponData)
            .select()
            .single();

        if (createError) {
            throw createError;
        }

        // 이벤트 기록
        if (coupon) {
            try {
                await client.from('coupon_events').insert({
                    store_id: coupon.store_id,
                    coupon_id: coupon.id,
                    event_type: 'ISSUED',
                    meta: {
                        product_sku: coupon.product_sku,
                        asset_type: coupon.asset_type,
                        discount_type: coupon.discount_type,
                        discount_value: coupon.discount_value,
                        total_issuable: max_issues,
                    },
                });
            } catch { /* fire-and-forget */ }
        }

        return NextResponse.json({
            success: true,
            coupon,
            estimated_cost: coupon?.unit_price && max_issues
                ? coupon.unit_price * max_issues
                : null,
        }, { status: 201 });

    } catch (error: any) {
        console.error('Create coupon error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

function getUnitPrice(assetType?: string): number {
    const prices: Record<string, number> = {
        'IMAGE_2D': 50,
        'MODEL_3D': 80,
        'VIDEO': 100,
    };
    return prices[assetType || 'IMAGE_2D'] || 50;
}
