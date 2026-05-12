import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSolfegeSystem } from "@/hooks/useSolfegeSystem";
import { useNicknameAvailability } from "@/hooks/useNicknameAvailability";
import { nicknameErrorMessage } from "@/lib/nicknameValidation";
import { COUNTRY_OPTIONS, detectCountryCodeSmart } from "@/lib/profile";
import type { SolfegeSystem } from "@/lib/solfege";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const LOCALE_OPTIONS = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
] as const;

const SOLFEGE_OPTIONS: { value: SolfegeSystem; label: string; example: string }[] = [
  { value: "ko", label: "한국어 계이름", example: "도-레-미-파-솔-라-시" },
  { value: "en", label: "영어 음이름", example: "C-D-E-F-G-A-B" },
  { value: "latin", label: "라틴 계이름", example: "Do-Re-Mi-Fa-Sol-La-Si" },
];

const DELETE_REASONS = [
  "사용 빈도 낮음",
  "서비스 불만",
  "개인정보 보호",
  "기타",
] as const;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { system, setSystem } = useSolfegeSystem();

  // ── 프로필 폼 (닉네임 + 언어 + 생년월일 + 국적 + 마케팅) ──
  const [formData, setFormData] = useState({
    nickname:         profile?.nickname ?? "",
    locale:           profile?.locale ?? "ko",
    birth_year:       profile?.birth_year?.toString() ?? "",
    birth_month:      profile?.birth_month?.toString() ?? "",
    birth_day:        profile?.birth_day?.toString() ?? "",
    country_code:     profile?.country_code ?? detectCountryCodeSmart(),
    marketing_agreed: !!profile?.marketing_agreed_at,
  });
  const [saving, setSaving] = useState(false);

  const profileSynced = useRef(!!profile);
  useEffect(() => {
    if (profile && !profileSynced.current) {
      setFormData({
        nickname:         profile.nickname ?? "",
        locale:           profile.locale ?? "ko",
        birth_year:       profile.birth_year?.toString() ?? "",
        birth_month:      profile.birth_month?.toString() ?? "",
        birth_day:        profile.birth_day?.toString() ?? "",
        country_code:     profile.country_code ?? detectCountryCodeSmart(),
        marketing_agreed: !!profile.marketing_agreed_at,
      });
      profileSynced.current = true;
    }
  }, [profile]);

  const isDirty = useMemo(
    () =>
      formData.nickname     !== (profile?.nickname ?? "") ||
      formData.locale       !== (profile?.locale ?? "ko") ||
      formData.birth_year   !== (profile?.birth_year?.toString() ?? "") ||
      formData.birth_month  !== (profile?.birth_month?.toString() ?? "") ||
      formData.birth_day    !== (profile?.birth_day?.toString() ?? "") ||
      formData.country_code !== (profile?.country_code ?? detectCountryCodeSmart()) ||
      formData.marketing_agreed !== !!profile?.marketing_agreed_at,
    [formData, profile]
  );

  const nicknameCheckInput =
    formData.nickname !== (profile?.nickname ?? "") ? formData.nickname : "";
  const nicknameStatus = useNicknameAvailability(nicknameCheckInput);

  const canSave =
    isDirty &&
    (formData.nickname === (profile?.nickname ?? "") ||
      nicknameStatus.state === "available");

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── 탈퇴 ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason]       = useState("");
  const [deleteEmailSent, setDeleteEmailSent] = useState(false);
  const [deleteSending, setDeleteSending]     = useState(false);

  if (!user) {
    navigate("/");
    return null;
  }

  // ── Handlers ──

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        nickname:     formData.nickname,
        locale:       formData.locale,
        country_code: formData.country_code,
      };
      if (formData.birth_year)  updates.birth_year  = parseInt(formData.birth_year, 10);
      if (formData.birth_month) updates.birth_month = parseInt(formData.birth_month, 10);
      if (formData.birth_day)   updates.birth_day   = parseInt(formData.birth_day, 10);
      if (formData.marketing_agreed && !profile?.marketing_agreed_at) {
        updates.marketing_agreed_at = new Date().toISOString();
      } else if (!formData.marketing_agreed) {
        updates.marketing_agreed_at = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        if ((error as any).code === "23505") {
          toast({
            title: "이미 사용 중인 닉네임이에요",
            description: "다른 닉네임을 입력해주세요.",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "저장 실패", description: error.message, variant: "destructive" });
        return;
      }

      await refreshProfile();
      toast({ title: "저장되었습니다" });
    } catch {
      toast({ title: "저장 실패", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteReason("");
    setDeleteEmailSent(false);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteReason("");
    setDeleteEmailSent(false);
  };

  const handleRequestDeletion = async () => {
    setDeleteSending(true);
    try {
      const reasonParam = deleteReason ? `&reason=${encodeURIComponent(deleteReason)}` : "";
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email!,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?action=confirm_deletion${reasonParam}`,
        },
      });
      if (error) throw error;
      setDeleteEmailSent(true);
    } catch (err: any) {
      toast({ title: "전송 실패", description: err.message, variant: "destructive" });
    } finally {
      setDeleteSending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const premiumUntil = profile?.premium_until
    ? new Date(profile.premium_until).toLocaleDateString("ko-KR")
    : null;

  const joinedAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("ko-KR")
    : null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header
        right={
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 홈으로
          </Link>
        }
      />
      <div className="flex-1 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-4">

        <h1 className="text-xl font-bold text-foreground">프로필 설정</h1>

        {/* ━━━━━━━━━━━━━━━━ 계정 설정 ━━━━━━━━━━━━━━━━ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">계정 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* 닉네임 */}
            <div className="space-y-1.5">
              <Label>닉네임</Label>
              <Input
                value={formData.nickname}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    nickname: e.target.value.toLowerCase(),
                  }))
                }
                placeholder="3~20자, 영문 소문자/숫자/밑줄"
                maxLength={20}
                data-testid="nickname-input"
              />
              {nicknameStatus.state === "checking" && (
                <p className="text-xs text-muted-foreground">확인 중...</p>
              )}
              {nicknameStatus.state === "available" && (
                <p className="text-xs text-green-600">✅ 사용 가능한 닉네임입니다</p>
              )}
              {nicknameStatus.state === "invalid_format" && (
                <p className="text-xs text-destructive">{(nicknameStatus as any).reason}</p>
              )}
              {nicknameStatus.state === "taken" && (
                <div className="space-y-1">
                  <p className="text-xs text-destructive" data-testid="nickname-taken-error">
                    이미 사용 중인 닉네임입니다
                  </p>
                  {(nicknameStatus as any).suggestions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-muted-foreground">추천:</span>
                      {(nicknameStatus as any).suggestions.map((s: string) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, nickname: s }))}
                          className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 생년월일 */}
            <div className="space-y-1.5">
              <Label>생년월일 (선택)</Label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={formData.birth_year}
                  onChange={e => setFormData(prev => ({ ...prev, birth_year: e.target.value }))}
                  placeholder="YYYY"
                  min="1900"
                  max={new Date().getFullYear()}
                  data-testid="birth-year-input"
                  className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center"
                />
                <input
                  type="number"
                  value={formData.birth_month}
                  onChange={e => setFormData(prev => ({ ...prev, birth_month: e.target.value }))}
                  placeholder="MM"
                  min="1"
                  max="12"
                  data-testid="birth-month-input"
                  className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center"
                />
                <input
                  type="number"
                  value={formData.birth_day}
                  onChange={e => setFormData(prev => ({ ...prev, birth_day: e.target.value }))}
                  placeholder="DD"
                  min="1"
                  max="31"
                  data-testid="birth-day-input"
                  className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center"
                />
              </div>
            </div>

            {/* 국적 */}
            <div className="space-y-1.5">
              <Label>국적</Label>
              <Select
                value={formData.country_code}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, country_code: value }))}
              >
                <SelectTrigger data-testid="country-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 표시 언어 */}
            <div className="space-y-1.5">
              <Label>표시 언어</Label>
              <Select
                value={formData.locale}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, locale: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 마케팅 동의 */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={formData.marketing_agreed}
                  onChange={e => setFormData(prev => ({ ...prev, marketing_agreed: e.target.checked }))}
                  className="w-4 h-4 accent-primary cursor-pointer"
                  data-testid="marketing-toggle"
                />
                <span className="text-foreground">마케팅 정보 수신 동의</span>
              </label>
            </div>

            {isDirty && (
              <p className="text-sm text-amber-600">
                변경 사항이 있습니다. 저장 버튼을 눌러주세요.
              </p>
            )}
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full"
              data-testid="save-profile-button"
            >
              {saving ? "저장 중..." : "저장"}
            </Button>

          </CardContent>
        </Card>

        {/* ━━━━━━━━━━━━━━━━ 계이름 체계 ━━━━━━━━━━━━━━━━ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">계이름 표기 방식</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup
              value={system}
              onValueChange={(val) => setSystem(val as SolfegeSystem)}
              className="space-y-2"
            >
              {SOLFEGE_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-3">
                  <RadioGroupItem value={opt.value} id={`solfege-${opt.value}`} />
                  <Label htmlFor={`solfege-${opt.value}`} className="cursor-pointer">
                    <span className="font-medium">{opt.label}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{opt.example}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">이 설정은 즉시 적용됩니다.</p>
          </CardContent>
        </Card>

        {/* ━━━━━━━━━━━━━━━━ 계정 정보 ━━━━━━━━━━━━━━━━ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">계정 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">이메일</span>
              <span className="font-medium">{user.email}</span>
            </div>
            {joinedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">가입일</span>
                <span>{joinedAt}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">구독 상태</span>
              <span>
                {profile?.is_premium ? (
                  <span className="text-amber-600 font-semibold">
                    ✨ Premium{premiumUntil ? ` (~${premiumUntil})` : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">무료 플랜</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ━━━━━━━━━━━━━━━━ 로그아웃 ━━━━━━━━━━━━━━━━ */}
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          로그아웃
        </Button>

        {/* ━━━━━━━━━━━━━━━━ 회원 탈퇴 (Danger Zone) ━━━━━━━━━━━━━━━━ */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">회원 탈퇴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              탈퇴 후 30일 내 복구가 가능합니다. 이후에는 모든 데이터가 삭제됩니다.
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={openDeleteModal}
              data-testid="open-delete-modal-button"
            >
              회원 탈퇴
            </Button>
          </CardContent>
        </Card>

      </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━ 탈퇴 확인 모달 ━━━━━━━━━━━━━━━━ */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-pop-in"
          data-testid="delete-modal"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex flex-col items-center gap-2 pt-6 pb-4 px-6">
              <span className="text-4xl">{deleteEmailSent ? "✉️" : "⚠️"}</span>
              <h2 className="text-xl font-bold text-foreground">
                {deleteEmailSent ? "탈퇴 확인 메일을 보냈습니다" : "정말 탈퇴하시겠어요?"}
              </h2>
              {!deleteEmailSent && (
                <p className="text-xs text-muted-foreground text-center">
                  탈퇴 후 30일 내 복구 가능합니다.
                </p>
              )}
            </div>

            <div className="px-6 pb-6 space-y-3">
              {!deleteEmailSent ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                      탈퇴 사유 (선택)
                    </label>
                    <select
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      data-testid="delete-reason-select"
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">선택 안 함</option>
                      {DELETE_REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleRequestDeletion}
                    disabled={deleteSending}
                    className="w-full"
                    data-testid="send-delete-otp-button"
                  >
                    {deleteSending ? "처리 중..." : "탈퇴 확인 메일 보내기"}
                  </Button>
                </>
              ) : (
                <div className="space-y-3" data-testid="delete-email-sent-screen">
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    <span className="font-medium text-foreground">{user.email}</span>에 도착한 메일에서<br />
                    "탈퇴 확인" 링크를 클릭하면 탈퇴가 완료됩니다.
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    • 30일 내 같은 이메일로 가입 시 복구 가능합니다.
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={closeDeleteModal}
                data-testid="cancel-delete-button"
              >
                {deleteEmailSent ? "닫기" : "취소"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
