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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      corrective_actions: {
        Row: {
          completion_date: string | null
          corrective_action: string
          id: string
          nc_id: string
          preventive_action: string | null
          root_cause: string
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          completion_date?: string | null
          corrective_action: string
          id?: string
          nc_id: string
          preventive_action?: string | null
          root_cause: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          completion_date?: string | null
          corrective_action?: string
          id?: string
          nc_id?: string
          preventive_action?: string | null
          root_cause?: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string | null
          id: string
          manager_id: string | null
          name: string
          site_location: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name: string
          site_location: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          site_location?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_departments_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_activity_log: {
        Row: {
          action: string
          details: Json | null
          id: string
          nc_id: string
          performed_at: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          id?: string
          nc_id: string
          performed_at?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          id?: string
          nc_id?: string
          performed_at?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_activity_log_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          nc_id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          nc_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          nc_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_attachments_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      non_conformances: {
        Row: {
          additional_stakeholders: string[] | null
          category: Database["public"]["Enums"]["nc_category"]
          category_other: string | null
          closed_at: string | null
          created_at: string | null
          current_step: number | null
          department_id: string | null
          description: string
          due_date: string
          id: string
          immediate_action: string | null
          nc_number: string
          reported_by: string
          responsible_person: string
          severity: Database["public"]["Enums"]["nc_severity"]
          shift: string | null
          site_location: string | null
          status: Database["public"]["Enums"]["nc_status"]
          updated_at: string | null
          workflow_history: Json | null
        }
        Insert: {
          additional_stakeholders?: string[] | null
          category: Database["public"]["Enums"]["nc_category"]
          category_other?: string | null
          closed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          department_id?: string | null
          description: string
          due_date: string
          id?: string
          immediate_action?: string | null
          nc_number: string
          reported_by: string
          responsible_person: string
          severity: Database["public"]["Enums"]["nc_severity"]
          shift?: string | null
          site_location?: string | null
          status?: Database["public"]["Enums"]["nc_status"]
          updated_at?: string | null
          workflow_history?: Json | null
        }
        Update: {
          additional_stakeholders?: string[] | null
          category?: Database["public"]["Enums"]["nc_category"]
          category_other?: string | null
          closed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          department_id?: string | null
          description?: string
          due_date?: string
          id?: string
          immediate_action?: string | null
          nc_number?: string
          reported_by?: string
          responsible_person?: string
          severity?: Database["public"]["Enums"]["nc_severity"]
          shift?: string | null
          site_location?: string | null
          status?: Database["public"]["Enums"]["nc_status"]
          updated_at?: string | null
          workflow_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "non_conformances_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformances_responsible_person_fkey"
            columns: ["responsible_person"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          department_id: string | null
          employee_id: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone_number: string | null
          site_location: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone_number?: string | null
          site_location?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          site_location?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_approvals: {
        Row: {
          action: string
          approved_at: string | null
          approved_by: string
          comments: string | null
          id: string
          nc_id: string
          step: number
        }
        Insert: {
          action: string
          approved_at?: string | null
          approved_by: string
          comments?: string | null
          id?: string
          nc_id: string
          step: number
        }
        Update: {
          action?: string
          approved_at?: string | null
          approved_by?: string
          comments?: string | null
          id?: string
          nc_id?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_department: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "site_admin"
        | "manager"
        | "supervisor"
        | "worker"
        | "verifier"
      nc_category:
        | "training_documentation"
        | "competency_verification"
        | "safety_compliance"
        | "equipment_ppe"
        | "process_deviation"
        | "record_keeping"
        | "other"
      nc_severity: "critical" | "major" | "minor"
      nc_status:
        | "open"
        | "in_progress"
        | "pending_review"
        | "pending_verification"
        | "closed"
        | "rejected"
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
      app_role: [
        "super_admin",
        "site_admin",
        "manager",
        "supervisor",
        "worker",
        "verifier",
      ],
      nc_category: [
        "training_documentation",
        "competency_verification",
        "safety_compliance",
        "equipment_ppe",
        "process_deviation",
        "record_keeping",
        "other",
      ],
      nc_severity: ["critical", "major", "minor"],
      nc_status: [
        "open",
        "in_progress",
        "pending_review",
        "pending_verification",
        "closed",
        "rejected",
      ],
    },
  },
} as const
