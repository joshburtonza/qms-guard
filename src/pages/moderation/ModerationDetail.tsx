import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Loader2, 
  FileText, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  User,
  Calendar,
  GraduationCap
} from 'lucide-react';
import { format } from 'date-fns';

interface ModerationDetail {
  id: string;
  moderation_id: string;
  learner_name: string;
  learner_id_number: string | null;
  assessment_date: string;
  assessment_type: string;
  assessment_result: string;
  assessor_comments: string | null;
  status: string;
  due_date: string;
  created_at: string;
  moderation_decision: string | null;
  moderation_feedback: string | null;
  areas_of_concern: string[] | null;
  recommendations: string | null;
  moderated_at: string | null;
  moderator_acknowledged: boolean;
  course: { code: string; title: string } | null;
  unit_standard: { code: string; title: string } | null;
  submitter: { full_name: string } | null;
  moderator: { id: string; full_name: string } | null;
}

interface Attachment {
  id: string;
  attachment_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-foreground/10 text-foreground',
  in_review: 'bg-foreground/8 text-foreground/80',
  approved: 'bg-foreground/6 text-foreground/60',
  rejected: 'bg-foreground/10 text-foreground/70',
  resubmitted: 'bg-foreground/8 text-foreground/70',
};

const concernOptions = [
  { id: 'marking_inconsistency', label: 'Marking inconsistency' },
  { id: 'insufficient_evidence', label: 'Insufficient evidence' },
  { id: 'incorrect_rubric', label: 'Incorrect rubric application' },
  { id: 'documentation_incomplete', label: 'Documentation incomplete' },
  { id: 'unit_standard_misalignment', label: 'Unit standard misalignment' },
  { id: 'other', label: 'Other' },
];

