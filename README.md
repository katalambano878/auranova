# AuraNova

Single-vendor store for general merchandise, priced in Ghana cedis and operated in Africa/Accra.

## Local setup

1. Point `DATABASE_URL` at Postgres. The current local setup uses the Supabase project `vseynqagxujwbzfseeml` through the session pooler (`aws-0-eu-west-2.pooler.supabase.com:5432`). Also set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, the Supabase keys, `BETTER_AUTH_SECRET`, `CRON_SECRET`, `APP_URL`, and the first admin email and password.
3. Install and prepare the database:

```bash
npm ci
npx prisma migrate deploy
npx prisma db seed
npx tsx scripts/create-admin.ts
npm run dev
```

The first-admin command refuses to run once any staff account exists. Sign in at `/account/login` and open `/admin`.

Seeded products, the coupon codes, and order `AN-DEMO-0001` are demonstration data. Sample reviews are labelled and are not verified purchases.

## Money and checkout

Prices are integer pesewas. The browser does not set order totals. Pay on delivery leaves payment unpaid. Online methods appear only when the matching switch is on in admin and the server credentials exist. A redirect from a provider is verified on the server before an order is marked paid.

## Payments

| Provider | Required environment | Notes |
| --- | --- | --- |
| Moolre | `MOOLRE_API_USER`, `MOOLRE_API_PUBKEY`, `MOOLRE_ACCOUNT_NUMBER`, `MOOLRE_MERCHANT_EMAIL` | No documented refund call. Refunds stay pending until a super admin confirms them. |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` | Webhook header `verif-hash` must match the hash. |
| Paystack | `PAYSTACK_SECRET_KEY` | Webhook signature is HMAC SHA512 of the raw body. |
| Hubtel | `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_MERCHANT_ACCOUNT_NUMBER` | Optional `HUBTEL_CHECKOUT_URL` and `HUBTEL_STATUS_URL`. No refund call is implemented. |

These providers stay unverified until sandbox keys exist and a real initiate-and-verify cycle is run.

## Email, storage, and cron

Email sends through Resend only when `RESEND_API_KEY` and `EMAIL_FROM` are set. Otherwise the admin notification inbox records that email was not sent.

Uploads use `STORAGE_ROOT` (default `./storage`) or S3 when `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION` are set. Optional `S3_ENDPOINT` and `S3_PUBLIC_URL`.

Release expired stock holds and raise low-stock alerts with:

```bash
curl -X POST "$APP_URL/api/cron/reservations" -H "Authorization: Bearer $CRON_SECRET"
```

## Production notes

- Set `ADMIN_2FA_REQUIRED=true` so staff must enrol an authenticator before using admin.
- Tax defaults to zero. Enter a rate only after an accountant confirms it. The app does not invent a GRA levy stack.
- `GET /api/health` checks the database.
- The Dockerfile is ready for Coolify. Do not deploy until asked.

## Scripts

```bash
npm run typecheck
npm test
npm run lint
npm run build
```
