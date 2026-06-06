import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // 매직링크는 교차 기기 클릭(폰 요청→데스크톱 메일)이 흔해 implicit 유지.
    // PKCE는 요청 브라우저의 verifier에 묶여 메일 클릭과 상극.
    flowType: 'implicit',
  },
});
