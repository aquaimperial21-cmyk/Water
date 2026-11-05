// Contact details and the legal operator, shared by the home page, Footer and
// the policy pages so the numbers and address only live in one place.

export const PHONE = '+919595190024';
export const PHONE_DISPLAY = '+91 95951 90024';
export const WHATSAPP = '+919595190024';
export const EMAIL = 'aquaimperial21@gmail.com';

export const whatsappLink = (text) =>
  `https://wa.me/${WHATSAPP.replace('+', '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const BUSINESS = {
  brand: 'Aqua Imperial',
  legalName: 'MAHESH ENTERPRISES',
  proprietor: 'Shamsundar Motilal Purbiya',
  udyam: 'UDYAM-MH-01-0314185',
  addressLines: [
    'Gujar Galli, Near Swami Samarth Temple,',
    'Behind Deshpande Hospital, Shani Chowk,',
    'Ahmednagar, Maharashtra 414001',
    'India',
  ],
  address:
    'Gujar Galli, Near Swami Samarth Temple, Behind Deshpande Hospital, Shani Chowk, Ahmednagar, Maharashtra 414001, India',
};

export const POLICY_UPDATED = '5 November 2026';
