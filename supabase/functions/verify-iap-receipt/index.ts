import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PackageId = "scan_pack_10" | "scan_pack_30";
type Platform = "ios" | "android";

const PACKAGE_CREDITS: Record<PackageId, number> = {
  scan_pack_10: 10,
  scan_pack_30: 30,
};

const PRODUCT_IDS: Record<PackageId, { ios: string; android: string }> = {
  scan_pack_10: { ios: "com.domisol.scan.pack10", android: "com.domisol.scan.pack10" },
  scan_pack_30: { ios: "com.domisol.scan.pack30", android: "com.domisol.scan.pack30" },
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type VerifyInput = {
  packageId: PackageId;
  platform: Platform;
  transactionId: string;
  receipt: string;
};

type TestReceiptMode = "valid" | "refund" | "invalid";

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `Missing required environment variable: ${name}`);
  return value;
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function isTestModeEnabled(): boolean {
  return parseBooleanEnv(Deno.env.get("IAP_TEST_MODE"));
}

function parseTestReceiptMode(receipt: string): TestReceiptMode | null {
  if (receipt.startsWith("TEST_VALID")) return "valid";
  if (receipt.startsWith("TEST_REFUND")) return "refund";
  if (receipt.startsWith("TEST_INVALID")) return "invalid";
  return null;
}

