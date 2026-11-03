// react-native-razorpay 3.0.0 ships src/types.ts but no "types" entry in
// package.json, so TypeScript can't find it. Only what we use is declared.
declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    key: string;
    amount: number | string; // paise
    order_id: string;
    currency?: string;
    name?: string;
    description?: string;
    prefill?: { name?: string; email?: string; contact?: string };
    theme?: { color?: string };
    // Never pass functions here: the native SDK serialises the whole object.
    [key: string]: unknown;
  }
  export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }
  export interface RazorpayErrorInner {
    code?: string;
    description?: string;
    reason?: string;
  }
  export interface RazorpayNativeError {
    code: number;
    description: string; // Android: usually a JSON string '{"error":{...}}'
    error?: RazorpayErrorInner; // Android
    details?: { error?: RazorpayErrorInner }; // iOS
  }
  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccess>;
  };
  export default RazorpayCheckout;
}
