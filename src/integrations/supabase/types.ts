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
    PostgrestVersion: "14.17"
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
      booking_correlations: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_type"]
          client_ref: string
          created_at: string
          expires_at: string
          sid: string
          user_id: string
        }
        Insert: {
          booking_type?: Database["public"]["Enums"]["booking_type"]
          client_ref: string
          created_at?: string
          expires_at?: string
          sid?: string
          user_id: string
        }
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_type"]
          client_ref?: string
          created_at?: string
          expires_at?: string
          sid?: string
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_type"]
          canceled_at: string | null
          client_ref: string
          created_at: string
          email: string
          iclosed_event_id: string | null
          id: string
          last_error: string | null
          meeting_at: string
          meeting_date: string
          meeting_location: string | null
          meeting_time: string | null
          name: string | null
          phone: string | null
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          rescheduled_from: string | null
          status: string
          status_norm: Database["public"]["Enums"]["booking_status"]
          timezone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          booking_type?: Database["public"]["Enums"]["booking_type"]
          canceled_at?: string | null
          client_ref: string
          created_at?: string
          email: string
          iclosed_event_id?: string | null
          id?: string
          last_error?: string | null
          meeting_at: string
          meeting_date: string
          meeting_location?: string | null
          meeting_time?: string | null
          name?: string | null
          phone?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          rescheduled_from?: string | null
          status?: string
          status_norm?: Database["public"]["Enums"]["booking_status"]
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_type"]
          canceled_at?: string | null
          client_ref?: string
          created_at?: string
          email?: string
          iclosed_event_id?: string | null
          id?: string
          last_error?: string | null
          meeting_at?: string
          meeting_date?: string
          meeting_location?: string | null
          meeting_time?: string | null
          name?: string | null
          phone?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          rescheduled_from?: string | null
          status?: string
          status_norm?: Database["public"]["Enums"]["booking_status"]
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      journey_state: {
        Row: {
          client_ref: string | null
          created_at: string
          demo_completed_at: string | null
          id: string
          installation_status: Database["public"]["Enums"]["installation_status"]
          paid_at: string | null
          paid_plan: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_ref?: string | null
          created_at?: string
          demo_completed_at?: string | null
          id?: string
          installation_status?: Database["public"]["Enums"]["installation_status"]
          paid_at?: string | null
          paid_plan?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          client_ref?: string | null
          created_at?: string
          demo_completed_at?: string | null
          id?: string
          installation_status?: Database["public"]["Enums"]["installation_status"]
          paid_at?: string | null
          paid_plan?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_table_read: {
        Args: { _context?: Json; _row_id: string; _table: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "rescheduled"
        | "completed"
        | "no_show"
      booking_type: "r1_discovery" | "r2_demo" | "setup_test"
      installation_status:
        | "not_started"
        | "in_progress"
        | "ready_for_test"
        | "live"
      payment_status: "unpaid" | "paid" | "refunded"
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
    Enums: {
      app_role: ["admin", "user"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "rescheduled",
        "completed",
        "no_show",
      ],
      booking_type: ["r1_discovery", "r2_demo", "setup_test"],
      installation_status: [
        "not_started",
        "in_progress",
        "ready_for_test",
        "live",
      ],
      payment_status: ["unpaid", "paid", "refunded"],
    },
  },
} as const
