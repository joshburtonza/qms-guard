import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle, AlertTriangle, XCircle, GraduationCap, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DocumentType {
  id: string;
  name: string;
  is_required: boolean;
  display_order: number;
}

interface LearnerDoc {
  document_type_id: string;
  status: 'present' | 'unclear' | 'missing';
}

interface LearnerRow {
  id: string;
  learner_number: string;
  full_name: string;
  id_number: string | null;
  docs: Map<string, LearnerDoc>;
  completionPct: number;
  hasIssues: boolean;
  enrollments: string[];
}

type FilterMode = 'all' | 'complete' | 'issues' | 'missing';

export default function LearnerAuditReport() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setIsLoading(true);
    try {
      const [dtRes, learnersRes, docsRes, enrollmentsRes] = await Promise.all([
        supabase.from('learner_document_types').select('*').order('display_order'),
        supabase.from('learners').select('id, learner_number, full_name, id_number').order('learner_number'),
        supabase.from('learner_documents').select('learner_id, document_type_id, status'),
        (supabase.from('learner_enrollments' as any) as any).select('learner_id, courses(title)'),
      ]);

      if (dtRes.error) throw new Error(`Document types: ${dtRes.error.message}`);
      if (learnersRes.error) throw new Error(`Learners: ${learnersRes.error.message}`);
      if (docsRes.error) throw new Error(`Documents: ${docsRes.error.message}`);
      if (enrollmentsRes.error) throw new Error(`Enrolments: ${enrollmentsRes.error.message}`);

      const types: DocumentType[] = dtRes.data ?? [];
      setDocTypes(types);

      const docsByLearner = new Map<string, LearnerDoc[]>();
      for (const d of (docsRes.data ?? []) as any[]) {
        if (!docsByLearner.has(d.learner_id)) docsByLearner.set(d.learner_id, []);
        docsByLearner.get(d.learner_id)!.push(d);
      }

      const enrollmentsByLearner = new Map<string, string[]>();
      for (const e of (enrollmentsRes.data ?? []) as any[]) {
        if (!enrollmentsByLearner.has(e.learner_id)) enrollmentsByLearner.set(e.learner_id, []);
        if (e.courses?.title) enrollmentsByLearner.get(e.learner_id)!.push(e.courses.title);
      }

      const required = types.filter((t) => t.is_required);
      const rows: LearnerRow[] = (learnersRes.data ?? []).map((l: any) => {
        const lDocs = docsByLearner.get(l.id) ?? [];
        const docMap = new Map(lDocs.map((d) => [d.document_type_id, d]));
        const presentRequired = required.filter((t) => docMap.get(t.id)?.status === 'present').length;
        const completionPct = required.length > 0 ? Math.round((presentRequired / required.length) * 100) : 0;
        const hasIssues = lDocs.some((d) => d.status === 'missing' || d.status === 'unclear');

        return {
          id: l.id,
          learner_number: l.learner_number,
          full_name: l.full_name,
          id_number: l.id_number,
          docs: docMap,
          completionPct,
          hasIssues,
          enrollments: enrollmentsByLearner.get(l.id) ?? [],
        };
      });

      setLearners(rows);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Failed to load audit data',
        description: e instanceof Error ? e.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function exportCsv() {
    let objectUrl: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const allTypes = docTypes;
      const headers = [
        'Learner Number',
        'Full Name',
        'ID Number',
        'Programmes',
        'Completion %',
        ...allTypes.map((t) => t.name + (t.is_required ? ' *' : '')),
        'Overall Status',
      ];

      const csvRows = filtered.map((l) => {
        const status = l.completionPct === 100 ? 'Complete' : l.hasIssues ? 'Issues' : 'Incomplete';
        return [
          l.learner_number,
          l.full_name,
          l.id_number ?? '',
          l.enrollments.join('; '),
          `${l.completionPct}%`,
          ...allTypes.map((t) => {
            const d = l.docs.get(t.id);
            if (!d) return 'Not Recorded';
            return d.status.charAt(0).toUpperCase() + d.status.slice(1);
          }),
          status,
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csv = [headers.map((h) => `"${h}"`).join(','), ...csvRows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
      objectUrl = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', `BBB_Learner_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch {
      toast({ variant: 'destructive', title: 'Export failed', description: 'Could not generate the CSV file.' });
    } finally {
      if (link && document.body.contains(link)) document.body.removeChild(link);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  const filtered = learners.filter((l) => {
    if (filter === 'complete') return l.completionPct === 100 && !l.hasIssues;
    if (filter === 'issues') return l.hasIssues;
    if (filter === 'missing') return l.docs.size === 0;
    return true;
  });

  const stats = {
    total: learners.length,
    complete: learners.filter((l) => l.completionPct === 100 && !l.hasIssues).length,
    issues: learners.filter((l) => l.hasIssues).length,
    avgCompletion: learners.length > 0
      ? Math.round(learners.reduce((s, l) => s + l.completionPct, 0) / learners.length)
      : 0,
  };

  const requiredTypes = docTypes.filter((t) => t.is_required);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/learners')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">BBB Self-Audit Report</h1>
            <p className="text-muted-foreground text-sm">Document compliance overview for all learners</p>
          </div>
          <Button size="sm" onClick={exportCsv} disabled={isLoading || learners.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Learners</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Fully Compliant</p>
              <p className="text-2xl font-bold">{stats.complete}</p>
            </CardContent>
          </Card>
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">With Issues</p>
              <p className="text-2xl font-bold text-destructive">{stats.issues}</p>
            </CardContent>
          </Card>
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Avg. Completion</p>
              <p className="text-2xl font-bold">{stats.avgCompletion}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Learners</SelectItem>
              <SelectItem value="complete">Fully Compliant</SelectItem>
              <SelectItem value="issues">Issues Only</SelectItem>
              <SelectItem value="missing">No Docs Recorded</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} learner{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Audit List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="glass-card-solid border-0 p-12 text-center">
            <p className="text-muted-foreground">No learners match this filter.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((learner) => {
              const missingRequired = requiredTypes.filter((t) => {
                const d = learner.docs.get(t.id);
                return !d || d.status !== 'present';
              });
              const allPresent = missingRequired.length === 0;

              return (
                <Card
                  key={learner.id}
                  className="glass-card-solid border-0 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => navigate(`/learners/${learner.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Learner header row */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-foreground/10 flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="h-4 w-4 text-foreground/60" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{learner.full_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{learner.learner_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-semibold">{learner.completionPct}%</span>
                          {allPresent ? (
                            <Badge className="bg-foreground text-background text-xs">Complete</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">{missingRequired.length} Missing</Badge>
                          )}
                        </div>
                      </div>

                      {/* Programmes */}
                      {learner.enrollments.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {learner.enrollments.map((prog, idx) => (
                            <Badge key={`${prog}-${idx}`} variant="outline" className="text-xs font-normal">{prog}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Doc status chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {docTypes.map((dt) => {
                          const d = learner.docs.get(dt.id);
                          const s = d?.status;
                          return (
                            <span
                              key={dt.id}
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                                s === 'present'
                                  ? 'border-foreground/20 text-foreground/70'
                                  : s === 'unclear'
                                  ? 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400'
                                  : 'border-destructive/40 text-destructive'
                              }`}
                            >
                              {s === 'present' ? (
                                <CheckCircle className="h-2.5 w-2.5" />
                              ) : s === 'unclear' ? (
                                <AlertTriangle className="h-2.5 w-2.5" />
                              ) : (
                                <XCircle className="h-2.5 w-2.5" />
                              )}
                              {dt.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {!isLoading && learners.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pb-4">
            * Required: {requiredTypes.map((t) => t.name).join(', ')}. Export CSV for full BBB audit trail.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
