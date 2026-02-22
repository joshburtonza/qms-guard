import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  GraduationCap,
  ArrowLeft,
  Send,
  CheckCircle,
  Edit,
  Star,
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
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
  facilitator_id: string;
  evaluator_id: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  score_knowledge_expertise: number | null;
  score_presentation_skills: number | null;
  score_learner_engagement: number | null;
  score_time_management: number | null;
  score_material_preparation: number | null;
  score_assessment_quality: number | null;
  score_professionalism: number | null;
  score_continuous_improvement: number | null;
  overall_score: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  development_plan: string | null;
  evaluator_comments: string | null;
  facilitator_comments: string | null;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  facilitator: { id: string; full_name: string } | null;
  evaluator: { id: string; full_name: string } | null;
}

const SCORE_CATEGORIES = [
  { key: 'score_knowledge_expertise', label: 'Knowledge & Expertise' },
  { key: 'score_presentation_skills', label: 'Presentation Skills' },
  { key: 'score_learner_engagement', label: 'Learner Engagement' },
  { key: 'score_time_management', label: 'Time Management' },
  { key: 'score_material_preparation', label: 'Material Preparation' },
  { key: 'score_assessment_quality', label: 'Assessment Quality' },
  { key: 'score_professionalism', label: 'Professionalism' },
  { key: 'score_continuous_improvement', label: 'Continuous Improvement' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; color: string }> = {
  draft: { label: 'Draft', variant: 'secondary', color: 'text-muted-foreground' },
  submitted: { label: 'Submitted', variant: 'default', color: 'text-foreground/80' },
  reviewed: { label: 'Reviewed', variant: 'outline', color: 'text-foreground/70' },
  acknowledged: { label: 'Acknowledged', variant: 'outline', color: 'text-foreground/60' },
};

export default function FacilitatorEvaluationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, roles } = useAuth();
  
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [facilitatorComments, setFacilitatorComments] = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showAcknowledgeDialog, setShowAcknowledgeDialog] = useState(false);

  const isAdmin = roles.includes('super_admin') || roles.includes('site_admin') || roles.includes('manager');
  const isEvaluator = profile?.id === evaluation?.evaluator_id;
  const isFacilitator = profile?.id === evaluation?.facilitator_id;

  useEffect(() => {
    if (id) fetchEvaluation();
  }, [id]);

  async function fetchEvaluation() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('facilitator_annual_evaluations')
      .select(`
        *,
        facilitator:profiles!facilitator_annual_evaluations_facilitator_id_fkey(id, full_name),
        evaluator:profiles!facilitator_annual_evaluations_evaluator_id_fkey(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      navigate('/facilitator-evaluations');
      return;
    }

    setEvaluation(data as any);
    setFacilitatorComments(data.facilitator_comments || '');
    setIsLoading(false);
  }

  async function handleSubmit() {
    if (!evaluation || !isEvaluator) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('facilitator_annual_evaluations')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id);

      if (error) throw error;

      toast({
        title: 'Evaluation Submitted',
        description: 'The evaluation has been submitted for the facilitator to review.',
      });

      fetchEvaluation();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
      setShowSubmitDialog(false);
    }
  }

  async function handleMarkReviewed() {
    if (!evaluation || !isAdmin) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('facilitator_annual_evaluations')
        .update({
          status: 'reviewed',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id);

      if (error) throw error;

      toast({
        title: 'Evaluation Reviewed',
        description: 'The evaluation has been marked as reviewed.',
      });

      fetchEvaluation();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAcknowledge() {
    if (!evaluation || !isFacilitator) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('facilitator_annual_evaluations')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          facilitator_comments: facilitatorComments || null,
        })
        .eq('id', evaluation.id);

      if (error) throw error;

      toast({
        title: 'Evaluation Acknowledged',
        description: 'You have acknowledged this evaluation.',
      });

      fetchEvaluation();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
      setShowAcknowledgeDialog(false);
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/facilitator-evaluations')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                {evaluation.evaluation_number}
              </h1>
              <p className="text-muted-foreground">
                Facilitator Evaluation • {evaluation.facilitator?.full_name}
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
                  <p className="text-sm text-muted-foreground">Once submitted, the facilitator will be notified to review and acknowledge.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(`/facilitator-evaluations/${id}/edit`)}>
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
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-foreground/60" />
                <div>
                  <p className="font-medium text-foreground">Pending Manager Review</p>
                  <p className="text-sm text-muted-foreground">Review the evaluation and mark it as reviewed if satisfactory.</p>
                </div>
              </div>
              <Button onClick={handleMarkReviewed} disabled={isSubmitting}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Reviewed
              </Button>
            </CardContent>
          </Card>
        )}

        {evaluation.status === 'reviewed' && isFacilitator && (
          <Card className="border-border bg-muted/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-foreground/60" />
                <div>
                  <p className="font-medium text-foreground">Your evaluation is ready for acknowledgement</p>
                  <p className="text-sm text-muted-foreground">Please review and acknowledge this evaluation. You may add comments below.</p>
                </div>
              </div>
              <Textarea
                placeholder="Add your comments or feedback (optional)..."
                value={facilitatorComments}
                onChange={(e) => setFacilitatorComments(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={() => setShowAcknowledgeDialog(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Acknowledge Evaluation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                Facilitator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{evaluation.facilitator?.full_name || '—'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Evaluation Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">
                {format(new Date(evaluation.evaluation_period_start), 'MMM yyyy')} –{' '}
                {format(new Date(evaluation.evaluation_period_end), 'MMM yyyy')}
              </p>
            </CardContent>
          </Card>
        </div>

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
              Feedback & Development
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {evaluation.strengths && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Strengths</h4>
                <p className="text-sm">{evaluation.strengths}</p>
              </div>
            )}
            
            {evaluation.areas_for_improvement && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Areas for Improvement</h4>
                <p className="text-sm">{evaluation.areas_for_improvement}</p>
              </div>
            )}
            
            {evaluation.development_plan && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Development Plan</h4>
                <p className="text-sm">{evaluation.development_plan}</p>
              </div>
            )}
            
            {evaluation.evaluator_comments && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Evaluator Comments</h4>
                <p className="text-sm">{evaluation.evaluator_comments}</p>
              </div>
            )}

            {evaluation.facilitator_comments && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm text-foreground/70 mb-2">Facilitator's Response</h4>
                  <p className="text-sm">{evaluation.facilitator_comments}</p>
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
              {evaluation.reviewed_at && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-foreground/30" />
                  <span className="text-muted-foreground">Reviewed:</span>
                  <span>{format(new Date(evaluation.reviewed_at), 'dd MMM yyyy, HH:mm')}</span>
                </div>
              )}
              {evaluation.acknowledged_at && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-foreground/20" />
                  <span className="text-muted-foreground">Acknowledged:</span>
                  <span>{format(new Date(evaluation.acknowledged_at), 'dd MMM yyyy, HH:mm')}</span>
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
              This will notify {evaluation.facilitator?.full_name} to review and acknowledge their evaluation.
              You won't be able to edit after submission.
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

      {/* Acknowledge Dialog */}
      <AlertDialog open={showAcknowledgeDialog} onOpenChange={setShowAcknowledgeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acknowledge Evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              By acknowledging, you confirm you have reviewed this evaluation. 
              {facilitatorComments ? ' Your comments will be saved.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcknowledge} disabled={isSubmitting}>
              {isSubmitting ? 'Acknowledging...' : 'Acknowledge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