export default function ModerationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole, isAdmin } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  
  const [moderation, setModeration] = useState<ModerationDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Review form state
  const [decision, setDecision] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const canModerate = moderation && (
    moderation.moderator?.id === user?.id ||
    isAdmin() ||
    hasRole('manager')
  );

  const isPendingReview = moderation?.status === 'pending' || moderation?.status === 'in_review' || moderation?.status === 'resubmitted';

  useEffect(() => {
    if (id && tenant?.id) {
      fetchModeration();
      fetchAttachments();
    }
  }, [id, tenant?.id]);

  async function fetchModeration() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('moderation_requests')
        .select(`
          *,
          course:courses(code, title),
          unit_standard:unit_standards(code, title),
          submitter:profiles!moderation_requests_submitted_by_fkey(full_name),
          moderator:profiles!moderation_requests_moderator_id_fkey(id, full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setModeration(data);
      
      // Pre-fill form if already reviewed
      if (data.moderation_decision) {
        setDecision(data.moderation_decision);
        setFeedback(data.moderation_feedback || '');
        setConcerns(data.areas_of_concern || []);
        setRecommendations(data.recommendations || '');
      }
    } catch (error) {
      console.error('Error fetching moderation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load moderation request',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAttachments() {
    const { data } = await supabase
      .from('moderation_attachments')
      .select('id, attachment_type, file_name, file_path, file_size')
      .eq('moderation_id', id);
    
    if (data) setAttachments(data);
  }

  async function downloadAttachment(attachment: Attachment) {
    try {
      const { data, error } = await supabase.storage
        .from('nc-attachments')
        .download(attachment.file_path);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  }

  async function startReview() {
    if (!moderation) return;
    
    try {
      const { error } = await supabase
        .from('moderation_requests')
        .update({ status: 'in_review' })
        .eq('id', moderation.id);
      
      if (error) throw error;
      
      setModeration({ ...moderation, status: 'in_review' });
      toast({
        title: 'Review Started',
        description: 'You have started reviewing this moderation request.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start review',
        variant: 'destructive',
      });
    }
  }

  async function submitReview() {
    if (!moderation || !decision || !feedback) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a decision and feedback.',
        variant: 'destructive',
      });
      return;
    }

    if (!acknowledged) {
      toast({
        title: 'Acknowledgment Required',
        description: 'Please acknowledge your review before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newStatus = decision === 'rejected' ? 'rejected' : 'approved';
      
      const { error } = await supabase
        .from('moderation_requests')
        .update({
          moderation_decision: decision,
          moderation_feedback: feedback,
          areas_of_concern: concerns.length > 0 ? concerns : null,
          recommendations: recommendations || null,
          moderated_at: new Date().toISOString(),
          moderator_acknowledged: true,
          moderator_acknowledged_at: new Date().toISOString(),
          status: newStatus,
        })
        .eq('id', moderation.id);

      if (error) throw error;

      toast({
        title: 'Review Submitted',
        description: `The moderation has been ${newStatus}.`,
      });

      navigate('/moderation');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit review',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleConcern(concernId: string) {
    setConcerns((prev) =>
      prev.includes(concernId)
        ? prev.filter((c) => c !== concernId)
        : [...prev, concernId]
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!moderation) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Moderation request not found</h2>
          <Button className="mt-4" onClick={() => navigate('/moderation')}>
            Back to List
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/moderation')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{moderation.moderation_id}</h1>
              <Badge className={statusColors[moderation.status]} variant="outline">
                {moderation.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Submitted by {moderation.submitter?.full_name} on{' '}
              {format(new Date(moderation.created_at), 'dd MMM yyyy')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="attachments">
              Attachments ({attachments.length})
            </TabsTrigger>
            {canModerate && isPendingReview && (
              <TabsTrigger value="review">Review</TabsTrigger>
            )}
            {moderation.moderation_decision && (
              <TabsTrigger value="outcome">Outcome</TabsTrigger>
            )}
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Learner Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Learner Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Learner Name</Label>
                    <p className="font-medium">{moderation.learner_name}</p>
                  </div>
                  {moderation.learner_id_number && (
                    <div>
                      <Label className="text-muted-foreground">ID Number</Label>
                      <p className="font-medium">{moderation.learner_id_number}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assessment Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Assessment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {moderation.course && (
                    <div>
                      <Label className="text-muted-foreground">Course</Label>
                      <p className="font-medium">
                        {moderation.course.code} - {moderation.course.title}
                      </p>
                    </div>
                  )}
                  {moderation.unit_standard && (
                    <div>
                      <Label className="text-muted-foreground">Unit Standard</Label>
                      <p className="font-medium">
                        {moderation.unit_standard.code} - {moderation.unit_standard.title}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p className="font-medium capitalize">{moderation.assessment_type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Result</Label>
                      <p className="font-medium capitalize">
                        {moderation.assessment_result.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Assessment Date</Label>
                    <p className="font-medium">
                      {format(new Date(moderation.assessment_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Assessor Comments */}
            {moderation.assessor_comments && (
              <Card>
                <CardHeader>
                  <CardTitle>Assessor Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{moderation.assessor_comments}</p>
                </CardContent>
              </Card>
            )}

            {/* Assignment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Assignment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Assigned Moderator</Label>
                    <p className="font-medium">{moderation.moderator?.full_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Due Date</Label>
                    <p className="font-medium">
                      {format(new Date(moderation.due_date), 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attachments Tab */}
          <TabsContent value="attachments">
            <Card>
              <CardHeader>
                <CardTitle>Evidence & Documents</CardTitle>
                <CardDescription>
                  Assessment documents and learner evidence uploaded for moderation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {attachments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No attachments uploaded.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{att.file_name}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {att.attachment_type} • {att.file_size ? `${Math.round(att.file_size / 1024)} KB` : ''}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAttachment(att)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Review Tab (for moderators) */}
          {canModerate && isPendingReview && (
            <TabsContent value="review" className="space-y-4">
              {moderation.status === 'pending' && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Start Your Review</h3>
                        <p className="text-sm text-muted-foreground">
                          Click the button to begin reviewing this moderation request.
                        </p>
                      </div>
                      <Button onClick={startReview}>Start Review</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(moderation.status === 'in_review' || moderation.status === 'resubmitted') && (
                <>
                  {/* Decision */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Moderation Decision</CardTitle>
                      <CardDescription>
                        Review the assessment and select your decision
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup value={decision} onValueChange={setDecision} className="space-y-3">
                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="approved" id="approved" />
                          <div className="flex-1">
                            <Label htmlFor="approved" className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-foreground/60" />
                              Approved - Assessment Valid
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              The assessment meets all quality requirements
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="approved_with_recommendations" id="approved_with_recommendations" />
                          <div className="flex-1">
                            <Label htmlFor="approved_with_recommendations" className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-foreground/60" />
                              Approved with Recommendations
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Assessment is valid but improvements are suggested
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="rejected" id="rejected" />
                          <div className="flex-1">
                            <Label htmlFor="rejected" className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-foreground/70" />
                              Rejected - Reassessment Required
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              The assessment has significant issues and must be redone
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>

                  {/* Feedback */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Feedback to Assessor *</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="Provide detailed feedback on the assessment..."
                        className="min-h-[150px]"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                      />
                    </CardContent>
                  </Card>

                  {/* Areas of Concern */}
                  {(decision === 'approved_with_recommendations' || decision === 'rejected') && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Areas of Concern</CardTitle>
                        <CardDescription>Select all that apply</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {concernOptions.map((concern) => (
                            <div key={concern.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={concern.id}
                                checked={concerns.includes(concern.id)}
                                onCheckedChange={() => toggleConcern(concern.id)}
                              />
                              <Label htmlFor={concern.id}>{concern.label}</Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recommendations */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="Additional recommendations for improvement..."
                        className="min-h-[100px]"
                        value={recommendations}
                        onChange={(e) => setRecommendations(e.target.value)}
                      />
                    </CardContent>
                  </Card>

                  {/* Acknowledgment */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="acknowledge"
                          checked={acknowledged}
                          onCheckedChange={(checked) => setAcknowledged(checked === true)}
                        />
                        <div>
                          <Label htmlFor="acknowledge" className="font-medium">
                            I acknowledge that I have reviewed this assessment
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            By checking this box, I confirm that I have thoroughly reviewed 
                            all evidence and my decision is based on the quality standards.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Submit */}
                  <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={() => navigate('/moderation')}>
                      Save Draft
                    </Button>
                    <Button onClick={submitReview} disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Review
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          )}

          {/* Outcome Tab */}
          {moderation.moderation_decision && (
            <TabsContent value="outcome">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {moderation.moderation_decision === 'rejected' ? (
                      <XCircle className="h-5 w-5 text-foreground/70" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-foreground/60" />
                    )}
                    Moderation Outcome
                  </CardTitle>
                  <CardDescription>
                    Reviewed on {moderation.moderated_at && format(new Date(moderation.moderated_at), 'dd MMM yyyy')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Decision</Label>
                    <p className="font-medium capitalize">
                      {moderation.moderation_decision.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Feedback</Label>
                    <p className="whitespace-pre-wrap">{moderation.moderation_feedback}</p>
                  </div>
                  {moderation.areas_of_concern && moderation.areas_of_concern.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-muted-foreground">Areas of Concern</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {moderation.areas_of_concern.map((concern) => (
                            <Badge key={concern} variant="outline">
                              {concernOptions.find((c) => c.id === concern)?.label || concern}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {moderation.recommendations && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-muted-foreground">Recommendations</Label>
                        <p className="whitespace-pre-wrap">{moderation.recommendations}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
