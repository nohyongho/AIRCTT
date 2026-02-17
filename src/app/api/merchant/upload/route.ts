import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/merchant/upload
 * 사장님 전용 미디어 업로드 (이미지/영상)
 * Supabase Storage에 업로드 후 public URL 반환
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const couponId = formData.get('coupon_id') as string | null;
    const storeId = formData.get('store_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: '파일 크기가 100MB를 초과합니다.' },
        { status: 400 }
      );
    }

    // 허용 타입 체크
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `지원하지 않는 파일 형식입니다: ${file.type}` },
        { status: 400 }
      );
    }

    const isVideo = file.type.startsWith('video/');
    const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const folder = isVideo ? 'videos' : 'images';
    const fileName = `merchant/${folder}/${storeId || 'unknown'}/${timestamp}_${random}.${ext}`;

    // Supabase Storage에 업로드
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nlsiwrwiyozpiofrmzxa.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const bucket = 'coupon-media';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;

    const fileBuffer = await file.arrayBuffer();

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Supabase Storage upload error:', errText);

      // 폴백: 로컬 base64 데이터 URL 반환 (Supabase Storage가 없어도 동작)
      const base64 = Buffer.from(fileBuffer).toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;

      return NextResponse.json({
        success: true,
        url: dataUrl,
        media_type: isVideo ? 'VIDEO' : 'IMAGE',
        file_name: file.name,
        file_size: file.size,
        fallback: true,
        message: 'base64 폴백으로 저장됨 (Storage 미설정)',
      });
    }

    // Public URL 생성
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`;

    // 쿠폰 DB에 URL 업데이트 (coupon_id가 있는 경우)
    if (couponId) {
      try {
        const postgrestUrl = supabaseUrl;
        await fetch(`${postgrestUrl}/rest/v1/coupons?id=eq.${couponId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            asset_url: publicUrl,
            asset_type: isVideo ? 'VIDEO' : 'IMAGE_2D',
          }),
        });
      } catch (dbErr) {
        console.warn('DB 업데이트 실패 (업로드는 성공):', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      media_type: isVideo ? 'VIDEO' : 'IMAGE',
      file_name: file.name,
      file_size: file.size,
      storage_path: fileName,
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { success: false, error: '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
