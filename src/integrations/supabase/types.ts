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
      audit_log: {
        Row: {
          actor_email: string | null
          actor_role: string
          actor_user_id: string | null
          context: Json | null
          id: number
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          operation: string
          request_ip: string | null
          request_ua: string | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          actor_email?: string | null
          actor_role?: string
          actor_user_id?: string | null
          context?: Json | null
          id?: number
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation: string
          request_ip?: string | null
          request_ua?: string | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          actor_email?: string | null
          actor_role?: string
          actor_user_id?: string | null
          context?: Json | null
          id?: number
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation?: string
          request_ip?: string | null
          request_ua?: string | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          client_ref: string
          created_at: string
          email: string
          id: string
          last_error: string | null
          meeting_at: string
          meeting_date: string
          meeting_time: string | null
          name: string | null
          phone: string | null
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          status: string
          timezone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_ref: string
          created_at?: string
          email: string
          id?: string
          last_error?: string | null
          meeting_at: string
          meeting_date: string
          meeting_time?: string | null
          name?: string | null
          phone?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_ref?: string
          created_at?: string
          email?: string
          id?: string
          last_error?: string | null
          meeting_at?: string
          meeting_date?: string
          meeting_time?: string | null
          name?: string | null
          phone?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      preparation_drafts: {
        Row: {
          created_at: string
          filled: number
          form: Json
          id: string
          plan: string | null
          snapshot_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filled?: number
          form: Json
          id?: string
          plan?: string | null
          snapshot_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          filled?: number
          form?: Json
          id?: string
          plan?: string | null
          snapshot_at?: string
          user_id?: string
        }
        Relationships: []
      }
      preparation_submissions: {
        Row: {
          call_volume: string
          company_name: string
          company_phone: string
          compatibility_score: number | null
          compatibility_tier: string | null
          contact_email: string
          contact_name: string
          created_at: string
          email_status: string | null
          emergency_criteria: string | null
          emergency_number: string
          extra: string | null
          greeting: string
          id: string
          interlocutor: string
          location: string
          opening_hours: string
          plan: string | null
          priority: string | null
          rdv_link: string
          recommended_plan: string | null
          required_info: string
          services: string
          summary: string
          tech_access: string | null
          tone: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          call_volume: string
          company_name: string
          company_phone: string
          compatibility_score?: number | null
          compatibility_tier?: string | null
          contact_email: string
          contact_name: string
          created_at?: string
          email_status?: string | null
          emergency_criteria?: string | null
          emergency_number: string
          extra?: string | null
          greeting: string
          id?: string
          interlocutor: string
          location: string
          opening_hours: string
          plan?: string | null
          priority?: string | null
          rdv_link: string
          recommended_plan?: string | null
          required_info: string
          services: string
          summary: string
          tech_access?: string | null
          tone: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          call_volume?: string
          company_name?: string
          company_phone?: string
          compatibility_score?: number | null
          compatibility_tier?: string | null
          contact_email?: string
          contact_name?: string
          created_at?: string
          email_status?: string | null
          emergency_criteria?: string | null
          emergency_number?: string
          extra?: string | null
          greeting?: string
          id?: string
          interlocutor?: string
          location?: string
          opening_hours?: string
          plan?: string | null
          priority?: string | null
          rdv_link?: string
          recommended_plan?: string | null
          required_info?: string
          services?: string
          summary?: string
          tech_access?: string | null
          tone?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      shared_diagnostics: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string | null
          snapshot: Json
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string | null
          snapshot: Json
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string | null
          snapshot?: Json
          token?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_table_read: {
        Args: { _context?: Json; _row_id: string; _table: string }
        Returns: undefined
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
