import { useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { insertUserNoteLog, type UserNoteLogInput } from "@/lib/userNoteLogs";
import { noteKeyToSemitone } from "@/lib/noteUtils";

type LogEntry = UserNoteLogInput;

export function useNoteLogger() {
  const { user } = useAuth();
  const prevNoteRef = useRef<{ note_key: string; octave: number } | null>(null);

  const resetPrevNote = useCallback(() => {
    prevNoteRef.current = null;
  }, []);

  const logNote = useCallback(
    async (entry: LogEntry) => {
      if (!user) {
        console.warn("[NoteLogger] No user, skipping log");
        return;
      }

      const prev = prevNoteRef.current;
      let interval_from_prev: number | null = null;
      if (prev !== null) {
        const fromSt = noteKeyToSemitone(prev.note_key, prev.octave);
        const toSt = noteKeyToSemitone(entry.note_key, entry.octave);
        if (fromSt !== null && toSt !== null) {
          interval_from_prev = toSt - fromSt;
        }
      }
      prevNoteRef.current = { note_key: entry.note_key, octave: entry.octave };

      const row: UserNoteLogInput = {
        note_key: entry.note_key,
        octave: entry.octave,
        clef: entry.clef,
        is_correct: entry.is_correct,
        response_time: entry.response_time,
        error_type: entry.error_type,
        level: entry.level,
        interval_from_prev,
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

      if (import.meta.env.DEV) {
        console.log("[NoteLogger] saved, id:", data?.id ?? "created");
      }
    },
    [user]
  );

  return { logNote, resetPrevNote };
}
