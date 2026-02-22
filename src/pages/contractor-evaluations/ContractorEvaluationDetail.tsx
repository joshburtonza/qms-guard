import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Briefcase,
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Edit,
  Star,
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface EvaluationDetail {
  id: string;
  evaluation_number: string;
  contractor_name: string;
  contractor_type: string;
  contractor_type_other: string | null;
  contract_reference: string | null;
  evaluation_date: string;
  evaluator_id: string;
  department_id: string | null;
  score_quality_of_work: number | null;
  score_timeliness: number | null;
  score_communication: number | null;
  score_compliance: number | null;
  score_value_for_money: number | null;
  score_health_safety: number | null;
  overall_score: number | null;
  recommendation: string | null;
  strengths: string | null;
  weaknesses: string | null;
  evaluator_comments: string | null;
  approval_comments: string | null;
  approved_by: string | null;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  evaluator: { id: string; full_name: string } | null;
  approver: { id: string; full_name: string } | null;
  department: { name: string } | null;
}

const SCORE_CATEGORIES = [
  { key: 'score_quality_of_work', label: 'Quality of Work' },
  { key: 'score_timeliness', label: 'Timeliness' },
  { key: 'score_communication', label: 'Communication' },
  { key: 'score_compliance', label: 'Compliance' },
  { key: 'score_value_for_money', label: 'Value for Money' },
  { key: 'score_health_safety', label: 'Health & Safety' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  draft: { label: 'Draft', variant: 'secondary', color: 'text-muted-foreground' },
  submitted: { label: 'Submitted', variant: 'default', color: 'text-foreground/80' },
  approved: { label: 'Approved', variant: 'outline', color: 'text-foreground/60' },
  rejected: { label: 'Rejected', variant: 'destructive', color: 'text-foreground/70' },
};

const RECOMMENDATION_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; bgColor: string; textColor: string }> = {
  highly_recommended: { label: 'Highly Recommended', icon: CheckCircle, bgColor: 'bg-foreground/10', textColor: 'text-foreground' },
  recommended: { label: 'Recommended', icon: CheckCircle, bgColor: 'bg-foreground/8', textColor: 'text-foreground/80' },
  conditional: { label: 'Conditional', icon: AlertTriangle, bgColor: 'bg-foreground/6', textColor: 'text-foreground/70' },
  not_recommended: { label: 'Not Recommended', icon: XCircle, bgColor: 'bg-foreground/10', textColor: 'text-foreground/80' },
};

const CONTRACTOR_TYPES: Record<string, string> = {
  training_provider: 'Training Provider',
  equipment_supplier: 'Equipment Supplier',
  consultant: 'Consultant',
  service_provider: 'Service Provider',
  other: 'Other',
};

