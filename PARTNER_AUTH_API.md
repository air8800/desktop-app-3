# Partner Auth API (Vercel)

All partner signup emails **must** send from `hello@printget.in` only.

Base URL: `https://printget.in` (or `VITE_PRINTGET_API_URL`)

## POST /api/partner/auth/request-code

Request a 6-digit verification code.

**Body**
```json
{ "email": "owner@example.com" }
```

**Response**
```json
{ "success": true, "message": "Code sent" }
```

**Email:** From `hello@printget.in`, subject e.g. "Your PrintGet verification code", body includes 6-digit OTP.

## POST /api/partner/auth/verify-code

Verify OTP and return Supabase session.

**Body**
```json
{ "email": "owner@example.com", "code": "123456" }
```

**Response**
```json
{
  "success": true,
  "access_token": "...",
  "refresh_token": "...",
  "user": { "id": "uuid", "email": "owner@example.com" },
  "needsOnboarding": true
}
```

## POST /api/partner/auth/complete-signup

Called after desktop onboarding wizard. Shop may already exist in Supabase; this route sends welcome email and optionally finalizes server-side records.

**Headers:** `Authorization: Bearer <access_token>`

**Body**
```json
{
  "name": "Owner Name",
  "phone": "+919876543210",
  "shopName": "City Xerox",
  "businessType": "xerox_shop",
  "address": "Full address",
  "googleMapsLink": "https://maps.google.com/...",
  "latitude": 18.5204,
  "longitude": 73.8567
}
```

**Response**
```json
{ "success": true, "shopId": "uuid" }
```

**Email:** From `hello@printget.in`, subject e.g. "Welcome to PrintGet Shop Network".

## Google OAuth

Use Supabase Google provider with redirect:
- Dev: `http://localhost:5173/auth/callback`
- Prod: `https://printget.in/auth/desktop-callback`

Desktop opens OAuth URL in system browser; callback page completes session.

## Vercel implementation notes

Reuse existing Gmail SMTP env vars; set `from: 'hello@printget.in'` for both OTP and welcome templates.

Do **not** use `noreply@`, `orders@`, or `info@` for partner auth (deliverability).
