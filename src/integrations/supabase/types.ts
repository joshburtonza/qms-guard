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
      audit_checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          evidence_found: string | null
          evidence_required: string | null
          finding: string | null
          id: string
          item_number: number
          nc_id: string | null
          notes: string | null
          requirement: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          evidence_found?: string | null
          evidence_required?: string | null
          finding?: string | null
          id?: string
          item_number: number
          nc_id?: string | null
          notes?: string | null
          requirement: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          evidence_found?: string | null
          evidence_required?: string | null
          finding?: string | null
          id?: string
          item_number?: number
          nc_id?: string | null
          notes?: string | null
          requirement?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "audit_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklist_items_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklist_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_checklists: {
        Row: {
          audit_date: string
          auditor_id: string
          checklist_number: string
          completed_at: string | null
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          iso_clause: string | null
          overall_result: string | null
          status: string | null
          summary_notes: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audit_date: string
          auditor_id: string
          checklist_number: string
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          iso_clause?: string | null
          overall_result?: string | null
          status?: string | null
          summary_notes?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audit_date?: string
          auditor_id?: string
          checklist_number?: string
          completed_at?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          iso_clause?: string | null
          overall_result?: string | null
          status?: string | null
          summary_notes?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_checklists_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklists_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_evaluations: {
        Row: {
          approval_comments: string | null
          approved_at: string | null
          approved_by: string | null
          contract_reference: string | null
          contractor_name: string
          contractor_type: string | null
          contractor_type_other: string | null
          created_at: string
          department_id: string | null
          evaluation_date: string
          evaluation_number: string
          evaluator_comments: string | null
          evaluator_id: string
          id: string
          overall_score: number | null
          recommendation: string | null
          score_communication: number | null
          score_compliance: number | null
          score_health_safety: number | null
          score_quality_of_work: number | null
          score_timeliness: number | null
          score_value_for_money: number | null
          status: string | null
          strengths: string | null
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          approval_comments?: string | null
          approved_at?: string | null
          approved_by?: string | null
          contract_reference?: string | null
          contractor_name: string
          contractor_type?: string | null
          contractor_type_other?: string | null
          created_at?: string
          department_id?: string | null
          evaluation_date: string
          evaluation_number: string
          evaluator_comments?: string | null
          evaluator_id: string
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          score_communication?: number | null
          score_compliance?: number | null
          score_health_safety?: number | null
          score_quality_of_work?: number | null
          score_timeliness?: number | null
          score_value_for_money?: number | null
          status?: string | null
          strengths?: string | null
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          approval_comments?: string | null
          approved_at?: string | null
          approved_by?: string | null
          contract_reference?: string | null
          contractor_name?: string
          contractor_type?: string | null
          contractor_type_other?: string | null
          created_at?: string
          department_id?: string | null
          evaluation_date?: string
          evaluation_number?: string
          evaluator_comments?: string | null
          evaluator_id?: string
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          score_communication?: number | null
          score_compliance?: number | null
          score_health_safety?: number | null
          score_quality_of_work?: number | null
          score_timeliness?: number | null
          score_value_for_money?: number | null
          status?: string | null
          strengths?: string | null
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_evaluations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_evaluations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      course_facilitator_evaluations: {
        Row: {
          course_assessment_fair: number | null
          course_content_relevant: number | null
          course_end_date: string | null
          course_exercises_valuable: number | null
          course_id: string
          course_materials_helpful: number | null
          course_objectives_clear: number | null
          course_pace_appropriate: number | null
          course_start_date: string | null
          created_at: string | null
          employee_number: string | null
          evaluation_id: string
          facilitator_encouraged_questions: number | null
          facilitator_engagement: number | null
          facilitator_expertise: number | null
          facilitator_explanations: number | null
          facilitator_id: string
          facilitator_presentation: number | null
          facilitator_professionalism: number | null
          feedback_additional: string | null
          feedback_improvement: string | null
          feedback_valuable: string | null
          id: string
          is_anonymous: boolean | null
          learner_name: string | null
          overall_course_rating: number | null
          overall_facilitator_rating: number | null
          source: string | null
          tenant_id: string
          venue: string | null
          would_recommend_course: string | null
          would_recommend_facilitator: string | null
        }
        Insert: {
          course_assessment_fair?: number | null
          course_content_relevant?: number | null
          course_end_date?: string | null
          course_exercises_valuable?: number | null
          course_id: string
          course_materials_helpful?: number | null
          course_objectives_clear?: number | null
          course_pace_appropriate?: number | null
          course_start_date?: string | null
          created_at?: string | null
          employee_number?: string | null
          evaluation_id: string
          facilitator_encouraged_questions?: number | null
          facilitator_engagement?: number | null
          facilitator_expertise?: number | null
          facilitator_explanations?: number | null
          facilitator_id: string
          facilitator_presentation?: number | null
          facilitator_professionalism?: number | null
          feedback_additional?: string | null
          feedback_improvement?: string | null
          feedback_valuable?: string | null
          id?: string
          is_anonymous?: boolean | null
          learner_name?: string | null
          overall_course_rating?: number | null
          overall_facilitator_rating?: number | null
          source?: string | null
          tenant_id: string
          venue?: string | null
          would_recommend_course?: string | null
          would_recommend_facilitator?: string | null
        }
        Update: {
          course_assessment_fair?: number | null
          course_content_relevant?: number | null
          course_end_date?: string | null
          course_exercises_valuable?: number | null
          course_id?: string
          course_materials_helpful?: number | null
          course_objectives_clear?: number | null
          course_pace_appropriate?: number | null
          course_start_date?: string | null
          created_at?: string | null
          employee_number?: string | null
          evaluation_id?: string
          facilitator_encouraged_questions?: number | null
          facilitator_engagement?: number | null
          facilitator_expertise?: number | null
          facilitator_explanations?: number | null
          facilitator_id?: string
          facilitator_presentation?: number | null
          facilitator_professionalism?: number | null
          feedback_additional?: string | null
          feedback_improvement?: string | null
          feedback_valuable?: string | null
          id?: string
          is_anonymous?: boolean | null
          learner_name?: string | null
          overall_course_rating?: number | null
          overall_facilitator_rating?: number | null
          source?: string | null
          tenant_id?: string
          venue?: string | null
          would_recommend_course?: string | null
          would_recommend_facilitator?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_facilitator_evaluations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_facilitator_evaluations_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_facilitator_evaluations_tenant_id_fkey"
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
      department_manager_mapping: {
        Row: {
          created_at: string
          department_id: string
          id: string
          tenant_id: string | null
          training_manager_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          tenant_id?: string | null
          training_manager_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          tenant_id?: string | null
          training_manager_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_manager_mapping_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_manager_mapping_tenant_id_fkey"
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
      edith_actions: {
        Row: {
          action_details: Json
          action_type: string
          affected_ids: string[] | null
          affected_table: string | null
          conversation_id: string | null
          error_message: string | null
          id: string
          performed_at: string | null
          success: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          action_details: Json
          action_type: string
          affected_ids?: string[] | null
          affected_table?: string | null
          conversation_id?: string | null
          error_message?: string | null
          id?: string
          performed_at?: string | null
          success?: boolean
          tenant_id: string
          user_id: string
        }
        Update: {
          action_details?: Json
          action_type?: string
          affected_ids?: string[] | null
          affected_table?: string | null
          conversation_id?: string | null
          error_message?: string | null
          id?: string
          performed_at?: string | null
          success?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edith_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "edith_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edith_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edith_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edith_compliance_assessments: {
        Row: {
          assessed_at: string | null
          assessed_by: string | null
          assessment_type: string
          compliance_status: string | null
          evidence_reviewed: string[] | null
          findings: Json
          id: string
          iso_clause: string | null
          next_review_date: string | null
          recommendations: string | null
          tenant_id: string
        }
        Insert: {
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_type: string
          compliance_status?: string | null
          evidence_reviewed?: string[] | null
          findings: Json
          id?: string
          iso_clause?: string | null
          next_review_date?: string | null
          recommendations?: string | null
          tenant_id: string
        }
        Update: {
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_type?: string
          compliance_status?: string | null
          evidence_reviewed?: string[] | null
          findings?: Json
          id?: string
          iso_clause?: string | null
          next_review_date?: string | null
          recommendations?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edith_compliance_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edith_compliance_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edith_conversations: {
        Row: {
          context: Json | null
          conversation_number: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_pinned: boolean | null
          tenant_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          conversation_number: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context?: Json | null
          conversation_number?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edith_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edith_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edith_iso_knowledge: {
        Row: {
          audit_questions: string[] | null
          clause_number: string
          clause_title: string
          common_nonconformities: string[] | null
          compliance_indicators: string[] | null
          created_at: string | null
          evidence_required: string[] | null
          id: string
          interpretation: string | null
          is_mandatory: boolean | null
          mining_context: string | null
          parent_clause: string | null
          qms_guard_mapping: Json | null
          requirement_text: string
          section_number: string | null
          section_title: string | null
          updated_at: string | null
        }
        Insert: {
          audit_questions?: string[] | null
          clause_number: string
          clause_title: string
          common_nonconformities?: string[] | null
          compliance_indicators?: string[] | null
          created_at?: string | null
          evidence_required?: string[] | null
          id?: string
          interpretation?: string | null
          is_mandatory?: boolean | null
          mining_context?: string | null
          parent_clause?: string | null
          qms_guard_mapping?: Json | null
          requirement_text: string
          section_number?: string | null
          section_title?: string | null
          updated_at?: string | null
        }
        Update: {
          audit_questions?: string[] | null
          clause_number?: string
          clause_title?: string
          common_nonconformities?: string[] | null
          compliance_indicators?: string[] | null
          created_at?: string | null
          evidence_required?: string[] | null
          id?: string
          interpretation?: string | null
          is_mandatory?: boolean | null
          mining_context?: string | null
          parent_clause?: string | null
          qms_guard_mapping?: Json | null
          requirement_text?: string
          section_number?: string | null
          section_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      edith_knowledge: {
        Row: {
          content: string
          content_type: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          content_type: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edith_knowledge_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edith_messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          tenant_id: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          tenant_id: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          tenant_id?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "edith_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "edith_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edith_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edith_regulatory_knowledge: {
        Row: {
          compliance_deadline: string | null
          created_at: string | null
          id: string
          interpretation: string | null
          iso_clause_links: string[] | null
          penalty_info: string | null
          qms_impact: string | null
          regulation_code: string | null
          regulation_name: string
          requirement_text: string
        }
        Insert: {
          compliance_deadline?: string | null
          created_at?: string | null
          id?: string
          interpretation?: string | null
          iso_clause_links?: string[] | null
          penalty_info?: string | null
          qms_impact?: string | null
          regulation_code?: string | null
          regulation_name: string
          requirement_text: string
        }
        Update: {
          compliance_deadline?: string | null
          created_at?: string | null
          id?: string
          interpretation?: string | null
          iso_clause_links?: string[] | null
          penalty_info?: string | null
          qms_impact?: string | null
          regulation_code?: string | null
          regulation_name?: string
          requirement_text?: string
        }
        Relationships: []
      }
      edith_tenant_config: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          assistant_avatar_url: string | null
          assistant_name: string | null
          created_at: string | null
          enabled_tools: Json | null
          fallback_provider: string | null
          id: string
          monthly_doc_gen_limit: number | null
          monthly_message_limit: number | null
          personality_prompt: string | null
          suggested_prompts: Json | null
          tenant_id: string
          updated_at: string | null
          welcome_message: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          assistant_avatar_url?: string | null
          assistant_name?: string | null
          created_at?: string | null
          enabled_tools?: Json | null
          fallback_provider?: string | null
          id?: string
          monthly_doc_gen_limit?: number | null
          monthly_message_limit?: number | null
          personality_prompt?: string | null
          suggested_prompts?: Json | null
          tenant_id: string
          updated_at?: string | null
          welcome_message?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          assistant_avatar_url?: string | null
          assistant_name?: string | null
          created_at?: string | null
          enabled_tools?: Json | null
          fallback_provider?: string | null
          id?: string
          monthly_doc_gen_limit?: number | null
          monthly_message_limit?: number | null
          personality_prompt?: string | null
          suggested_prompts?: Json | null
          tenant_id?: string
          updated_at?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edith_tenant_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edith_usage_log: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          interaction_type: string | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          provider: string
          tenant_id: string
          tool_calls_count: number | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          interaction_type?: string | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          provider: string
          tenant_id: string
          tool_calls_count?: number | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          interaction_type?: string | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          provider?: string
          tenant_id?: string
          tool_calls_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edith_usage_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "edith_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edith_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edith_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facilitator_annual_evaluations: {
        Row: {
          acknowledged_at: string | null
          areas_for_improvement: string | null
          created_at: string
          development_plan: string | null
          evaluation_number: string
          evaluation_period_end: string
          evaluation_period_start: string
          evaluator_comments: string | null
          evaluator_id: string
          facilitator_comments: string | null
          facilitator_id: string
          id: string
          overall_score: number | null
          reviewed_at: string | null
          score_assessment_quality: number | null
          score_continuous_improvement: number | null
          score_knowledge_expertise: number | null
          score_learner_engagement: number | null
          score_material_preparation: number | null
          score_presentation_skills: number | null
          score_professionalism: number | null
          score_time_management: number | null
          status: string | null
          strengths: string | null
          submitted_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          areas_for_improvement?: string | null
          created_at?: string
          development_plan?: string | null
          evaluation_number: string
          evaluation_period_end: string
          evaluation_period_start: string
          evaluator_comments?: string | null
          evaluator_id: string
          facilitator_comments?: string | null
          facilitator_id: string
          id?: string
          overall_score?: number | null
          reviewed_at?: string | null
          score_assessment_quality?: number | null
          score_continuous_improvement?: number | null
          score_knowledge_expertise?: number | null
          score_learner_engagement?: number | null
          score_material_preparation?: number | null
          score_presentation_skills?: number | null
          score_professionalism?: number | null
          score_time_management?: number | null
          status?: string | null
          strengths?: string | null
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          areas_for_improvement?: string | null
          created_at?: string
          development_plan?: string | null
          evaluation_number?: string
          evaluation_period_end?: string
          evaluation_period_start?: string
          evaluator_comments?: string | null
          evaluator_id?: string
          facilitator_comments?: string | null
          facilitator_id?: string
          id?: string
          overall_score?: number | null
          reviewed_at?: string | null
          score_assessment_quality?: number | null
          score_continuous_improvement?: number | null
          score_knowledge_expertise?: number | null
          score_learner_engagement?: number | null
          score_material_preparation?: number | null
          score_presentation_skills?: number | null
          score_professionalism?: number | null
          score_time_management?: number | null
          status?: string | null
          strengths?: string | null
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilitator_annual_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilitator_annual_evaluations_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilitator_annual_evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          date_occurred: string | null
          department_id: string | null
          description: string
          due_date: string
          id: string
          immediate_action: string | null
          nc_number: string
          qa_classification_comments: string | null
          reported_by: string
          responsible_person: string
          risk_classification: string | null
          severity: Database["public"]["Enums"]["nc_severity"]
          shift: string | null
          site_location: string | null
          smartsheet_row_id: string | null
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
          date_occurred?: string | null
          department_id?: string | null
          description: string
          due_date: string
          id?: string
          immediate_action?: string | null
          nc_number: string
          qa_classification_comments?: string | null
          reported_by: string
          responsible_person: string
          risk_classification?: string | null
          severity: Database["public"]["Enums"]["nc_severity"]
          shift?: string | null
          site_location?: string | null
          smartsheet_row_id?: string | null
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
          date_occurred?: string | null
          department_id?: string | null
          description?: string
          due_date?: string
          id?: string
          immediate_action?: string | null
          nc_number?: string
          qa_classification_comments?: string | null
          reported_by?: string
          responsible_person?: string
          risk_classification?: string | null
          severity?: Database["public"]["Enums"]["nc_severity"]
          shift?: string | null
          site_location?: string | null
          smartsheet_row_id?: string | null
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
      qr_locations: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean | null
          name: string
          qr_code_data: string
          site_location: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          qr_code_data: string
          site_location: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          qr_code_data?: string
          site_location?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_locations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      smartsheet_config: {
        Row: {
          column_mapping: Json
          created_at: string
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          sheet_id: string
          sheet_name: string | null
          sync_enabled: boolean
          tenant_id: string
          updated_at: string
          webhook_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          sheet_id: string
          sheet_name?: string | null
          sync_enabled?: boolean
          tenant_id: string
          updated_at?: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          sheet_id?: string
          sheet_name?: string | null
          sync_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartsheet_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      smartsheet_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          nc_id: string | null
          payload: Json | null
          smartsheet_row_id: string | null
          sync_direction: string
          sync_status: string
          sync_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          nc_id?: string | null
          payload?: Json | null
          smartsheet_row_id?: string | null
          sync_direction: string
          sync_status: string
          sync_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          nc_id?: string | null
          payload?: Json | null
          smartsheet_row_id?: string | null
          sync_direction?: string
          sync_status?: string
          sync_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartsheet_sync_log_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "non_conformances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartsheet_sync_log_tenant_id_fkey"
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
          signature_data: string | null
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
          signature_data?: string | null
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
          signature_data?: string | null
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
      edith_usage_daily: {
        Row: {
          avg_latency_ms: number | null
          chats: number | null
          cost_usd: number | null
          day: string | null
          imports: number | null
          interactions: number | null
          tenant_id: string | null
          tokens: number | null
          users: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edith_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edith_usage_summary: {
        Row: {
          active_users: number | null
          avg_latency_ms: number | null
          chat_messages: number | null
          file_imports: number | null
          last_activity_at: string | null
          month: string | null
          reports_generated: number | null
          tenant_id: string | null
          total_conversations: number | null
          total_cost_usd: number | null
          total_input_tokens: number | null
          total_interactions: number | null
          total_output_tokens: number | null
          total_tokens: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edith_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_edith_usage_daily: {
        Args: { p_tenant_id: string }
        Returns: {
          avg_latency_ms: number
          chats: number
          cost_usd: number
          day: string
          imports: number
          interactions: number
          tokens: number
          users: number
        }[]
      }
      get_edith_usage_summary: {
        Args: { p_months?: number; p_tenant_id: string }
        Returns: {
          active_users: number
          avg_latency_ms: number
          chat_messages: number
          file_imports: number
          last_activity_at: string
          month: string
          reports_generated: number
          total_conversations: number
          total_cost_usd: number
          total_interactions: number
          total_tokens: number
        }[]
      }
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
      refresh_edith_usage_summary: { Args: never; Returns: undefined }
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
