import { useEffect, useState } from 'react';
import { Shield, Clock, CheckCircle, AlertTriangle, Ban, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useFieldLocking } from '@/hooks/useFieldLocking';
import { supabase } from '@/integrations/supabase/client';
import { QAClassificationForm } from './QAClassificationForm';
import { ResponsiblePersonForm } from './ResponsiblePersonForm';
import { ManagerApprovalForm } from './ManagerApprovalForm';
import { QAVerificationForm } from './QAVerificationForm';
import { CurrentRoleBadge, FieldLockSummary } from '../FieldLockIndicator';

interface NCActionPanelProps {
  nc: any;
  onUpdate: () => void;
}

type UserRole = 'qa' | 'responsible_person' | 'manager' | 'initiator' | 'viewer';

export function NCActionPanel({ nc, onUpdate }: NCActionPanelProps) {
  const { user, profile } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [correctiveAction, setCorrectiveAction] = useState<any>(null);
  const [previousDecline, setPreviousDecline] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUserContext();
    }
  }, [user?.id, nc.id]);

  async function fetchUserContext() {
    try {
      // Fetch user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      setUserRoles(roles?.map(r => r.role) || []);

      // Fetch latest corrective action for this NC
      const { data: ca } = await supabase
        .from('corrective_actions')
        .select('*')
        .eq('nc_id', nc.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single();

      setCorrectiveAction(ca);

      // Check for previous decline comments
      const { data: approvals } = await supabase
        .from('workflow_approvals')
        .select('comments')
        .eq('nc_id', nc.id)
        .eq('action', 'rejected')
        .order('approved_at', { ascending: false })
        .limit(1);

      if (approvals && approvals.length > 0) {
        setPreviousDecline(approvals[0].comments);
      }
    } catch (error) {
      console.error('Error fetching user context:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Use field locking hook
  const fieldLocking = useFieldLocking({
    currentStep: nc.current_step || 1,
    status: nc.status,
    reportedBy: nc.reported_by,
    responsiblePerson: nc.responsible_person,
    departmentId: nc.department_id,
  });

  // Determine user's relationship to this NC
  const isQA = userRoles.includes('super_admin') || userRoles.includes('site_admin') || userRoles.includes('verifier');
  const isManager = userRoles.includes('manager') || userRoles.includes('super_admin') || userRoles.includes('site_admin');
  const isResponsiblePerson = nc.responsible_person === user?.id;
  const isInitiator = nc.reported_by === user?.id;

  // Count editable fields
  const editableFieldCount = Object.values(fieldLocking.fields).filter(f => f.editable).length;
  const totalFieldCount = Object.keys(fieldLocking.fields).length;

  // Determine what action (if any) the current user can take
  const getActionableState = (): {
    canAct: boolean;
    component: React.ReactNode | null;
    message: string;
    icon: React.ReactNode;
    variant: 'default' | 'info' | 'warning' | 'success';
  } => {
    // NC is closed or rejected - no actions available
    if (nc.status === 'closed') {
      return {
        canAct: false,
        component: null,
        message: 'This non-conformance has been approved and closed.',
        icon: <CheckCircle className="h-5 w-5 text-foreground/60" />,
        variant: 'success',
      };
    }

    if (nc.status === 'rejected') {
      return {
        canAct: false,
        component: null,
        message: 'This non-conformance was rejected (legacy status). Contact an administrator for resolution.',
        icon: <Ban className="h-5 w-5 text-foreground/70" />,
        variant: 'warning',
      };
    }

    // Step 1: Open - waiting for QA classification
    if (nc.status === 'open' && nc.current_step === 1) {
      if (isQA) {
        return {
          canAct: true,
          component: <QAClassificationForm nc={nc} onSuccess={onUpdate} />,
          message: 'Please classify the risk level for this NC.',
          icon: <Shield className="h-5 w-5 text-primary" />,
          variant: 'default',
        };
      }
      return {
        canAct: false,
        component: null,
        message: 'Waiting for QA to classify this NC.',
        icon: <Clock className="h-5 w-5 text-muted-foreground" />,
        variant: 'info',
      };
    }

    // Step 2: In Progress - waiting for responsible person response
    if (nc.status === 'in_progress' && (nc.current_step === 2 || nc.current_step === 3)) {
      const isRework = nc.current_step === 3 && previousDecline !== null;
      
      if (isResponsiblePerson) {
        return {
          canAct: true,
          component: (
            <ResponsiblePersonForm 
              nc={nc} 
              isRework={isRework}
              previousDeclineComments={previousDecline || undefined}
              onSuccess={onUpdate} 
            />
          ),
          message: isRework 
            ? 'Your previous submission was declined. Please provide revised corrective actions.'
            : 'Please document the root cause and corrective actions.',
          icon: isRework 
            ? <AlertTriangle className="h-5 w-5 text-foreground/70" />
            : <Shield className="h-5 w-5 text-primary" />,
          variant: isRework ? 'warning' : 'default',
        };
      }
      return {
        canAct: false,
        component: null,
        message: `Waiting for ${nc.responsible?.full_name || 'responsible person'} to submit corrective actions.`,
        icon: <Clock className="h-5 w-5 text-muted-foreground" />,
        variant: 'info',
      };
    }

    // Step 3/5: Pending Review - waiting for manager approval
    if (nc.status === 'pending_review') {
      const declineCount = (nc.workflow_history || []).filter(
        (h: any) => h.action === 'manager_declined'
      ).length;
      const isEscalated = declineCount >= 3;

      if (isManager) {
        return {
          canAct: true,
          component: (
            <ManagerApprovalForm 
              nc={nc} 
              correctiveAction={correctiveAction}
              onSuccess={onUpdate} 
            />
          ),
          message: isEscalated
            ? 'This NC has been escalated after multiple declines. Please review carefully.'
            : 'Please review the corrective action and make your decision.',
          icon: isEscalated 
            ? <AlertTriangle className="h-5 w-5 text-foreground/70" />
            : <Shield className="h-5 w-5 text-primary" />,
          variant: isEscalated ? 'warning' : 'default',
        };
      }
      return {
        canAct: false,
        component: null,
        message: 'Waiting for Training Manager to review and approve.',
        icon: <Clock className="h-5 w-5 text-muted-foreground" />,
        variant: 'info',
      };
    }

    // Step 4: Pending Verification
    if (nc.status === 'pending_verification') {
      if (isQA) {
        return {
          canAct: true,
          component: <QAVerificationForm nc={nc} onSuccess={onUpdate} />,
          message: 'Please verify the corrective actions and confirm effectiveness.',
          icon: <Shield className="h-5 w-5 text-primary" />,
          variant: 'default',
        };
      }
      return {
        canAct: false,
        component: null,
        message: 'Waiting for QA verification.',
        icon: <Clock className="h-5 w-5 text-muted-foreground" />,
        variant: 'info',
      };
    }

    // Default fallback
    return {
      canAct: false,
      component: null,
      message: 'No actions available for this NC.',
      icon: <Info className="h-5 w-5 text-muted-foreground" />,
      variant: 'info',
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { canAct, component, message, icon, variant } = getActionableState();

  // If user can act, show the form with role badge
  if (canAct && component) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CurrentRoleBadge userRole={fieldLocking.userRole} currentStep={nc.current_step || 1} />
          <FieldLockSummary 
            editableCount={editableFieldCount} 
            totalCount={totalFieldCount} 
            userRole={fieldLocking.userRole} 
          />
        </div>
        {component}
      </div>
    );
  }

  // Otherwise show status message with role badge
  const alertVariants: Record<string, string> = {
    success: 'border-border bg-muted/50',
    warning: 'border-border bg-muted/50',
    info: 'border-border bg-muted/50',
    default: 'border-border',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <CurrentRoleBadge userRole={fieldLocking.userRole} currentStep={nc.current_step || 1} />
        <FieldLockSummary 
          editableCount={editableFieldCount} 
          totalCount={totalFieldCount} 
          userRole={fieldLocking.userRole} 
        />
      </div>
      <Alert className={alertVariants[variant]}>
        <div className="flex items-center gap-2">
          {icon}
          <AlertTitle className="mb-0">Status</AlertTitle>
        </div>
        <AlertDescription className="mt-2">
          {message}
        </AlertDescription>
      </Alert>
    </div>
  );
}
