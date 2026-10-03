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
  crm_abvcap: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          classification_level: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
          updated_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          classification_level: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          organization_id?: string
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          classification_level?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          emails: string[]
          full_name: string
          id: string
          notes: string | null
          organization_id: string
          phones: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          emails?: string[]
          full_name: string
          id?: string
          notes?: string | null
          organization_id?: string
          phones?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          emails?: string[]
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          phones?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_access_grants: {
        Row: {
          classification_level: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          granted_at: string
          granted_by: string
          id: string
          organization_id: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          classification_level: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          granted_at?: string
          granted_by: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          classification_level?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          granted_at?: string
          granted_by?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_access_grants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_access_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          organization_id?: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_participants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interaction_id: string
          organization_id: string
          participant_id: string
          participant_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_id: string
          organization_id?: string
          participant_id: string
          participant_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_id?: string
          organization_id?: string
          participant_id?: string
          participant_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_participants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_participants_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          classification_level: string
          created_at: string
          created_by: string | null
          id: string
          occurred_at: string
          organization_id: string
          summary: string
          type: string
          updated_at: string
        }
        Insert: {
          classification_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at: string
          organization_id?: string
          summary: string
          type: string
          updated_at?: string
        }
        Update: {
          classification_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string
          organization_id?: string
          summary?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_contacts: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          org_id: string
          organization_id: string
          role: string
          start_date: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          org_id: string
          organization_id?: string
          role: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          org_id?: string
          organization_id?: string
          role?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          legal_name: string | null
          name: string
          org_type: string
          organization_id: string
          priority_sectors: string[]
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          name: string
          org_type: string
          organization_id?: string
          priority_sectors?: string[]
          status?: string
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          org_type?: string
          organization_id?: string
          priority_sectors?: string[]
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filters: {
        Row: {
          created_at: string
          entity_type: string
          filter_state: Json
          id: string
          name: string
          user_profile_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          filter_state: Json
          id?: string
          name: string
          user_profile_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          filter_state?: Json
          id?: string
          name?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_filters_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          auth_id: string
          avatar_url: string | null
          capabilities: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          role: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          avatar_url?: string | null
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string
          role: string
          updated_at?: string
        }
        Update: {
          auth_id?: string
          avatar_url?: string | null
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_id: { Args: never; Returns: string }
      has_grant: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: boolean
      }
      has_role: { Args: { required_roles: string[] }; Returns: boolean }
      interaction_participant_count: {
        Args: { p_interaction_id: string }
        Returns: number
      }
      participant_interaction_ids: {
        Args: { p_participant_id: string; p_participant_type: string }
        Returns: string[]
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
  crm_abvcap: {
    Enums: {},
  },
} as const