export default function ContractorEvaluationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, roles } = useAuth();
  
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const isAdmin = roles.includes('super_admin') || roles.includes('site_admin') || roles.includes('manager');
  const isEvaluator = profile?.id === evaluation?.evaluator_id;

  useEffect(() => {
    if (id) fetchEvaluation();
  }, [id]);

  async function fetchEvaluation() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('contractor_evaluations')
      .select(`
        *,
        evaluator:profiles!contractor_evaluations_evaluator_id_fkey(id, full_name),
        approver:profiles!contractor_evaluations_approved_by_fkey(id, full_name),
        department:departments!contractor_evaluations_department_id_fkey(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      navigate('/contractor-evaluations');
      return;
    }

    setEvaluation(data as any);
    setIsLoading(false);
  }

  async function handleSubmit() {
    if (!evaluation || !isEvaluator) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contractor_evaluations')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id);

      if (error) throw error;

      toast({
        title: 'Evaluation Submitted',
        description: 'The evaluation has been submitted for approval.',
      });

      fetchEvaluation();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
      setShowSubmitDialog(false);
    }
  }

  async function handleApprove() {
    if (!evaluation || !isAdmin) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contractor_evaluations')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: profile?.id,
          approval_comments: approvalComments || null,
        })
        .eq('id', evaluation.id);

      if (error) throw error;

      toast({
        title: 'Evaluation Approved',
        description: 'The contractor evaluation has been approved.',
      });

      fetchEvaluation();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
      setShowApproveDialog(false);
      setApprovalComments('');
    }
  }

  async function handleReject() {
    if (!evaluation || !isAdmin || !approvalComments.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contractor_evaluations')
        .update({
          status: 'rejected',
          approved_at: new Date().toISOString(),
          approved_by: profile?.id,
          approval_comments: approvalComments,
        })
        .eq('id', evaluation.id);

      if (error) throw error;

      toast({
        title: 'Evaluation Rejected',
        description: 'The contractor evaluation has been rejected.',
      });

      fetchEvaluation();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
      setShowRejectDialog(false);
      setApprovalComments('');
    }
  }

  if (isLoading || !evaluation) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 4) return 'text-foreground';
    if (score >= 3) return 'text-foreground/70';
    return 'text-foreground/80';
  };

  const recommendationConfig = evaluation.recommendation 
    ? RECOMMENDATION_CONFIG[evaluation.recommendation] 
    : null;
  const RecIcon = recommendationConfig?.icon;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/contractor-evaluations')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-primary" />
                {evaluation.evaluation_number}
              </h1>
              <p className="text-muted-foreground">
                Contractor Evaluation • {evaluation.contractor_name}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_CONFIG[evaluation.status]?.variant || 'secondary'}>
            {STATUS_CONFIG[evaluation.status]?.label || evaluation.status}
          </Badge>
        </div>

        {/* Workflow Actions */}
        {evaluation.status === 'draft' && isEvaluator && (
          <Card className="border-border bg-muted/50">
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-foreground/60" />
                <div>
                  <p className="font-medium text-foreground">Ready to submit?</p>
                  <p className="text-sm text-muted-foreground">Submit this evaluation for manager approval.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(`/contractor-evaluations/${id}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button onClick={() => setShowSubmitDialog(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {evaluation.status === 'submitted' && isAdmin && (
          <Card className="border-border bg-muted/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-foreground/60" />
                <div>
                  <p className="font-medium text-foreground">Pending Approval</p>
                  <p className="text-sm text-muted-foreground">Review this evaluation and approve or reject it.</p>
                </div>
              </div>
              <Textarea
                placeholder="Add approval comments (optional for approval, required for rejection)..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <Button variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={!approvalComments.trim()}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={() => setShowApproveDialog(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contractor Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                Contractor Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{evaluation.contractor_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">
                  {CONTRACTOR_TYPES[evaluation.contractor_type] || evaluation.contractor_type}
                  {evaluation.contractor_type_other && ` (${evaluation.contractor_type_other})`}
                </p>
              </div>
              {evaluation.contract_reference && (
                <div>
                  <p className="text-sm text-muted-foreground">Contract Reference</p>
                  <p className="font-medium">{evaluation.contract_reference}</p>
                </div>
              )}
              {evaluation.department && (
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{evaluation.department.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Evaluation Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Evaluation Date</p>
                <p className="font-medium">{format(new Date(evaluation.evaluation_date), 'dd MMMM yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Evaluator</p>
                <p className="font-medium">{evaluation.evaluator?.full_name || '—'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommendation Badge */}
        {recommendationConfig && RecIcon && (
          <Card className={recommendationConfig.bgColor}>
            <CardContent className="pt-6 flex items-center justify-center gap-3">
              <RecIcon className={`h-8 w-8 ${recommendationConfig.textColor}`} />
              <span className={`text-xl font-bold ${recommendationConfig.textColor}`}>
                {recommendationConfig.label}
              </span>
            </CardContent>
          </Card>
        )}

        {/* Overall Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-foreground/60" />
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${getScoreColor(evaluation.overall_score)}`}>
                {evaluation.overall_score?.toFixed(1) || '—'}
              </div>
              <div className="flex-1">
                <Progress
                  value={evaluation.overall_score ? (evaluation.overall_score / 5) * 100 : 0}
                  className="h-3"
                />
              </div>
              <div className="text-sm text-muted-foreground">/ 5.0</div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Breakdown</CardTitle>
            <CardDescription>Individual category scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {SCORE_CATEGORIES.map((cat) => {
                const score = evaluation[cat.key as keyof EvaluationDetail] as number | null;
                return (
                  <div key={cat.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">{cat.label}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={score ? (score / 5) * 100 : 0} className="w-20 h-2" />
                      <span className={`font-bold ${getScoreColor(score)}`}>
                        {score || '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {evaluation.strengths && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Strengths</h4>
                <p className="text-sm">{evaluation.strengths}</p>
              </div>
            )}
            
            {evaluation.weaknesses && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Weaknesses</h4>
                <p className="text-sm">{evaluation.weaknesses}</p>
              </div>
            )}
            
            {evaluation.evaluator_comments && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Evaluator Comments</h4>
                <p className="text-sm">{evaluation.evaluator_comments}</p>
              </div>
            )}

            {evaluation.approval_comments && (
              <>
                <Separator />
                <div>
                  <h4 className={`font-medium text-sm mb-2 ${evaluation.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                    {evaluation.status === 'approved' ? 'Approval' : 'Rejection'} Comments
                  </h4>
                  <p className="text-sm">{evaluation.approval_comments}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    By {evaluation.approver?.full_name} on {evaluation.approved_at && format(new Date(evaluation.approved_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Created:</span>
                <span>{format(new Date(evaluation.created_at), 'dd MMM yyyy, HH:mm')}</span>
                <span className="text-muted-foreground">by {evaluation.evaluator?.full_name}</span>
              </div>
              {evaluation.submitted_at && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-foreground/40" />
                  <span className="text-muted-foreground">Submitted:</span>
                  <span>{format(new Date(evaluation.submitted_at), 'dd MMM yyyy, HH:mm')}</span>
                </div>
              )}
              {evaluation.approved_at && (
                <div className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${evaluation.status === 'approved' ? 'bg-foreground/40' : 'bg-foreground/60'}`} />
                  <span className="text-muted-foreground">{evaluation.status === 'approved' ? 'Approved' : 'Rejected'}:</span>
                  <span>{format(new Date(evaluation.approved_at), 'dd MMM yyyy, HH:mm')}</span>
                  <span className="text-muted-foreground">by {evaluation.approver?.full_name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will submit the evaluation for manager approval. You won't be able to edit after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the contractor evaluation as approved. The recommendation will be recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={isSubmitting}>
              {isSubmitting ? 'Approving...' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the contractor evaluation. Please provide comments explaining the rejection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject} 
              disabled={isSubmitting || !approvalComments.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Rejecting...' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
