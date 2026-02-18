import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AppRole } from '@/types/database';

/**
 * Field locking configuration per workflow step
 * 
 * Step 1: Initiation - Only reporter can edit
 * Step 2: QA Classification - QA can edit severity, due_date, qa_comment
 * Step 3: Responsible Person Action - RP can edit root_cause, corrective_action, preventive_action
 * Step 4: Manager Approval Round 1 - Manager can add comments
 * Step 5: Responsible Person Rework - RP can edit corrective actions again
 * Step 6: Manager Approval Round 2 - Manager final decision
 */

export type FieldName = 
  // NC Core Fields
  | 'department_id'
  | 'site_location'
  | 'shift'
  | 'category'
  | 'category_other'
  | 'severity'
  | 'description'
  | 'immediate_action'
  | 'responsible_person'
  | 'due_date'
  // Corrective Action Fields
  | 'root_cause'
  | 'corrective_action'
  | 'preventive_action'
  | 'completion_date'
  // Workflow Fields
  | 'manager_comment'
  | 'qa_comment';

interface FieldConfig {
  editable: boolean;
  reason?: string;
}

interface FieldLockingConfig {
  fields: Record<FieldName, FieldConfig>;
  canSubmit: boolean;
  userRole: string;
}

interface UseFieldLockingProps {
  ncId?: string;
  currentStep: number;
  status: string;
  reportedBy: string;
  responsiblePerson: string;
  departmentId?: string;
}

/**
 * Hook to determine which fields are editable based on:
 * - Current workflow step
 * - User's role
 * - User's relationship to the NC (reporter, responsible person, manager)
 */
export function useFieldLocking({
  currentStep,
  status,
  reportedBy,
  responsiblePerson,
  departmentId,
}: UseFieldLockingProps): FieldLockingConfig {
  const { user, hasRole, isAdmin, profile } = useAuth();
  const userId = user?.id;
  const userDeptId = profile?.department_id;

  const config = useMemo<FieldLockingConfig>(() => {
    // Default all fields to locked
    const defaultFields: Record<FieldName, FieldConfig> = {
      department_id: { editable: false, reason: 'This field cannot be changed after submission' },
      site_location: { editable: false, reason: 'This field cannot be changed after submission' },
      shift: { editable: false, reason: 'This field cannot be changed after submission' },
      category: { editable: false, reason: 'This field cannot be changed after submission' },
      category_other: { editable: false, reason: 'This field cannot be changed after submission' },
      severity: { editable: false, reason: 'Only QA can modify severity during classification' },
      description: { editable: false, reason: 'This field cannot be changed after submission' },
      immediate_action: { editable: false, reason: 'This field cannot be changed after submission' },
      responsible_person: { editable: false, reason: 'Only QA can reassign responsible person' },
      due_date: { editable: false, reason: 'Only QA can modify due date' },
      root_cause: { editable: false, reason: 'Only responsible person can edit during their action step' },
      corrective_action: { editable: false, reason: 'Only responsible person can edit during their action step' },
      preventive_action: { editable: false, reason: 'Only responsible person can edit during their action step' },
      completion_date: { editable: false, reason: 'Only responsible person can set completion date' },
      manager_comment: { editable: false, reason: 'Only managers can add comments during approval' },
      qa_comment: { editable: false, reason: 'Only QA can add comments during classification' },
    };

    let canSubmit = false;
    let userRole = 'viewer';

    // Admin override - admins can edit everything
    if (isAdmin()) {
      return {
        fields: Object.fromEntries(
          Object.keys(defaultFields).map(key => [key, { editable: true }])
        ) as Record<FieldName, FieldConfig>,
        canSubmit: true,
        userRole: 'admin',
      };
    }

    // NC is closed or rejected - no edits allowed
    if (status === 'closed' || status === 'rejected') {
      return { fields: defaultFields, canSubmit: false, userRole: 'viewer' };
    }

    const isReporter = userId === reportedBy;
    const isResponsiblePerson = userId === responsiblePerson;
    const isManager = hasRole('manager') || hasRole('supervisor');
    const isQA = hasRole('verifier') || hasRole('site_admin');
    const isDeptManager = isManager && userDeptId === departmentId;

    // Step 1: Open - QA Classification
    if (status === 'open' && currentStep === 1) {
      if (isQA) {
        userRole = 'qa';
        canSubmit = true;
        return {
          fields: {
            ...defaultFields,
            severity: { editable: true },
            due_date: { editable: true },
            responsible_person: { editable: true },
            qa_comment: { editable: true },
          },
          canSubmit,
          userRole,
        };
      }
    }

    // Step 2/3: In Progress - Responsible Person Action
    if (status === 'in_progress' && (currentStep === 2 || currentStep === 3)) {
      if (isResponsiblePerson) {
        userRole = 'responsible_person';
        canSubmit = true;
        return {
          fields: {
            ...defaultFields,
            immediate_action: { editable: true },
            root_cause: { editable: true },
            corrective_action: { editable: true },
            preventive_action: { editable: true },
            completion_date: { editable: true },
          },
          canSubmit,
          userRole,
        };
      }
    }

    // Step 4/6: Pending Review - Manager Approval
    if (status === 'pending_review') {
      if (isDeptManager || isManager) {
        userRole = 'manager';
        canSubmit = true;
        return {
          fields: {
            ...defaultFields,
            manager_comment: { editable: true },
          },
          canSubmit,
          userRole,
        };
      }
    }

    // Step 5: Pending Verification - QA Verification
    if (status === 'pending_verification') {
      if (isQA) {
        userRole = 'verifier';
        canSubmit = true;
        return {
          fields: {
            ...defaultFields,
            qa_comment: { editable: true },
          },
          canSubmit,
          userRole,
        };
      }
    }

    return { fields: defaultFields, canSubmit, userRole };
  }, [currentStep, status, reportedBy, responsiblePerson, departmentId, userId, hasRole, isAdmin, userDeptId]);

  return config;
}

/**
 * Get human-readable role label for display
 */
export function getRoleLabel(userRole: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    qa: 'QA Officer',
    responsible_person: 'Responsible Person',
    manager: 'Training Manager',
    verifier: 'Verifier',
    viewer: 'Viewer',
  };
  return labels[userRole] || 'Viewer';
}

/**
 * Get step description for display
 */
export function getStepDescription(step: number): string {
  const descriptions: Record<number, string> = {
    1: 'QA Classification',
    2: 'Responsible Person Action',
    3: 'Responsible Person Rework',
    4: 'Manager Approval - Round 1',
    5: 'Responsible Person Final Response',
    6: 'Manager Approval - Round 2',
  };
  return descriptions[step] || 'Unknown Step';
}
