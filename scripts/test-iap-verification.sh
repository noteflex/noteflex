#!/usr/bin/env bash
set -euo pipefail

# Usage:
# SUPABASE_FN_URL="http://127.0.0.1:54321/functions/v1/verify-iap-receipt" \
# SUPABASE_ANON_KEY="..." \
# SUPABASE_JWT="..." \
# REVENUECAT_WEBHOOK_AUTH="..." \
# TEST_USER_ID="00000000-0000-0000-0000-000000000000" \
# ./scripts/test-iap-verification.sh

FN_URL="${SUPABASE_FN_URL:-http://127.0.0.1:54321/functions/v1/verify-iap-receipt}"
ANON_KEY="${SUPABASE_ANON_KEY:-}"
JWT="${SUPABASE_JWT:-}"
RC_AUTH="${REVENUECAT_WEBHOOK_AUTH:-}"
TEST_USER_ID="${TEST_USER_ID:-00000000-0000-0000-0000-000000000000}"

if [[ -z "$ANON_KEY" ]]; then
  echo "Missing SUPABASE_ANON_KEY"
  exit 1
fi

if [[ -z "$JWT" ]]; then
  echo "Missing SUPABASE_JWT"
  exit 1
fi

if [[ -z "$RC_AUTH" ]]; then
  echo "Missing REVENUECAT_WEBHOOK_AUTH"
  exit 1
fi

echo ""
echo "=== Scenario 1: iOS direct receipt ==="
curl -sS -X POST "$FN_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "packageId":"scan_pack_10",
    "platform":"ios",
    "transactionId":"ios_tx_test_001",
    "receipt":"TEST_VALID_IOS_TOKEN"
  }'

echo ""
echo "=== Scenario 2: Android purchaseToken ==="
curl -sS -X POST "$FN_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "packageId":"scan_pack_30",
    "platform":"android",
    "transactionId":"android_tx_test_001",
    "receipt":"TEST_VALID_ANDROID_TOKEN"
  }'

echo ""
echo "=== Scenario 3: RevenueCat webhook payload ==="
curl -sS -X POST "$FN_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RC_AUTH" \
  -d '{
    "event":{
      "type":"NON_SUBSCRIPTION_PURCHASE",
      "app_user_id":"'"$TEST_USER_ID"'",
      "product_id":"com.domisol.scan.pack10",
      "store":"APP_STORE",
      "store_transaction_id":"rc_tx_test_001",
      "currency":"USD",
      "price_in_purchased_currency":4.99,
      "test_receipt":"TEST_VALID_RC_TOKEN"
    }
  }'

echo ""
echo "Done."
