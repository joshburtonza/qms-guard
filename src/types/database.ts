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

export interface Profile {
  id: string;
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
  created_at: string;
}

export interface NonConformance {
  id: string;
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
  nc_id: string;
  step: number;
  action: 'approved' | 'rejected' | 'closed' | 'returned';
  comments: string | null;
  approved_by: string;
  approved_at: string;
}

export interface NCAttachment {
  id: string;
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
  nc_id: string;
  action: string;
  details: object | null;
  performed_by: string | null;
  performed_at: string;
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

// Dashboard statistics
export interface DashboardStats {
  open: number;
  in_progress: number;
  pending_review: number;
  pending_verification: number;
  closed: number;
  overdue: number;
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
