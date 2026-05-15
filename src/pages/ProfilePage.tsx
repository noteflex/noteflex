import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useLang, useT, type Lang } from "@/contexts/LanguageContext";
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

const LOCALE_OPTIONS: { value: Lang; key: "ko" | "en" }[] = [
  { value: "ko", key: "ko" },
  { value: "en", key: "en" },
] as const;

const SOLFEGE_OPTIONS: { value: SolfegeSystem; example: string }[] = [
  { value: "ko", example: "도-레-미-파-솔-라-시" },
  { value: "en", example: "C-D-E-F-G-A-B" },
  { value: "latin", example: "Do-Re-Mi-Fa-Sol-La-Si" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { system, setSystem } = useSolfegeSystem();
  const { lang, setLang } = useLang();
  const t = useT();

  // 계이름·언어 옵션 라벨 영역 (KO/EN 분기)
  const localeLabels: Record<Lang, string> = {
    ko: t.langToggle.ko,
    en: t.langToggle.en,
    ja: "日本語",
    zh: "中文",
  };
  const solfegeLabels: Record<SolfegeSystem, string> = {
    ko: t.profile.solfegeKorean,
    en: t.profile.solfegeEnglish,
    latin: t.profile.solfegeLatin,
  };

  // ── 프로필 폼 (닉네임 + 생년월일 + 국적 + 마케팅) ──
  // 표시 언어(locale)는 LanguageContext.setLang으로 즉시 반영 박음 — 폼 상태 X.
  const [formData, setFormData] = useState({
    nickname:         profile?.nickname ?? "",
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
      formData.birth_year   !== (profile?.birth_year?.toString() ?? "") ||
      formData.birth_month  !== (profile?.birth_month?.toString() ?? "") ||
      formData.birth_day    !== (profile?.birth_day?.toString() ?? "") ||
      formData.country_code !== (profile?.country_code ?? detectCountryCodeSmart()) ||
      formData.marketing_agreed !== !!profile?.marketing_agreed_at,
    [formData, profile]
  );

  // 언어 변경 핸들러: LanguageContext 즉시 반영 + DB 동기화 (best-effort).
  // setLang은 localStorage 박힘 → 새로고침·다른 페이지 이동 시 유지.
  const handleLanguageChange = async (newLang: Lang) => {
    setLang(newLang);
    if (user) {
      // best-effort: 실패해도 UI는 정상 (localStorage 폴백 박힘).
      void supabase.from("profiles").update({ locale: newLang }).eq("id", user.id);
    }
  };

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
            title: t.profile.nicknameDuplicate,
            description: t.profile.nicknameDuplicateDesc,
            variant: "destructive",
          });
          return;
        }
        toast({ title: t.profile.saveFailed, description: error.message, variant: "destructive" });
        return;
      }

      await refreshProfile();
      toast({ title: t.profile.saveSuccess });
    } catch {
      toast({ title: t.profile.saveFailed, variant: "destructive" });
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
      toast({ title: t.profile.deleteSendFailed, description: err.message, variant: "destructive" });
    } finally {
      setDeleteSending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const localeForDate = lang === "ko" ? "ko-KR" : "en-US";
  const premiumUntil = profile?.premium_until
    ? new Date(profile.premium_until).toLocaleDateString(localeForDate)
    : null;

  const joinedAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(localeForDate)
    : null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header
        right={
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t.profile.homeLink}
          </Link>
        }
      />
      <div className="flex-1 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-4">

        <h1 className="text-xl font-bold text-foreground">{t.profile.title}</h1>

        {/* ━━━━━━━━━━━━━━━━ 계정 설정 ━━━━━━━━━━━━━━━━ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.profile.accountSection}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* 닉네임 */}
            <div className="space-y-1.5">
              <Label>{t.profile.nicknameLabel}</Label>
              <Input
                value={formData.nickname}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    nickname: e.target.value.toLowerCase(),
                  }))
                }
                placeholder={t.profile.nicknamePlaceholder}
                maxLength={20}
                data-testid="nickname-input"
              />
              {nicknameStatus.state === "checking" && (
                <p className="text-xs text-muted-foreground">{t.profile.nicknameChecking}</p>
              )}
              {nicknameStatus.state === "available" && (
                <p className="text-xs text-green-600">{t.profile.nicknameAvailable}</p>
              )}
              {nicknameStatus.state === "invalid_format" && (
                <p className="text-xs text-destructive">{(nicknameStatus as any).reason}</p>
              )}
              {nicknameStatus.state === "taken" && (
                <div className="space-y-1">
                  <p className="text-xs text-destructive" data-testid="nickname-taken-error">
                    {t.profile.nicknameTaken}
                  </p>
                  {(nicknameStatus as any).suggestions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-muted-foreground">{t.profile.nicknameSuggestions}</span>
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
              <Label>{t.profile.birthYearLabel}</Label>
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
              <Label>{t.profile.nationalityLabel}</Label>
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

            {/* 표시 언어 — LanguageContext 즉시 반영 박음 */}
            <div className="space-y-1.5">
              <Label>{t.profile.languageLabel}</Label>
              <Select
                value={lang}
                onValueChange={(value) => handleLanguageChange(value as Lang)}
              >
                <SelectTrigger data-testid="language-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {localeLabels[opt.value]}
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
                <span className="text-foreground">{t.profile.marketingConsent}</span>
              </label>
            </div>

            {isDirty && (
              <p className="text-sm text-amber-600">
                {t.profile.dirtyHint}
              </p>
            )}
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full"
              data-testid="save-profile-button"
            >
              {saving ? t.profile.saving : t.profile.saveButton}
            </Button>

          </CardContent>
        </Card>

        {/* ━━━━━━━━━━━━━━━━ 계이름 체계 ━━━━━━━━━━━━━━━━ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.profile.solfegeSection}</CardTitle>
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
                    <span className="font-medium">{solfegeLabels[opt.value]}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{opt.example}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">{t.profile.solfegeApplied}</p>
          </CardContent>
        </Card>

        {/* ━━━━━━━━━━━━━━━━ 계정 정보 ━━━━━━━━━━━━━━━━ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.profile.accountInfoSection}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.profile.accountInfoEmail}</span>
              <span className="font-medium">{user.email}</span>
            </div>
            {joinedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.profile.accountInfoJoinedAt}</span>
                <span>{joinedAt}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.profile.accountInfoSubscription}</span>
              <span>
                {profile?.is_premium ? (
                  <span className="text-amber-600 font-semibold">
                    ✨ Premium{premiumUntil ? ` (~${premiumUntil})` : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t.profile.accountInfoFree}</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ━━━━━━━━━━━━━━━━ 로그아웃 ━━━━━━━━━━━━━━━━ */}
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          {t.profile.signOutButton}
        </Button>

        {/* ━━━━━━━━━━━━━━━━ 회원 탈퇴 (Danger Zone) ━━━━━━━━━━━━━━━━ */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">{t.profile.deleteSection}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t.profile.deleteDescription}
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={openDeleteModal}
              data-testid="open-delete-modal-button"
            >
              {t.profile.deleteButton}
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
                {deleteEmailSent ? t.profile.deleteEmailSentTitle : t.profile.deleteConfirmTitle}
              </h2>
              {!deleteEmailSent && (
                <p className="text-xs text-muted-foreground text-center">
                  {t.profile.deleteConfirmDesc}
                </p>
              )}
            </div>

            <div className="px-6 pb-6 space-y-3">
              {!deleteEmailSent ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                      {t.profile.deleteReasonLabel}
                    </label>
                    <select
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      data-testid="delete-reason-select"
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">{t.profile.deleteReasonNone}</option>
                      {t.profile.deleteReasons.map(r => (
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
                    {deleteSending ? t.profile.deleteSending : t.profile.deleteSendButton}
                  </Button>
                </>
              ) : (
                <div className="space-y-3" data-testid="delete-email-sent-screen">
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    <span className="font-medium text-foreground">{user.email}</span> — {t.profile.deleteEmailSentBody}
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    {t.profile.deleteRecoveryHint}
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
                {deleteEmailSent ? t.profile.deleteCloseModal : t.profile.deleteCancel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