function toBase64Url(input: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < input.length; i++) binary += String.fromCharCode(input[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parsePemPrivateKey(pem: string): Uint8Array {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new HttpError(504, `Network timeout while calling: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function resolvePackageIdFromProduct(productId: string): PackageId | null {
  if (productId === PRODUCT_IDS.scan_pack_10.ios || productId === PRODUCT_IDS.scan_pack_10.android) {
    return "scan_pack_10";
  }
  if (productId === PRODUCT_IDS.scan_pack_30.ios || productId === PRODUCT_IDS.scan_pack_30.android) {
    return "scan_pack_30";
  }
  return null;
}

async function verifyAppleReceipt(input: VerifyInput): Promise<void> {
  const sharedSecret = getRequiredEnv("APPLE_SHARED_SECRET");
  const expectedBundleId = getRequiredEnv("APPLE_BUNDLE_ID");
  const expectedProductId = PRODUCT_IDS[input.packageId].ios;

  const requestBody = {
    "receipt-data": input.receipt,
    password: sharedSecret,
    "exclude-old-transactions": true,
  };

  const verifyAt = async (url: string) => {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      12000,
    );
    if (!res.ok) throw new HttpError(502, `Apple verification HTTP ${res.status}`);
    return await res.json();
  };

  let payload = await verifyAt("https://buy.itunes.apple.com/verifyReceipt");
  if (payload?.status === 21007) {
    payload = await verifyAt("https://sandbox.itunes.apple.com/verifyReceipt");
  }

  if (payload?.status !== 0) {
    throw new HttpError(422, `Apple receipt invalid, status=${payload?.status ?? "unknown"}`);
  }
  if (payload?.receipt?.bundle_id !== expectedBundleId) {
    throw new HttpError(422, "Apple bundle_id mismatch");
  }

  const allItems = [
    ...(Array.isArray(payload?.latest_receipt_info) ? payload.latest_receipt_info : []),
    ...(Array.isArray(payload?.receipt?.in_app) ? payload.receipt.in_app : []),
  ];
  const matched = allItems.find((item: any) =>
    String(item?.transaction_id ?? "") === input.transactionId ||
    String(item?.original_transaction_id ?? "") === input.transactionId,
  );
  if (!matched) throw new HttpError(422, "Apple transaction_id not found");
  if (String(matched?.product_id ?? "") !== expectedProductId) {
    throw new HttpError(422, "Apple product_id mismatch");
  }
  if (matched?.cancellation_date || matched?.cancellation_date_ms) {
    throw new HttpError(422, "Apple purchase was cancelled/refunded");
  }
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  let creds: { client_email: string; private_key: string; token_uri?: string };
  try {
    creds = JSON.parse(serviceAccountJson);
  } catch {
    throw new HttpError(500, "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!creds.client_email || !creds.private_key) {
    throw new HttpError(500, "GOOGLE_SERVICE_ACCOUNT_JSON missing client_email/private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: creds.client_email,
        scope: "https://www.googleapis.com/auth/androidpublisher",
        aud: creds.token_uri ?? "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsignedJwt = `${header}.${claim}`;

  const keyData = parsePemPrivateKey(creds.private_key);
  const keyBuffer = keyData.buffer.slice(
    keyData.byteOffset,
    keyData.byteOffset + keyData.byteLength,
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  const jwt = `${unsignedJwt}.${toBase64Url(new Uint8Array(signatureBuffer))}`;

  const tokenRes = await fetchWithTimeout(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    },
    10000,
  );
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new HttpError(502, `Google OAuth token failure: ${text}`);
  }
  const tokenJson = await tokenRes.json();
  if (!tokenJson?.access_token) throw new HttpError(502, "Google OAuth token missing access_token");
  return tokenJson.access_token as string;
}

async function verifyGooglePurchase(input: VerifyInput): Promise<void> {
  const serviceAccountJson = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  const packageName = getRequiredEnv("GOOGLE_PACKAGE_NAME");
  const expectedProductId = PRODUCT_IDS[input.packageId].android;
  const accessToken = await getGoogleAccessToken(serviceAccountJson);

  const purchaseUrl =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName,
    )}/purchases/products/${encodeURIComponent(expectedProductId)}/tokens/${encodeURIComponent(
      input.receipt,
    )}`;

  const purchaseRes = await fetchWithTimeout(
    purchaseUrl,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    12000,
  );

  if (purchaseRes.status === 404 || purchaseRes.status === 410) {
    throw new HttpError(422, "Google purchase token not found or revoked");
  }
  if (!purchaseRes.ok) {
    const text = await purchaseRes.text();
    throw new HttpError(502, `Google purchase verify failed: ${text}`);
  }

  const purchase = await purchaseRes.json();
  if (Number(purchase?.purchaseState) !== 0) {
    throw new HttpError(422, `Google purchase is not completed. state=${purchase?.purchaseState}`);
  }

  if (purchase?.orderId && typeof purchase.orderId === "string") {
    const voidedRes = await fetchWithTimeout(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
        packageName,
      )}/purchases/voidedpurchases?maxResults=200`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      10000,
    );
    if (voidedRes.ok) {
      const voidedJson = await voidedRes.json();
      const list = Array.isArray(voidedJson?.voidedPurchases) ? voidedJson.voidedPurchases : [];
      const isVoided = list.some((p: any) => String(p?.orderId ?? "") === String(purchase.orderId));
      if (isVoided) throw new HttpError(422, "Google purchase has been voided/refunded");
    }
  }
}

async function verifyStoreReceipt(input: VerifyInput): Promise<void> {
  const testMode = parseTestReceiptMode(input.receipt);
  if (isTestModeEnabled() && testMode) {
    if (testMode === "valid") return;
    if (testMode === "refund") throw new HttpError(422, "Test mode: purchase marked as refunded/revoked");
    throw new HttpError(422, "Test mode: invalid receipt");
  }

  if (input.platform === "ios") {
    await verifyAppleReceipt(input);
    return;
  }
  await verifyGooglePurchase(input);
}

async function verifyRevenueCatEvent(body: any): Promise<{
  userId: string;
  packageId: PackageId;
  transactionId: string;
  amountCents: number | null;
  currency: string | null;
  platform: Platform;
}> {
  const event = body?.event ?? body;
  const webhookAuth = getRequiredEnv("REVENUECAT_WEBHOOK_AUTH");
  const authHeader = body?.__authorizationHeader as string | undefined;
  if (authHeader !== `Bearer ${webhookAuth}`) {
    throw new HttpError(401, "Invalid RevenueCat webhook authorization");
  }

  const eventType = String(event?.type ?? "");
  if (!eventType || /refund|cancellation|expiration/i.test(eventType)) {
    throw new HttpError(422, `RevenueCat event not chargeable: ${eventType || "unknown"}`);
  }

  const userId = String(event?.app_user_id ?? "").trim();
  const productId = String(event?.product_id ?? "").trim();
  const transactionId = String(
    event?.store_transaction_id ?? event?.transaction_id ?? event?.original_transaction_id ?? "",
  ).trim();
  const packageId = resolvePackageIdFromProduct(productId);
  if (!userId || !productId || !transactionId || !packageId) {
    throw new HttpError(422, "RevenueCat payload missing app_user_id/product_id/transaction_id");
  }

  const testReceipt = String(event?.test_receipt ?? "");
  const testMode = parseTestReceiptMode(testReceipt);
  if (isTestModeEnabled() && testMode) {
    if (testMode === "refund") throw new HttpError(422, "Test mode: RevenueCat event marked refunded");
    if (testMode === "invalid") throw new HttpError(422, "Test mode: RevenueCat event invalid");
    const store = String(event?.store ?? "").toUpperCase();
    const platform: Platform = store.includes("PLAY") ? "android" : "ios";
    return {
      userId,
      packageId,
      transactionId,
      amountCents:
        typeof event?.price_in_purchased_currency === "number"
          ? Math.round(Number(event.price_in_purchased_currency) * 100)
          : null,
      currency: typeof event?.currency === "string" ? event.currency : null,
      platform,
    };
  }

  const rcApiKey = getRequiredEnv("REVENUECAT_API_KEY");
  const subscriberRes = await fetchWithTimeout(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${rcApiKey}`,
        "Content-Type": "application/json",
      },
    },
    10000,
  );
  if (!subscriberRes.ok) {
    const text = await subscriberRes.text();
    throw new HttpError(502, `RevenueCat subscriber verify failed: ${text}`);
  }

  const subscriberJson = await subscriberRes.json();
  const purchases = subscriberJson?.subscriber?.non_subscriptions?.[productId];
  const list = Array.isArray(purchases) ? purchases : [];
  const matched = list.find((p: any) =>
    String(p?.store_transaction_id ?? p?.transaction_id ?? "") === transactionId,
  );
  if (!matched) throw new HttpError(422, "RevenueCat transaction not found in subscriber history");
  if (matched?.is_refund === true || matched?.unsubscribe_detected_at) {
    throw new HttpError(422, "RevenueCat transaction was refunded/revoked");
  }

  const store = String(event?.store ?? "").toUpperCase();
  const platform: Platform = store.includes("PLAY") ? "android" : "ios";
  return {
    userId,
    packageId,
    transactionId,
    amountCents:
      typeof event?.price_in_purchased_currency === "number"
        ? Math.round(Number(event.price_in_purchased_currency) * 100)
        : null,
    currency: typeof event?.currency === "string" ? event.currency : null,
    platform,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new HttpError(500, "Missing Supabase environment variables");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const authHeader = req.headers.get("Authorization");
    const revenuecatWebhookAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");

    // RevenueCat sometimes sends a static bearer token (not JWT).
    // Explicitly bypass JWT-based auth path when webhook token matches.
    if (
      revenuecatWebhookAuth &&
      authHeader === `Bearer ${revenuecatWebhookAuth}` &&
      !body?.event &&
      !body?.app_user_id
    ) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "revenuecat_webhook_auth_bypass" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let userId = "";
    let packageId: PackageId;
    let transactionId = "";
    let amountCents: number | null = null;
    let currency: string | null = null;
    let platform: Platform = "ios";

    const isRevenueCatEvent = !!body?.event || !!body?.app_user_id;
    if (isRevenueCatEvent) {
      const rcResult = await verifyRevenueCatEvent({
        ...body,
        __authorizationHeader: authHeader ?? undefined,
      });
      userId = rcResult.userId;
      packageId = rcResult.packageId;
      transactionId = rcResult.transactionId;
      amountCents = rcResult.amountCents;
      currency = rcResult.currency;
      platform = rcResult.platform;
    } else {
      if (!authHeader) throw new HttpError(401, "Unauthorized");

      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user) throw new HttpError(401, "Invalid auth session");
      userId = user.id;

      packageId = body?.packageId as PackageId;
      platform = body?.platform as Platform;
      transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
      const receipt = typeof body?.receipt === "string" ? body.receipt : "";
      currency = typeof body?.currency === "string" ? body.currency : null;
      amountCents =
        typeof body?.amountCents === "number" && Number.isFinite(body.amountCents)
          ? Math.round(body.amountCents)
          : null;

      if (!packageId || !PACKAGE_CREDITS[packageId]) throw new HttpError(400, "Invalid packageId");
      if (platform !== "ios" && platform !== "android") throw new HttpError(400, "Invalid platform");
      if (!transactionId) throw new HttpError(400, "transactionId is required");
      if (!receipt) throw new HttpError(400, "receipt/purchaseToken is required");

      await verifyStoreReceipt({ packageId, platform, transactionId, receipt });
    }

    const eventId = `iap:${platform}:${transactionId}`;
    const credits = PACKAGE_CREDITS[packageId];
    const { data: applyRows, error: applyError } = await admin.rpc("apply_payment_topup", {
      p_event_id: eventId,
      p_checkout_session_id: transactionId,
      p_user_id: userId,
      p_package_id: packageId,
      p_credits_added: credits,
      p_amount_cents: amountCents,
      p_currency: currency,
    });
    if (applyError) throw new HttpError(500, `Failed to apply IAP top-up: ${applyError.message}`);

    const row = Array.isArray(applyRows) ? applyRows[0] : null;
    if (!row) throw new HttpError(500, "apply_payment_topup returned no rows");

    return new Response(
      JSON.stringify({
        success: true,
        duplicate: !row.applied,
        creditsAdded: row.applied ? credits : 0,
        remainingScanQuota: row.remaining_quota ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    if (e instanceof HttpError) {
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
