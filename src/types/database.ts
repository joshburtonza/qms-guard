// Application-specific types derived from database schema

export type AppRole = 'super_admin' | 'site_admin' | 'manager' | 'supervisor' | 'worker' | 'verifier';

export type NCStatus = 'open' | 'in_progress' | 'pending_review' | 'pending_verification' | 'closed' | 'rejected';

export type NCSeverity = 'critical' | 'major' | 'minor';

export type NCCategory = 
  | 'training_documentation'
  | 'competency_verification'
  | 'safety_compliance'
  | 'equipment_ppe'
  | 'process_deviation'
  | 'record_keeping'
  | 'other';

export type Shift = 'day' | 'night' | 'general';

export type ServiceType = 'training' | 'consultation' | 'audit' | 'other';

export type RecommendationType = 'yes' | 'no' | 'maybe';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  platform_name: string;
  support_email: string | null;
  support_phone: string | null;
  timezone: string;
  date_format: string;
  plan: 'starter' | 'standard' | 'enterprise';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  full_name: string;
  department_id: string | null;
  site_location: string | null;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  tenant_id: string | null;
  name: string;
  site_location: string;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  tenant_id: string | null;
  created_at: string;
}

export interface Course {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  description: string | null;
  duration_days: number | null;
  nqf_level: number | null;
  credits: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NonConformance {
  id: string;
  tenant_id: string | null;
  nc_number: string;
  reported_by: string;
  department_id: string | null;
  site_location: string | null;
  shift: Shift | null;
  category: NCCategory;
  category_other: string | null;
  severity: NCSeverity;
  description: string;
  immediate_action: string | null;
  responsible_person: string;
  due_date: string;
  additional_stakeholders: string[] | null;
  status: NCStatus;
  current_step: number;
  workflow_history: object[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface CorrectiveAction {
  id: string;
  tenant_id: string | null;
  nc_id: string;
  root_cause: string;
  corrective_action: string;
  preventive_action: string | null;
  completion_date: string | null;
  submitted_by: string | null;
  submitted_at: string;
}

export interface WorkflowApproval {
  id: string;
  tenant_id: string | null;
  nc_id: string;
  step: number;
  action: 'approved' | 'rejected' | 'closed' | 'returned';
  comments: string | null;
  approved_by: string;
  approved_at: string;
}

export interface NCAttachment {
  id: string;
  tenant_id: string | null;
  nc_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface NCActivityLog {
  id: string;
  tenant_id: string | null;
  nc_id: string;
  action: string;
  details: object | null;
  performed_by: string | null;
  performed_at: string;
}

// Customer Satisfaction Survey types
export interface CustomerSatisfactionSurvey {
  id: string;
  tenant_id: string;
  survey_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  is_anonymous: boolean;
  department_id: string | null;
  service_type: ServiceType;
  course_id: string | null;
  facilitator_id: string | null;
  service_date: string | null;
  rating_overall: number | null;
  rating_content: number | null;
  rating_facilitator_knowledge: number | null;
  rating_facilitator_presentation: number | null;
  rating_materials: number | null;
  rating_venue: number | null;
  would_recommend: RecommendationType | null;
  feedback_positive: string | null;
  feedback_improvement: string | null;
  feedback_additional: string | null;
  created_at: string;
  source: 'web' | 'qr' | 'email_link';
}

// Extended types with relations
export interface NonConformanceWithRelations extends NonConformance {
  reporter?: Profile;
  responsible?: Profile;
  department?: Department;
  attachments?: NCAttachment[];
  corrective_actions?: CorrectiveAction[];
  approvals?: WorkflowApproval[];
  activity_log?: NCActivityLog[];
}

export interface SurveyWithRelations extends CustomerSatisfactionSurvey {
  course?: Course;
  facilitator?: Profile;
  department?: Department;
}

// Form types
export interface NCFormData {
  department_id: string;
  site_location: string;
  shift: Shift;
  category: NCCategory;
  category_other?: string;
  severity: NCSeverity;
  description: string;
  immediate_action?: string;
  responsible_person: string;
  due_date: string;
  additional_stakeholders?: string[];
}

export interface SurveyFormData {
  respondent_name?: string;
  respondent_email?: string;
  is_anonymous: boolean;
  department_id?: string;
  service_type: ServiceType;
  course_id?: string;
  facilitator_id?: string;
  service_date?: string;
  rating_overall: number;
  rating_content?: number;
  rating_facilitator_knowledge?: number;
  rating_facilitator_presentation?: number;
  rating_materials?: number;
  rating_venue?: number;
  would_recommend: RecommendationType;
  feedback_positive?: string;
  feedback_improvement?: string;
  feedback_additional?: string;
}

// Dashboard statistics
export interface DashboardStats {
  open: number;
  in_progress: number;
  pending_review: number;
  pending_verification: number;
  closed: number;
  overdue: number;
}

export interface SurveyStats {
  total_responses: number;
  avg_overall_rating: number;
  avg_content_rating: number;
  avg_facilitator_rating: number;
  recommendation_rate: number;
}

// Category labels for display
export const NC_CATEGORY_LABELS: Record<NCCategory, string> = {
  training_documentation: 'Training Documentation',
  competency_verification: 'Competency Verification',
  safety_compliance: 'Safety Compliance',
  equipment_ppe: 'Equipment/PPE',
  process_deviation: 'Process Deviation',
  record_keeping: 'Record Keeping',
  other: 'Other',
};

// Status labels for display
export const NC_STATUS_LABELS: Record<NCStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_review: 'Pending Review',
  pending_verification: 'Pending Verification',
  closed: 'Closed',
  rejected: 'Rejected',
};

// Severity labels for display
export const NC_SEVERITY_LABELS: Record<NCSeverity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
};

// Shift labels for display
export const SHIFT_LABELS: Record<Shift, string> = {
  day: 'Day Shift',
  night: 'Night Shift',
  general: 'General',
};

// Role labels for display
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  site_admin: 'Site Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
  worker: 'Worker',
  verifier: 'Verifier',
};

// Service type labels
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  training: 'Training',
  consultation: 'Consultation',
  audit: 'Audit',
  other: 'Other',
};

// Calculate due date based on severity
export function calculateDueDate(severity: NCSeverity): Date {
  const now = new Date();
  switch (severity) {
    case 'critical':
      return now; // Immediate
    case 'major':
      now.setDate(now.getDate() + 7);
      return now;
    case 'minor':
      now.setDate(now.getDate() + 30);
      return now;
  }
}

// Check if NC is overdue
export function isOverdue(dueDate: string, status: NCStatus): boolean {
  if (status === 'closed' || status === 'rejected') return false;
  return new Date(dueDate) < new Date();
}
