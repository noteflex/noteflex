import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSolfegeSystem } from "@/hooks/useSolfegeSystem";
import { useNicknameAvailability } from "@/hooks/useNicknameAvailability";
import { nicknameErrorMessage } from "@/lib/nicknameValidation";
import {
  analyzePassword,
  STRENGTH_LABEL,
  STRENGTH_BAR_CL,
  STRENGTH_TXT_CL,
} from "@/lib/password";
import type { PasswordChecks } from "@/lib/password";
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

export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { system, setSystem } = useSolfegeSystem();

  // ── C2: 닉네임 + 언어 ──
  const [formData, setFormData] = useState({
    nickname: profile?.nickname ?? "",
    locale: profile?.locale ?? "ko",
  });
  const [saving, setSaving] = useState(false);

  // profile이 컴포넌트 마운트 후 로드될 때(null → 값) formData를 한 번만 동기화
  const profileSynced = useRef(!!profile);
  useEffect(() => {
    if (profile && !profileSynced.current) {
      setFormData({
        nickname: profile.nickname ?? "",
        locale: profile.locale ?? "ko",
      });
      profileSynced.current = true;
    }
  }, [profile]);

  const isDirty = useMemo(
    () =>
      formData.nickname !== (profile?.nickname ?? "") ||
      formData.locale !== (profile?.locale ?? "ko"),
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

  // ── C1: 비밀번호 변경 ──
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);

  const newPwAnalysis = analyzePassword(newPw);
  const newPwValid    = newPwAnalysis.score === 5;
  const pwMatch       = newPw === confirmPw && confirmPw.length > 0;

  // ── C3: 탈퇴 ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePw, setDeletePw]               = useState("");
  const [deleteReason, setDeleteReason]       = useState("");
  const [deleting, setDeleting]               = useState(false);

  // 사용자 변경(다른 계정 로그인) 시 비밀번호 폼 초기화
  useEffect(() => {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }, [user?.id]);

  if (!user) {
    navigate("/");
    return null;
  }

  // ── Handlers ──

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nickname: formData.nickname,
          locale: formData.locale,
        })
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPwValid) {
      toast({ title: "비밀번호 요구사항을 모두 충족해주세요", variant: "destructive" });
      return;
    }
    if (!pwMatch) {
      toast({ title: "새 비밀번호가 일치하지 않아요", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      // 현재 비밀번호 검증
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPw,
      });
      if (signInError) {
        toast({ title: "현재 비밀번호가 틀렸어요", variant: "destructive" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      toast({ title: "비밀번호가 변경됐어요" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      toast({ title: "비밀번호 변경 실패", description: err.message, variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    try {
      // 비밀번호 재확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: deletePw,
      });
      if (signInError) {
        toast({ title: "비밀번호가 틀렸어요", variant: "destructive" });
        return;
      }

      const { error } = await supabase.rpc("request_account_deletion", {
        reason: deleteReason || null,
      });
      if (error) throw error;

      await signOut();
      toast({
        title: "탈퇴가 완료됐어요",
        description: "그동안 NoteFlex를 이용해 주셔서 감사합니다.",
      });
      navigate("/");
    } catch (err: any) {
      toast({ title: "탈퇴 실패", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
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

        {/* ━━━━━━━━━━━━━━━━ C2: 닉네임 + 언어 ━━━━━━━━━━━━━━━━ */}
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
                <p className="text-xs text-destructive">{nicknameStatus.reason}</p>
              )}
              {nicknameStatus.state === "taken" && (
                <div className="space-y-1">
                  <p className="text-xs text-destructive" data-testid="nickname-taken-error">
                    이미 사용 중인 닉네임입니다
                  </p>
                  {nicknameStatus.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-muted-foreground">추천:</span>
                      {nicknameStatus.suggestions.map((s) => (
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

        {/* ━━━━━━━━━━━━━━━━ C1: 비밀번호 변경 ━━━━━━━━━━━━━━━━ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">비밀번호 변경</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <Label className="mb-1.5 block">현재 비밀번호</Label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    placeholder="현재 비밀번호"
                    required
                    data-testid="current-password-input"
                    className="w-full px-4 py-2.5 pr-16 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                  >
                    {showPw ? "숨기기" : "보기"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="mb-1.5 block">새 비밀번호</Label>
                <input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="새 비밀번호 (8자+·대소문자·숫자·특수문자)"
                  required
                  minLength={8}
                  data-testid="new-password-input"
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />

                {newPw.length > 0 && (
                  <div className="space-y-2" data-testid="password-strength">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                              i <= newPwAnalysis.score ? STRENGTH_BAR_CL[newPwAnalysis.score] : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      {newPwAnalysis.score > 0 && (
                        <span className={`text-xs font-medium ${STRENGTH_TXT_CL[newPwAnalysis.score]}`}>
                          {STRENGTH_LABEL[newPwAnalysis.score]}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                      {([
                        { key: "length",    label: "8자 이상" },
                        { key: "uppercase", label: "대문자" },
                        { key: "lowercase", label: "소문자" },
                        { key: "digit",     label: "숫자" },
                        { key: "special",   label: "특수문자" },
                      ] as { key: keyof PasswordChecks; label: string }[]).map(({ key, label }) => {
                        const ok = newPwAnalysis.checks[key];
                        return (
                          <span key={key} className={ok ? "text-green-600" : "text-muted-foreground"}>
                            {ok ? "✓" : "✗"} {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  required
                  data-testid="confirm-password-input"
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {confirmPw.length > 0 && !pwMatch && (
                  <p className="text-xs text-destructive mt-1" data-testid="pw-mismatch-error">비밀번호가 일치하지 않습니다</p>
                )}
                {pwMatch && (
                  <p className="text-xs text-green-600 mt-1" data-testid="pw-match-ok">✓ 비밀번호가 일치합니다</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={pwSaving || !currentPw || !newPwValid || !pwMatch}
                className="w-full"
                data-testid="change-password-button"
              >
                {pwSaving ? "변경 중..." : "비밀번호 변경"}
              </Button>
            </form>
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

        {/* ━━━━━━━━━━━━━━━━ C3: 탈퇴 (Danger Zone) ━━━━━━━━━━━━━━━━ */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">회원 탈퇴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              탈퇴 시 모든 연주 기록과 통계가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => { setDeletePw(""); setDeleteReason(""); setShowDeleteModal(true); }}
              data-testid="open-delete-modal-button"
            >
              회원 탈퇴
            </Button>
          </CardContent>
        </Card>

      </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━ C3: 탈퇴 확인 모달 ━━━━━━━━━━━━━━━━ */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-pop-in"
          data-testid="delete-modal"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex flex-col items-center gap-2 pt-6 pb-4 px-6">
              <span className="text-4xl">⚠️</span>
              <h2 className="text-xl font-bold text-foreground">정말 탈퇴하시겠어요?</h2>
              <p className="text-xs text-muted-foreground text-center">
                모든 데이터가 삭제되며 복구할 수 없어요.
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} className="px-6 pb-6 space-y-3">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1.5">
                  비밀번호 재입력
                </label>
                <input
                  type="password"
                  value={deletePw}
                  onChange={e => setDeletePw(e.target.value)}
                  placeholder="비밀번호를 입력해주세요"
                  required
                  data-testid="delete-password-input"
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                  탈퇴 사유 (선택)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder="서비스 개선에 참고할게요"
                  rows={2}
                  maxLength={200}
                  data-testid="delete-reason-input"
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || !deletePw}
                className="w-full"
                data-testid="confirm-delete-button"
              >
                {deleting ? "처리 중..." : "탈퇴하기"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => { setShowDeleteModal(false); setDeletePw(""); setDeleteReason(""); }}
                data-testid="cancel-delete-button"
              >
                취소
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
