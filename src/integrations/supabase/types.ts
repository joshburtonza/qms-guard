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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "corrective_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          credits: number | null
          description: string | null
          duration_days: number | null
          id: string
          nqf_level: number | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          credits?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          nqf_level?: number | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          credits?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          nqf_level?: number | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_satisfaction_surveys: {
        Row: {
          course_id: string | null
          created_at: string | null
          department_id: string | null
          facilitator_id: string | null
          feedback_additional: string | null
          feedback_improvement: string | null
          feedback_positive: string | null
          id: string
          is_anonymous: boolean | null
          rating_content: number | null
          rating_facilitator_knowledge: number | null
          rating_facilitator_presentation: number | null
          rating_materials: number | null
          rating_overall: number | null
          rating_venue: number | null
          respondent_email: string | null
          respondent_name: string | null
          service_date: string | null
          service_type: string
          source: string | null
          survey_id: string
          tenant_id: string
          would_recommend: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          department_id?: string | null
          facilitator_id?: string | null
          feedback_additional?: string | null
          feedback_improvement?: string | null
          feedback_positive?: string | null
          id?: string
          is_anonymous?: boolean | null
          rating_content?: number | null
          rating_facilitator_knowledge?: number | null
          rating_facilitator_presentation?: number | null
          rating_materials?: number | null
          rating_overall?: number | null
          rating_venue?: number | null
          respondent_email?: string | null
          respondent_name?: string | null
          service_date?: string | null
          service_type: string
          source?: string | null
          survey_id: string
          tenant_id: string
          would_recommend?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          department_id?: string | null
          facilitator_id?: string | null
          feedback_additional?: string | null
          feedback_improvement?: string | null
          feedback_positive?: string | null
          id?: string
          is_anonymous?: boolean | null
          rating_content?: number | null
          rating_facilitator_knowledge?: number | null
          rating_facilitator_presentation?: number | null
          rating_materials?: number | null
          rating_overall?: number | null
          rating_venue?: number | null
          respondent_email?: string | null
          respondent_name?: string | null
          service_date?: string | null
          service_type?: string
          source?: string | null
          survey_id?: string
          tenant_id?: string
          would_recommend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_satisfaction_surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_satisfaction_surveys_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_satisfaction_surveys_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_satisfaction_surveys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name: string
          site_location: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          site_location?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_departments_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_attachments: {
        Row: {
          attachment_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          moderation_id: string
          tenant_id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          attachment_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          moderation_id: string
          tenant_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          moderation_id?: string
          tenant_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_attachments_moderation_id_fkey"
            columns: ["moderation_id"]
            isOneToOne: false
            referencedRelation: "moderation_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_requests: {
        Row: {
          areas_of_concern: string[] | null
          assessment_date: string | null
          assessment_result: string
          assessment_type: string
          assessor_comments: string | null
          assigned_at: string | null
          course_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          learner_id_number: string | null
          learner_name: string
          moderated_at: string | null
          moderation_decision: string | null
          moderation_feedback: string | null
          moderation_id: string
          moderator_acknowledged: boolean | null
          moderator_acknowledged_at: string | null
          moderator_id: string | null
          recommendations: string | null
          status: string
          submitted_at: string | null
          submitted_by: string
          tenant_id: string
          unit_standard_id: string | null
          updated_at: string | null
        }
        Insert: {
          areas_of_concern?: string[] | null
          assessment_date?: string | null
          assessment_result: string
          assessment_type: string
          assessor_comments?: string | null
          assigned_at?: string | null
          course_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          learner_id_number?: string | null
          learner_name: string
          moderated_at?: string | null
          moderation_decision?: string | null
          moderation_feedback?: string | null
          moderation_id: string
          moderator_acknowledged?: boolean | null
          moderator_acknowledged_at?: string | null
          moderator_id?: string | null
          recommendations?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by: string
          tenant_id: string
          unit_standard_id?: string | null
          updated_at?: string | null
        }
        Update: {
          areas_of_concern?: string[] | null
          assessment_date?: string | null
          assessment_result?: string
          assessment_type?: string
          assessor_comments?: string | null
          assigned_at?: string | null
          course_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          learner_id_number?: string | null
          learner_name?: string
          moderated_at?: string | null
          moderation_decision?: string | null
          moderation_feedback?: string | null
          moderation_id?: string
          moderator_acknowledged?: boolean | null
          moderator_acknowledged_at?: string | null
          moderator_id?: string | null
          recommendations?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          tenant_id?: string
          unit_standard_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_requests_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_requests_unit_standard_id_fkey"
            columns: ["unit_standard_id"]
            isOneToOne: false
            referencedRelation: "unit_standards"
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
          tenant_id: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          id?: string
          nc_id: string
          performed_at?: string | null
          performed_by?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          id?: string
          nc_id?: string
          performed_at?: string | null
          performed_by?: string | null
          tenant_id?: string | null
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
          {
            foreignKeyName: "nc_activity_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
            foreignKeyName: "nc_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "non_conformances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accent_color: string | null
          active: boolean | null
          created_at: string | null
          date_format: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          name: string
          plan: string | null
          platform_name: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          support_email: string | null
          support_phone: string | null
          timezone: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          active?: boolean | null
          created_at?: string | null
          date_format?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: string | null
          platform_name?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          support_email?: string | null
          support_phone?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          active?: boolean | null
          created_at?: string | null
          date_format?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string | null
          platform_name?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          support_email?: string | null
          support_phone?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unit_standards: {
        Row: {
          active: boolean | null
          code: string
          course_id: string | null
          created_at: string | null
          credits: number | null
          id: string
          nqf_level: number | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          course_id?: string | null
          created_at?: string | null
          credits?: number | null
          id?: string
          nqf_level?: number | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          course_id?: string | null
          created_at?: string | null
          credits?: number | null
          id?: string
          nqf_level?: number | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_standards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_standards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
        }
        Insert: {
          action: string
          approved_at?: string | null
          approved_by: string
          comments?: string | null
          id?: string
          nc_id: string
          step: number
          tenant_id?: string | null
        }
        Update: {
          action?: string
          approved_at?: string | null
          approved_by?: string
          comments?: string | null
          id?: string
          nc_id?: string
          step?: number
          tenant_id?: string | null
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
          {
            foreignKeyName: "workflow_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      get_user_tenant: { Args: { _user_id: string }; Returns: string }
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
        | "moderator"
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
        "moderator",
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
