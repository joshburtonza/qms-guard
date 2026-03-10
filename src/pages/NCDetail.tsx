import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileText,
  Image,
  User,
  Building,
  MapPin,
  RefreshCw,
  Printer,
  BookOpen,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/nc/StatusBadge';
import { SeverityIndicator } from '@/components/nc/SeverityIndicator';
import { WorkflowProgress } from '@/components/nc/WorkflowProgress';
import { NCActionPanel } from '@/components/nc/workflow';
import { NCPrintView } from '@/components/nc/NCPrintView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { NC_CATEGORY_LABELS, SHIFT_LABELS, isOverdue } from '@/types/database';
import { Badge } from '@/components/ui/badge';

export default function NCDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles } = useAuth();
  const [nc, setNC] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [correctiveAction, setCorrectiveAction] = useState<any>(null);
  const [workflowApprovals, setWorkflowApprovals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>('');
  const { tenant } = useTenant();

  const fetchNCDetails = useCallback(async () => {
    try {
      const [ncResult, attachResult, activityResult, caResult, approvalsResult] = await Promise.all([
        supabase
          .from('non_conformances')
          .select(`
            *,
            reporter:reported_by(full_name, employee_id),
            responsible:responsible_person(full_name, employee_id),
            department:department_id(name, site_location, manager_id)
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('nc_attachments')
          .select('*')
          .eq('nc_id', id),
        supabase
          .from('nc_activity_log')
          .select(`
            *,
            performer:performed_by(full_name)
          `)
          .eq('nc_id', id)
          .order('performed_at', { ascending: false }),
        supabase
          .from('corrective_actions')
          .select('*')
          .eq('nc_id', id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('workflow_approvals')
          .select('*')
          .eq('nc_id', id)
          .order('approved_at', { ascending: false }),
      ]);

      if (ncResult.error) throw ncResult.error;
      setNC(ncResult.data);
      setAttachments(attachResult.data || []);
      setActivities(activityResult.data || []);
      setCorrectiveAction(caResult.data || null);
      setWorkflowApprovals(approvalsResult.data || []);
    } catch (error) {
      console.error('Error fetching NC details:', error);
      navigate('/nc');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) fetchNCDetails();
  }, [id, fetchNCDetails]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNCDetails();
  };

  function isImageFile(fileName: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
  }

  async function downloadAttachment(attachment: any) {
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  }

  async function openImageLightbox(attachment: any) {
    try {
      const { data, error } = await supabase.storage
        .from('nc-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setLightboxUrl(url);
      setLightboxName(attachment.file_name);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load image',
        variant: 'destructive',
      });
    }
  }

  const handleReclassify = async () => {
    if (!nc) return;
    setIsReclassifying(true);
    try {
      const { error } = await supabase.functions.invoke('classify-risk', {
        body: { ncId: nc.id, tenantId: nc.tenant_id },
      });
      if (error) throw error;
      await fetchNCDetails();
      toast({
        title: 'Risk reclassified successfully',
        description: 'AI risk assessment has been updated.',
      });
    } catch (err: any) {
      toast({
        title: 'Reclassification failed',
        description: err?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsReclassifying(false);
    }
  };

  const handlePrint = () => {
    setShowPrintView(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setShowPrintView(false);
      });
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-20" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (!nc) return null;

  // Show print view when printing
  if (showPrintView) {
    return (
      <NCPrintView
        nc={nc}
        attachments={attachments}
        activities={activities}
        correctiveAction={correctiveAction}
        workflowApprovals={workflowApprovals}
        tenantName={tenant?.name || tenant?.platform_name}
        tenantLogoUrl={tenant?.logo_url}
      />
    );
  }

  const overdue = isOverdue(nc.due_date, nc.status);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold tracking-tight font-mono">
                {nc.nc_number}
              </h1>
              <StatusBadge status={nc.status} isOverdue={overdue} isEscalated={((nc as any).workflow_history || []).filter((h: any) => h.action === 'manager_declined').length >= 3} />
              <SeverityIndicator severity={nc.severity} />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="no-print"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="no-print"
              >
                <Printer className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
            <p className="text-muted-foreground mt-1">
              {NC_CATEGORY_LABELS[nc.category as keyof typeof NC_CATEGORY_LABELS]}
              {nc.category === 'other' && nc.category_other && `: ${nc.category_other}`}
            </p>
          </div>
        </div>

        {/* Workflow Progress */}
        <Card className="glass-card border-0">
          <CardContent className="py-6">
            <WorkflowProgress currentStep={nc.current_step || 1} />
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="actions">
          <TabsList>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="attachments">
              Attachments ({attachments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="mt-6">
            <NCActionPanel nc={nc} onUpdate={handleRefresh} />
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Details */}
              <Card className="glass-card-solid border-0 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="font-display">Non-Conformance Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Description
                    </h4>
                    <p className="text-foreground whitespace-pre-wrap">
                      {nc.description}
                    </p>
                  </div>

                  {nc.immediate_action && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Immediate Action Taken
                      </h4>
                      <p className="text-foreground whitespace-pre-wrap">
                        {nc.immediate_action}
                      </p>
                    </div>
                  )}

                  {nc.applicable_clauses && nc.applicable_clauses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        Applicable ISO/QMS Clauses
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {nc.applicable_clauses.map((clause: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs font-normal">
                            {clause}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Risk Assessment */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Wand2 className="h-3.5 w-3.5" />
                        AI Risk Assessment
                      </h4>
                      {(roles.includes('site_admin') || roles.includes('super_admin')) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs rounded-lg no-print"
                          onClick={handleReclassify}
                          disabled={isReclassifying}
                        >
                          {isReclassifying ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                              Reclassifying...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1.5" />
                              Reclassify
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {nc.ai_risk_assessment ? (
                      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Risk Level:</span>
                          <Badge variant="outline" className="rounded-full text-xs capitalize">
                            {nc.ai_risk_assessment.risk_level || 'N/A'}
                          </Badge>
                        </div>
                        {nc.ai_risk_assessment.category && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Category:</span>
                            <span className="font-medium">{nc.ai_risk_assessment.category}</span>
                          </div>
                        )}
                        {nc.ai_risk_assessment.suggested_owner && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Suggested Owner:</span>
                            <span className="font-medium">{nc.ai_risk_assessment.suggested_owner}</span>
                          </div>
                        )}
                        {nc.ai_risk_assessment.rationale && (
                          <div>
                            <span className="text-muted-foreground">Rationale:</span>
                            <p className="mt-1 text-foreground/80">{nc.ai_risk_assessment.rationale}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No AI assessment yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <Card className="glass-card-solid border-0">
                  <CardHeader>
                    <CardTitle className="text-base font-display">Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Reported By</p>
                        <p className="font-medium">{nc.reporter?.full_name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Responsible Person</p>
                        <p className="font-medium">{nc.responsible?.full_name}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Department</p>
                        <p className="font-medium">{nc.department?.name || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="font-medium">{nc.site_location || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Shift</p>
                        <p className="font-medium">
                          {SHIFT_LABELS[nc.shift as keyof typeof SHIFT_LABELS] || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {format(new Date(nc.created_at), 'PPp')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar className={`h-4 w-4 mt-0.5 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="text-sm text-muted-foreground">Due Date</p>
                        <p className={`font-medium ${overdue ? 'text-destructive' : ''}`}>
                          {format(new Date(nc.due_date), 'PPP')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card className="glass-card-solid border-0">
              <CardHeader>
                <CardTitle className="font-display">Activity History</CardTitle>
                <CardDescription>Complete audit trail of all actions</CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">
                    No activity recorded yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-foreground/70" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.action}</p>
                          <p className="text-sm text-muted-foreground">
                            by {activity.performer?.full_name || 'System'} •{' '}
                            {format(new Date(activity.performed_at), 'PPp')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attachments" className="mt-6">
            <Card className="glass-card-solid border-0">
              <CardHeader>
                <CardTitle className="font-display">Attachments</CardTitle>
                <CardDescription>Evidence and supporting documents</CardDescription>
              </CardHeader>
              <CardContent>
                {attachments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">
                    No attachments uploaded
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {attachments.map((attachment) => {
                      const isImage = isImageFile(attachment.file_name);
                      return (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-3 p-3 rounded-lg border"
                        >
                          {isImage ? (
                            <Image className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{attachment.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(attachment.file_size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          {isImage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openImageLightbox(attachment)}
                              title="View image"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadAttachment(attachment)}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Image Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => {
        if (!open) {
          if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);
          setLightboxUrl(null);
          setLightboxName('');
        }
      }}>
        <DialogContent className="max-w-4xl p-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 pt-1">
              <p className="text-sm font-medium truncate">{lightboxName}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);
                  setLightboxUrl(null);
                  setLightboxName('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {lightboxUrl && (
              <img
                src={lightboxUrl}
                alt={lightboxName}
                className="w-full h-auto max-h-[75vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}