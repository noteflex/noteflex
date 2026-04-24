export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      payment_events: {
        Row: {
          amount_cents: number | null
          checkout_session_id: string | null
          created_at: string
          credits_added: number
          currency: string | null
          event_id: string
          id: string
          package_id: string
          provider: string
          status: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          checkout_session_id?: string | null
          created_at?: string
          credits_added: number
          currency?: string | null
          event_id: string
          id?: string
          package_id: string
          provider?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          checkout_session_id?: string | null
          created_at?: string
          credits_added?: number
          currency?: string | null
          event_id?: string
          id?: string
          package_id?: string
          provider?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          scan_quota: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          scan_quota?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          scan_quota?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_custom_scores: {
        Row: {
          created_at: string
          id: string
          note_data: Json
          score_title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_data: Json
          score_title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_data?: Json
          score_title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_note_logs: {
        Row: {
          clef: string
          created_at: string
          error_type: string | null
          id: string
          is_correct: boolean
          level: number
          note_key: string
          octave: number
          response_time: number | null
          user_id: string
        }
        Insert: {
          clef?: string
          created_at?: string
          error_type?: string | null
          id?: string
          is_correct: boolean
          level?: number
          note_key: string
          octave: number
          response_time?: number | null
          user_id: string
        }
        Update: {
          clef?: string
          created_at?: string
          error_type?: string | null
          id?: string
          is_correct?: boolean
          level?: number
          note_key?: string
          octave?: number
          response_time?: number | null
          user_id?: string
        }
        Relationships: []
      }
      practice_logs: {
        Row: {
          created_at: string
          expected_note: string
          id: number
          is_correct: boolean
          measure_number: number
          played_note: string | null
          reaction_time_ms: number
          score_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_note: string
          id?: number
          is_correct: boolean
          measure_number: number
          played_note?: string | null
          reaction_time_ms: number
          score_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          expected_note?: string
          is_correct?: boolean
          measure_number?: number
          played_note?: string | null
          reaction_time_ms?: number
          score_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_logs_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "user_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_scores: {
        Row: {
          created_at: string
          discontinued_at: string | null
          id: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discontinued_at?: string | null
          id?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discontinued_at?: string | null
          id?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payment_topup: {
        Args: {
          p_amount_cents: number | null
          p_checkout_session_id: string | null
          p_credits_added: number
          p_currency: string | null
          p_event_id: string
          p_package_id: string
          p_user_id: string
        }
        Returns: {
          applied: boolean
          remaining_quota: number
        }[]
      }
      consume_scan_quota: {
        Args: Record<PropertyKey, never>
        Returns: {
          remaining_quota: number
        }[]
      }
      topup_scan_quota: {
        Args: {
          p_amount: number
          p_user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
