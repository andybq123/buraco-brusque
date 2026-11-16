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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      ouvidoria_email_queue: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          email_token: string
          id: string
          last_error: string | null
          message_id: string | null
          pothole_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          email_token: string
          id?: string
          last_error?: string | null
          message_id?: string | null
          pothole_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          email_token?: string
          id?: string
          last_error?: string | null
          message_id?: string | null
          pothole_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_email_queue_pothole_id_fkey"
            columns: ["pothole_id"]
            isOneToOne: true
            referencedRelation: "potholes"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_email_replies: {
        Row: {
          applied: boolean
          confidence: number | null
          created_at: string
          error: string | null
          excerpt: string | null
          id: string
          message_id: string
          protocol: string | null
          queue_id: string | null
          sender_email: string | null
          subject: string | null
        }
        Insert: {
          applied?: boolean
          confidence?: number | null
          created_at?: string
          error?: string | null
          excerpt?: string | null
          id?: string
          message_id: string
          protocol?: string | null
          queue_id?: string | null
          sender_email?: string | null
          subject?: string | null
        }
        Update: {
          applied?: boolean
          confidence?: number | null
          created_at?: string
          error?: string | null
          excerpt?: string | null
          id?: string
          message_id?: string
          protocol?: string | null
          queue_id?: string | null
          sender_email?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_email_replies_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "ouvidoria_email_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_settings: {
        Row: {
          ai_key_ciphertext: string | null
          ai_model: string | null
          ai_provider: string
          auto_read: boolean
          auto_send: boolean
          id: boolean
          imap_host: string | null
          imap_port: number | null
          imap_secure: boolean
          last_sync_at: string | null
          last_sync_status: string | null
          password_ciphertext: string | null
          recipient_email: string | null
          sender_email: string | null
          sender_name: string
          smtp_host: string | null
          smtp_port: number | null
          smtp_secure: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_key_ciphertext?: string | null
          ai_model?: string | null
          ai_provider?: string
          auto_read?: boolean
          auto_send?: boolean
          id?: boolean
          imap_host?: string | null
          imap_port?: number | null
          imap_secure?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          password_ciphertext?: string | null
          recipient_email?: string | null
          sender_email?: string | null
          sender_name?: string
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_key_ciphertext?: string | null
          ai_model?: string | null
          ai_provider?: string
          auto_read?: boolean
          auto_send?: boolean
          id?: boolean
          imap_host?: string | null
          imap_port?: number | null
          imap_secure?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          password_ciphertext?: string | null
          recipient_email?: string | null
          sender_email?: string | null
          sender_name?: string
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      potholes: {
        Row: {
          address: string | null
          created_at: string
          descriptions: string[]
          hazards: string[]
          id: string
          kind: string
          last_reported_at: string
          lat: number
          lng: number
          number: number
          ouvidoria_email_sent_at: string | null
          ouvidoria_protocol: string | null
          ouvidoria_protocol_source: string | null
          ouvidoria_sent_at: string | null
          photos: string[]
          repaired_by: string | null
          report_count: number
          resolved_at: string | null
          resolved_by_email: string | null
          size: string | null
          status: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          descriptions?: string[]
          hazards?: string[]
          id?: string
          kind?: string
          last_reported_at?: string
          lat: number
          lng: number
          number?: number
          ouvidoria_email_sent_at?: string | null
          ouvidoria_protocol?: string | null
          ouvidoria_protocol_source?: string | null
          ouvidoria_sent_at?: string | null
          photos?: string[]
          repaired_by?: string | null
          report_count?: number
          resolved_at?: string | null
          resolved_by_email?: string | null
          size?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          descriptions?: string[]
          hazards?: string[]
          id?: string
          kind?: string
          last_reported_at?: string
          lat?: number
          lng?: number
          number?: number
          ouvidoria_email_sent_at?: string | null
          ouvidoria_protocol?: string | null
          ouvidoria_protocol_source?: string | null
          ouvidoria_sent_at?: string | null
          photos?: string[]
          repaired_by?: string | null
          report_count?: number
          resolved_at?: string | null
          resolved_by_email?: string | null
          size?: string | null
          status?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          host: string
          id: number
          last_seen: string
          lat: number | null
          lng: number | null
          path: string
          region: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          host: string
          id?: number
          last_seen?: string
          lat?: number | null
          lng?: number | null
          path: string
          region?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          host?: string
          id?: number
          last_seen?: string
          lat?: number | null
          lng?: number | null
          path?: string
          region?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      inside_brusque: { Args: { _lat: number; _lng: number }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      report_pothole: {
        Args: {
          _address?: string
          _description?: string
          _hazards?: string[]
          _kind?: string
          _lat: number
          _lng: number
          _photo?: string
          _size?: string
        }
        Returns: Json
      }
      visit_stats: { Args: { _days: number }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "operador"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "operador"],
    },
  },
} as const
