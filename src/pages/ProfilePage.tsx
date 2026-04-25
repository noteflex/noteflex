import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSolfegeSystem } from "@/hooks/useSolfegeSystem";
import { useNicknameAvailability } from "@/hooks/useNicknameAvailability";
import { nicknameErrorMessage } from "@/lib/nicknameValidation";
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

  const [formData, setFormData] = useState({
    nickname: profile?.nickname ?? "",
    locale: profile?.locale ?? "ko",
  });
  const [saving, setSaving] = useState(false);

  // dirty 판정: 현재 profile 원본과 비교
  const isDirty = useMemo(
    () =>
      formData.nickname !== (profile?.nickname ?? "") ||
      formData.locale !== (profile?.locale ?? "ko"),
    [formData, profile]
  );

  // 닉네임이 변경됐을 때만 가용성 체크 (원본과 동일하면 빈 문자열 → idle)
  const nicknameCheckInput =
    formData.nickname !== (profile?.nickname ?? "") ? formData.nickname : "";
  const nicknameStatus = useNicknameAvailability(nicknameCheckInput);

  // 저장 가능 여부
  const canSave =
    isDirty &&
    (formData.nickname === (profile?.nickname ?? "") ||
      nicknameStatus.state === "available");

  // 페이지 이탈 경고
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (!user) {
    navigate("/");
    return null;
  }

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
      className="min-h-screen px-4 py-8"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <div className="max-w-lg mx-auto space-y-4">

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 홈으로
          </button>
          <h1 className="text-xl font-bold text-foreground">프로필 설정</h1>
        </div>

        {/* 닉네임 + 언어 — 저장 버튼 하나로 묶음 */}
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
              />
              {/* 닉네임 상태 피드백 */}
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
                  <p className="text-xs text-destructive">이미 사용 중인 닉네임입니다</p>
                  {nicknameStatus.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-muted-foreground">추천:</span>
                      {nicknameStatus.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, nickname: s }))
                          }
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

            {/* 변경 알림 + 저장 버튼 */}
            {isDirty && (
              <p className="text-sm text-amber-600">
                변경 사항이 있습니다. 저장 버튼을 눌러주세요.
              </p>
            )}
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full"
            >
              {saving ? "저장 중..." : "저장"}
            </Button>

          </CardContent>
        </Card>

        {/* 계이름 체계 선택 — 즉시 적용 */}
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

        {/* 계정 정보 */}
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

        {/* 로그아웃 */}
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          로그아웃
        </Button>

      </div>
    </div>
  );
}
