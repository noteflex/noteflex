import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT, useLang } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MESSAGE_MIN = 5;
const MESSAGE_MAX = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FeedbackDialog({ open, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 다이얼로그 닫힐 때 입력 리셋 (close 애니메이션 후)
  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setMessage("");
        setEmail("");
        setSubmitting(false);
      }, 200);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const trimmedLen = message.trim().length;
  const canSubmit = !submitting && trimmedLen >= MESSAGE_MIN;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (trimmedLen < MESSAGE_MIN) {
      toast.warning(t.feedback.toastTooShort);
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      toast.warning(t.feedback.toastInvalidEmail);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.functions.invoke("submit-feedback", {
      body: {
        message: message.trim(),
        email: trimmedEmail || undefined,
        user_id: user?.id,
        page_url: typeof window !== "undefined" ? window.location.href : "",
        locale: lang,
      },
    });

    if (error) {
      setSubmitting(false);
      toast.error(t.feedback.toastError);
      return;
    }
    toast.success(t.feedback.toastSuccess);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-[18px] font-semibold">
          {t.feedback.dialogTitle}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t.feedback.dialogSubtitle}
        </DialogDescription>

        <div className="flex flex-col gap-3 pt-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
            placeholder={t.feedback.messagePlaceholder}
            rows={5}
            disabled={submitting}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="feedback-textarea"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {trimmedLen < MESSAGE_MIN ? t.feedback.minHint : " "}
            </span>
            <span className="tabular-nums">
              {formatI18n(t.feedback.counter, { n: String(message.length) })}
            </span>
          </div>

          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.feedback.emailPlaceholder}
            disabled={submitting}
            aria-label="Email"
            data-testid="feedback-email"
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {t.feedback.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full sm:w-auto"
              style={{ backgroundColor: "#D3224E" }}
              data-testid="feedback-submit"
            >
              {submitting ? t.feedback.submitting : t.feedback.submit}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
