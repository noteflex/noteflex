# IAP Verification Local Test Guide

This guide tests `supabase/functions/verify-iap-receipt/index.ts` for 3 entry points:

- iOS direct receipt upload
- Android purchaseToken verification
- RevenueCat webhook event

## 1) Enable dry-run mode for local tests

Set these env values (for `supabase functions serve`):

- `IAP_TEST_MODE=true`
- `REVENUECAT_WEBHOOK_AUTH=<your-local-secret>`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

With `IAP_TEST_MODE=true`, the function accepts synthetic receipts:

- `TEST_VALID_*` => pass verification
- `TEST_REFUND_*` => treated as refunded/revoked
- `TEST_INVALID_*` => invalid receipt

## 2) Run function locally

```bash
supabase start
supabase functions serve verify-iap-receipt --env-file .env
```

## 3) Run test script

```bash
chmod +x ./scripts/test-iap-verification.sh

SUPABASE_FN_URL="http://127.0.0.1:54321/functions/v1/verify-iap-receipt" \
SUPABASE_ANON_KEY="<anon-key>" \
SUPABASE_JWT="<user-access-token>" \
REVENUECAT_WEBHOOK_AUTH="<same-as-env>" \
TEST_USER_ID="<supabase-user-uuid>" \
./scripts/test-iap-verification.sh
```

## 4) Validate DB updates

Check that `profiles.scan_quota` increased and event logs are created once (idempotent):

```sql
select id, scan_quota from public.profiles where id = '<user-uuid>';

select event_id, package_id, credits_added, created_at
from public.payment_events
where user_id = '<user-uuid>'
order by created_at desc
limit 20;
```

## 5) Manual curl examples

### Scenario 1: iOS direct

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/verify-iap-receipt" \
  -H "Content-Type: application/json" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <user-jwt>" \
  -d '{
    "packageId":"scan_pack_10",
    "platform":"ios",
    "transactionId":"ios_tx_test_002",
    "receipt":"TEST_VALID_IOS_TOKEN"
  }'
```

### Scenario 2: Android direct

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/verify-iap-receipt" \
  -H "Content-Type: application/json" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <user-jwt>" \
  -d '{
    "packageId":"scan_pack_30",
    "platform":"android",
    "transactionId":"android_tx_test_002",
    "receipt":"TEST_VALID_ANDROID_TOKEN"
  }'
```

### Scenario 3: RevenueCat webhook

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/verify-iap-receipt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>" \
  -d '{
    "event":{
      "type":"NON_SUBSCRIPTION_PURCHASE",
      "app_user_id":"<user-uuid>",
      "product_id":"com.domisol.scan.pack10",
      "store":"APP_STORE",
      "store_transaction_id":"rc_tx_test_002",
      "test_receipt":"TEST_VALID_RC_TOKEN"
    }
  }'
```

## 6) Real production mode reminder

Disable `IAP_TEST_MODE` in production.  
In production, use real App Store / Google Play / RevenueCat payloads and credentials only.
