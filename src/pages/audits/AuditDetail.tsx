import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ClipboardCheck,
  ArrowLeft,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  MinusCircle,
  FileWarning,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AuditItem {
  id: string;
  item_number: number;
  requirement: string;
  evidence_required: string | null;
  finding: string | null;
  evidence_found: string | null;
  notes: string | null;
  nc_id: string | null;
}

interface Audit {
  id: string;
  checklist_number: string;
  title: string;
  description: string | null;
  iso_clause: string | null;
  audit_date: string;
  status: string;
  overall_result: string | null;
  summary_notes: string | null;
  auditor: { full_name: string } | null;
  department: { name: string } | null;
}

const FINDING_OPTIONS = [
  { value: 'conforming', label: 'Conforming', icon: CheckCircle, color: 'text-foreground' },
  { value: 'minor_nc', label: 'Minor NC', icon: AlertTriangle, color: 'text-foreground/70' },
  { value: 'major_nc', label: 'Major NC', icon: XCircle, color: 'text-destructive' },
  { value: 'opportunity', label: 'Opportunity', icon: Lightbulb, color: 'text-muted-foreground' },
  { value: 'not_applicable', label: 'N/A', icon: MinusCircle, color: 'text-muted-foreground' },
];

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [summaryNotes, setSummaryNotes] = useState('');

  useEffect(() => {
    fetchAudit();
  }, [id]);

  async function fetchAudit() {
    if (!id) return;
    setIsLoading(true);

    const [auditRes, itemsRes] = await Promise.all([
      supabase
        .from('audit_checklists')
        .select('*, auditor:profiles!audit_checklists_auditor_id_fkey(full_name), department:departments(name)')
        .eq('id', id)
        .single(),
      supabase
        .from('audit_checklist_items')
        .select('*')
        .eq('checklist_id', id)
        .order('item_number'),
    ]);

    if (auditRes.data) {
      setAudit(auditRes.data as any);
      setSummaryNotes(auditRes.data.summary_notes || '');
    }
    if (itemsRes.data) setItems(itemsRes.data as any);
    setIsLoading(false);
  }

  async function updateItem(itemId: string, field: string, value: string) {
    const { error } = await supabase
      .from('audit_checklist_items')
      .update({ [field]: value })
      .eq('id', itemId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error saving' });
    } else {
      setItems(items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
    }
  }

  async function startAudit() {
    if (!id) return;
    const { error } = await supabase
      .from('audit_checklists')
      .update({ status: 'in_progress' })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error starting audit' });
    } else {
      setAudit((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
      toast({ title: 'Audit started' });
    }
  }

  async function completeAudit() {
    if (!id) return;
    
    // Calculate overall result
    const hasMinorNC = items.some((i) => i.finding === 'minor_nc');
    const hasMajorNC = items.some((i) => i.finding === 'major_nc');
    const hasOpportunity = items.some((i) => i.finding === 'opportunity');
    
    let overall_result = 'conforming';
    if (hasMajorNC) overall_result = 'major_nc';
    else if (hasMinorNC) overall_result = 'minor_nc';
    else if (hasOpportunity) overall_result = 'opportunity';

    const { error } = await supabase
      .from('audit_checklists')
      .update({
        status: 'completed',
        overall_result,
        summary_notes: summaryNotes,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error completing audit' });
    } else {
      setAudit((prev) => (prev ? { ...prev, status: 'completed', overall_result } : null));
      toast({ title: 'Audit completed' });
    }
  }

  async function createNCFromItem(item: AuditItem) {
    if (!profile || !audit) return;

    const { data: nc, error } = await supabase
      .from('non_conformances')
      .insert({
        nc_number: '', // Will be auto-generated
        reported_by: profile.id,
        responsible_person: profile.id,
        description: `Audit finding: ${item.requirement}\n\nEvidence found: ${item.evidence_found || 'N/A'}\n\nNotes: ${item.notes || 'N/A'}`,
        severity: item.finding === 'major_nc' ? 'major' : 'minor',
        category: 'process_deviation',
        due_date: format(
          new Date(Date.now() + (item.finding === 'major_nc' ? 7 : 30) * 24 * 60 * 60 * 1000),
          'yyyy-MM-dd'
        ),
        site_location: audit.department?.name || 'Audit Finding',
        status: 'open',
        current_step: 1,
        tenant_id: profile.tenant_id,
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error creating NC' });
      return;
    }

    // Link NC to audit item
    await supabase
      .from('audit_checklist_items')
      .update({ nc_id: nc.id })
      .eq('id', item.id);

    setItems(items.map((i) => (i.id === item.id ? { ...i, nc_id: nc.id } : i)));
    toast({ title: `NC ${nc.nc_number} created from finding` });
  }

  if (isLoading || !audit) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      </AppLayout>
    );
  }

  const completedItems = items.filter((i) => i.finding).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/audits')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6" />
                {audit.checklist_number}
              </h1>
              <p className="text-muted-foreground">{audit.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {audit.status === 'draft' && (
              <Button onClick={startAudit}>
                <Play className="h-4 w-4 mr-2" />
                Start Audit
              </Button>
            )}
            {audit.status === 'in_progress' && (
              <Button onClick={completeAudit}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Audit
              </Button>
            )}
          </div>
        </div>

        {/* Audit Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Audit Date</p>
                <p className="font-medium">{format(new Date(audit.audit_date), 'dd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auditor</p>
                <p className="font-medium">{audit.auditor?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{audit.department?.name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="font-medium">
                  {completedItems} / {items.length} items
                </p>
              </div>
            </div>
            {audit.description && (
              <p className="mt-4 text-sm text-muted-foreground">{audit.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Checklist Items */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Checklist</CardTitle>
            <CardDescription>Record findings for each requirement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Item {item.item_number}</Badge>
                      {item.nc_id && (
                        <Badge variant="destructive" className="cursor-pointer" onClick={() => navigate(`/nc/${item.nc_id}`)}>
                          NC Linked
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium">{item.requirement}</p>
                    {item.evidence_required && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Evidence: {item.evidence_required}
                      </p>
                    )}
                  </div>
                  <Select
                    value={item.finding || ''}
                    onValueChange={(value) => updateItem(item.id, 'finding', value)}
                    disabled={audit.status === 'completed'}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select finding" />
                    </SelectTrigger>
                    <SelectContent>
                      {FINDING_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className={`h-4 w-4 ${opt.color}`} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Evidence Found</label>
                    <Textarea
                      placeholder="Describe the evidence reviewed..."
                      value={item.evidence_found || ''}
                      onChange={(e) => updateItem(item.id, 'evidence_found', e.target.value)}
                      disabled={audit.status === 'completed'}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <Textarea
                      placeholder="Additional observations..."
                      value={item.notes || ''}
                      onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                      disabled={audit.status === 'completed'}
                      className="mt-1"
                    />
                  </div>
                </div>

                {(item.finding === 'minor_nc' || item.finding === 'major_nc') && !item.nc_id && audit.status !== 'completed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createNCFromItem(item)}
                  >
                    <FileWarning className="h-4 w-4 mr-2" />
                    Create NC from Finding
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Summary Notes */}
        {audit.status === 'in_progress' && (
          <Card>
            <CardHeader>
              <CardTitle>Audit Summary</CardTitle>
              <CardDescription>Add overall notes and conclusions</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Summary of audit findings, recommendations, etc..."
                value={summaryNotes}
                onChange={(e) => setSummaryNotes(e.target.value)}
                className="min-h-32"
              />
            </CardContent>
          </Card>
        )}

        {audit.status === 'completed' && audit.summary_notes && (
          <Card>
            <CardHeader>
              <CardTitle>Audit Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{audit.summary_notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
