import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileText,
  User,
  Building,
  MapPin,
  RefreshCw,
  Printer,
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
import { supabase } from '@/integrations/supabase/client';
import { NC_CATEGORY_LABELS, SHIFT_LABELS, isOverdue } from '@/types/database';

export default function NCDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [nc, setNC] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [correctiveAction, setCorrectiveAction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  const fetchNCDetails = useCallback(async () => {
    try {
      const [ncResult, attachResult, activityResult, caResult] = await Promise.all([
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
      ]);

      if (ncResult.error) throw ncResult.error;
      setNC(ncResult.data);
      setAttachments(attachResult.data || []);
      setActivities(activityResult.data || []);
      setCorrectiveAction(caResult.data || null);
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

  const handlePrint = () => {
    setShowPrintView(true);
    // Wait for state update, then print
    setTimeout(() => {
      window.print();
      // Hide print view after printing
      setTimeout(() => setShowPrintView(false), 500);
    }, 100);
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
              <h1 className="text-2xl font-bold tracking-tight font-mono">
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
        <Card>
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
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Non-Conformance Details</CardTitle>
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
                </CardContent>
              </Card>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Information</CardTitle>
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
            <Card>
              <CardHeader>
                <CardTitle>Activity History</CardTitle>
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
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
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
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
                <CardDescription>Evidence and supporting documents</CardDescription>
              </CardHeader>
              <CardContent>
                {attachments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">
                    No attachments uploaded
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 p-3 rounded-lg border"
                      >
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{attachment.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.file_size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}