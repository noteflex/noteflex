/**
 * Paddle 심사관 전용 로그인 API.
 *
 * 흐름:
 *   1. POST { email, code }
 *   2. IP rate limit (분당 5회)
 *   3. 이메일 화이트리스트 (forpaddle@noteflex.app)
 *   4. 환경변수 REVIEWER_ACCESS_CODE 비교 (constant-time)
 *   5. Supabase Admin API로 magic link 생성 → token_hash 추출
 *   6. Anon client로 verifyOtp → 세션 토큰 반환
 *
 * 비활성화 절차:
 *   - Vercel 환경변수 REVIEWER_ACCESS_CODE 제거 → 모든 요청 401
 *   - 또는 이 파일 자체 삭제
 *
 * 필요한 환경변수 (Vercel Dashboard):
 *   - SUPABASE_URL (또는 VITE_SUPABASE_URL)
 *   - SUPABASE_ANON_KEY (또는 VITE_SUPABASE_ANON_KEY)
 *   - SUPABASE_SERVICE_ROLE_KEY ⚠️ 절대 클라이언트 노출 X
 *   - REVIEWER_ACCESS_CODE (강력한 랜덤 문자열, 예: 'a3f7-b2e9-c8d1-x5y2')
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ─── 이메일 화이트리스트 (하드코딩) ──────────────────────────
// 실수로 env에서 다른 이메일 덮어쓰는 사고 방지.
const REVIEWER_EMAIL = 'forpaddle@noteflex.app';

// ─── Rate limit (in-memory, warm instance 한정) ──────────────
// 콜드 스타트 시 초기화되지만 5/min이라 충분히 보수적.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimits = new Map<string, number[]>();

function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0];
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimits.get(ip) || [];
  const recent = requests.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimits.set(ip, recent);
  return true;
}

// 타이밍 공격 방지용 비교 (길이 다른 경우도 일정 시간 소요).
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    // 길이 다르면 false지만 타이밍 노출 방지용 dummy 비교 박음.
    const dummy = Buffer.from('x'.repeat(bufA.length || 32), 'utf-8');
    let _r = 0;
    for (let i = 0; i < dummy.length; i++) _r |= bufA[i] ^ dummy[i];
    return false;
  }
  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // ─── 1. 메서드 ─────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ─── 2. Rate limit ────────────────────────────────────────
  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  // ─── 3. 입력 검증 ─────────────────────────────────────────
  const body = (req.body || {}) as { email?: unknown; code?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body.code === 'string' ? body.code : '';

  if (!email || !code) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // ─── 4. 이메일 화이트리스트 ────────────────────────────────
  if (email !== REVIEWER_EMAIL) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // ─── 5. 환경변수 + 코드 검증 ──────────────────────────────
  const expectedCode = process.env.REVIEWER_ACCESS_CODE;
  if (!expectedCode) {
    // 환경변수 미설정 = 기능 비활성화.
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (!timingSafeEqual(code, expectedCode)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // ─── 6. Supabase 환경변수 확인 ────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    // 운영 misconfiguration. 외부에 구체 사유 노출 X.
    res.status(500).json({ error: 'Server error' });
    return;
  }

  // ─── 7. Admin API로 magic link 생성 → token_hash 추출 ────
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: REVIEWER_EMAIL,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      res.status(500).json({ error: 'Server error' });
      return;
    }

    // ─── 8. Anon client로 verifyOtp → 세션 발급 ─────────────
    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: sessionData, error: verifyError } =
      await supabaseAnon.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });

    if (verifyError || !sessionData?.session) {
      res.status(500).json({ error: 'Server error' });
      return;
    }

    // ─── 9. 토큰 반환 ───────────────────────────────────────
    res.status(200).json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    });
  } catch (_err) {
    // 내부 에러 노출 금지.
    res.status(500).json({ error: 'Server error' });
  }
}
