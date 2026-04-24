import { supabase } from "@/integrations/supabase/client";

export interface UserNoteLogPayload {
  user_id: string;
  note_key: string;
  octave: number;
  clef: string;
  is_correct: boolean;
  response_time: number | null;
  error_type: string | null;
  level: number;
}

export interface UserNoteLogRecord extends UserNoteLogPayload {
  id?: string;
  created_at: string;
}

export type UserNoteLogInput = Omit<UserNoteLogPayload, "user_id">;

export interface NoteLogApiError {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

function toNoteLogError(error: unknown, fallbackCode: string): NoteLogApiError {
  if (error instanceof Error) {
    const postgrestError = error as Error & {
      code?: string;
      details?: string | null;
      hint?: string | null;
      status?: number;
    };

    return {
      code: postgrestError.code ?? fallbackCode,
      message: postgrestError.message,
      details: postgrestError.details ?? null,
      hint: postgrestError.hint ?? null,
      status: postgrestError.status,
    };
  }

  return {
    code: fallbackCode,
    message: "Unknown error",
  };
}

async function getAuthenticatedUser(): Promise<{ userId: string | null; error: NoteLogApiError | null }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return {
      userId: null,
      error: toNoteLogError(sessionError, "SESSION_ERROR"),
    };
  }

  if (!session) {
    return {
      userId: null,
      error: {
        code: "NO_SESSION",
        message: "No active session found.",
        status: 401,
      },
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      userId: null,
      error: toNoteLogError(userError, "USER_ERROR"),
    };
  }

  if (!user) {
    return {
      userId: null,
      error: {
        code: "NO_USER",
        message: "No authenticated user found.",
        status: 401,
      },
    };
  }

  return { userId: user.id, error: null };
}

export async function insertUserNoteLog(entry: UserNoteLogInput): Promise<{ data: Pick<UserNoteLogRecord, "id"> | null; error: NoteLogApiError | null }> {
  const { userId, error: authError } = await getAuthenticatedUser();

  if (authError || !userId) {
    return { data: null, error: authError };
  }

  const row: UserNoteLogPayload = {
    ...entry,
    user_id: userId,
  };

  try {
    const { data, error } = await supabase
      .from("user_note_logs")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      return { data: null, error: toNoteLogError(error, "INSERT_ERROR") };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: toNoteLogError(error, "INSERT_EXCEPTION") };
  }
}

export async function fetchUserNoteLogs(limit = 200): Promise<{ data: UserNoteLogRecord[] | null; error: NoteLogApiError | null }> {
  const { userId, error: authError } = await getAuthenticatedUser();

  if (authError || !userId) {
    return { data: null, error: authError };
  }

  try {
    const { data, error } = await supabase
      .from("user_note_logs")
      .select("id,user_id,note_key,octave,clef,is_correct,response_time,error_type,level,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: toNoteLogError(error, "FETCH_ERROR") };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: toNoteLogError(error, "FETCH_EXCEPTION") };
  }
}
