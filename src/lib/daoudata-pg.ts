/**
 * 다우데이터 PG/VAN 설정 (Sandbox / Production 전환)
 */
export interface DaouConfig {
  mid: string;
  apiKey: string;
  vanCode: string;
  returnUrl: string;
  notifyUrl: string;
  mode: 'sandbox' | 'production';
  apiBaseUrl: string;
}

export function getDaouConfig(): DaouConfig {
  const mode = (process.env.DAOU_MODE || 'sandbox') as 'sandbox' | 'production';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://airctt.com';

  return {
    mid: process.env.DAOU_MID || 'DAOU_SANDBOX_001',
    apiKey: process.env.DAOU_API_KEY || 'sk_test_demo_key_airctt_2026',
    vanCode: process.env.DAOU_VAN_CODE || 'VAN_DEMO_001',
    returnUrl: process.env.DAOU_RETURN_URL || `${baseUrl}/api/pg-demo/pay/callback`,
    notifyUrl: process.env.DAOU_NOTIFY_URL || `${baseUrl}/api/pg-demo/pay/notify`,
    mode,
    apiBaseUrl: mode === 'production'
      ? 'https://api.daoudata.co.kr/v1'
      : 'https://sandbox-api.daoudata.co.kr/v1',
  };
}

/**
 * 결제 요청 빌드 (향후 실제 PG 연동 시 사용)
 */
export function buildPaymentRequest(params: {
  orderId: string;
  amount: number;
  productName: string;
  buyerName: string;
  buyerTel?: string;
  payMethod?: string;
}) {
  const config = getDaouConfig();
  return {
    mid: config.mid,
    order_id: params.orderId,
    amount: params.amount,
    product_name: params.productName,
    buyer_name: params.buyerName,
    buyer_tel: params.buyerTel || '',
    pay_method: params.payMethod || 'card',
    return_url: config.returnUrl,
    notify_url: config.notifyUrl,
    van_code: config.vanCode,
  };
}
