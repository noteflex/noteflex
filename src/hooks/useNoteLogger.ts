import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { insertUserNoteLog, type UserNoteLogInput } from "@/lib/userNoteLogs";

type LogEntry = UserNoteLogInput;

export function useNoteLogger() {
  const { user } = useAuth();

  const logNote = useCallback(
    async (entry: LogEntry) => {
      if (!user) {
        console.warn("[NoteLogger] No user, skipping log");
        return;
      }

      const row: UserNoteLogInput = {
        note_key: entry.note_key,
        octave: entry.octave,
        clef: entry.clef,
        is_correct: entry.is_correct,
        response_time: entry.response_time,
        error_type: entry.error_type,
        level: entry.level,
      };

      const { data, error } = await insertUserNoteLog(row);

      if (error) {
        console.error("[NoteLogger] Insert error:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          status: error.status,
          row,
        });
        toast({
          title: "기록 저장 실패",
          description: `${error.code}: ${error.message}`,
          variant: "destructive",
        });
        if (typeof window !== "undefined") {
          window.alert(`기록 저장 실패\n${error.code}: ${error.message}`);
        }
        return;
      }

      toast({
        title: "기록 저장 성공",
        description: `log id: ${data?.id ?? "created"}`,
      });
    },
    [user]
  );

  return { logNote };
}
