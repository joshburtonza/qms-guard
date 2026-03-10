import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft, CheckCircle, AlertTriangle, XCircle, Plus, Save, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Learner {
  id: string;
  learner_number: string;
  full_name: string;
  id_number: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tenant_id: string;
}

interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  display_order: number;
}

interface LearnerDocument {
  id: string;
  document_type_id: string;
  document_name: string;
  status: 'present' | 'unclear' | 'missing';
  notes: string | null;
  file_url: string | null;
  uploaded_at: string;
}

const STATUS_CONFIG = {
  present: { label: 'Present', icon: CheckCircle, color: 'text-foreground', badgeClass: 'bg-foreground text-background' },
  unclear: { label: 'Unclear', icon: AlertTriangle, color: 'text-muted-foreground', badgeClass: '' },
  missing: { label: 'Missing', icon: XCircle, color: 'text-destructive', badgeClass: 'destructive' },
};

export default function LearnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [learner, setLearner] = useState<Learner | null>(null);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<LearnerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocTypeId, setNewDocTypeId] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocStatus, setNewDocStatus] = useState<'present' | 'unclear' | 'missing'>('present');
  const [newDocNotes, setNewDocNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (id) fetchAll(id);
  }, [id]);

  async function fetchAll(learnerId: string) {
    setIsLoading(true);
    const [learnerRes, docTypesRes, docsRes] = await Promise.all([
      supabase.from('learners').select('*').eq('id', learnerId).single(),
      supabase.from('learner_document_types').select('*').order('display_order'),
      supabase.from('learner_documents').select('*').eq('learner_id', learnerId),
    ]);

    if (learnerRes.data) setLearner(learnerRes.data);
    if (docTypesRes.data) setDocTypes(docTypesRes.data);
    if (docsRes.data) setDocuments(docsRes.data as LearnerDocument[]);
    setIsLoading(false);
  }

  async function updateDocStatus(doc: LearnerDocument, newStatus: 'present' | 'unclear' | 'missing') {
    setSavingId(doc.id);
    const { error } = await supabase
      .from('learner_documents')
      .update({ status: newStatus })
      .eq('id', doc.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    } else {
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: newStatus } : d));
    }
    setSavingId(null);
  }

  async function updateDocNotes(doc: LearnerDocument, notes: string) {
    const { error } = await supabase
      .from('learner_documents')
      .update({ notes })
      .eq('id', doc.id);
    if (!error) {
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, notes } : d));
    }
  }

  async function addDocument() {
    if (!learner || !newDocTypeId || !newDocName.trim()) return;
    setIsAdding(true);
    const { data, error } = await supabase
      .from('learner_documents')
      .insert({
        learner_id: learner.id,
        tenant_id: learner.tenant_id,
        document_type_id: newDocTypeId,
        document_name: newDocName.trim(),
        status: newDocStatus,
        notes: newDocNotes.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to add document', description: error.message });
    } else {
      setDocuments((prev) => [...prev, data as LearnerDocument]);
      setShowAddDoc(false);
      setNewDocTypeId('');
      setNewDocName('');
      setNewDocStatus('present');
      setNewDocNotes('');
      toast({ title: 'Document added' });
    }
    setIsAdding(false);
  }

  async function removeDocument(docId: string) {
    const { error } = await supabase.from('learner_documents').delete().eq('id', docId);
    if (!error) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast({ title: 'Document removed' });
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!learner) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Learner not found.</p>
          <Button variant="link" onClick={() => navigate('/learners')}>Back to Learners</Button>
        </div>
      </AppLayout>
    );
  }

  const docMap = new Map(documents.map((d) => [d.document_type_id, d]));
  const totalRequired = docTypes.filter((dt) => dt.is_required).length;
  const presentCount = documents.filter((d) => d.status === 'present').length;
  const missingCount = documents.filter((d) => d.status === 'missing').length;
  const unclearCount = documents.filter((d) => d.status === 'unclear').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/learners')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">{learner.full_name}</h1>
            <p className="text-muted-foreground text-sm font-mono">{learner.learner_number}</p>
          </div>
        </div>

        {/* Info + Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="text-base">Learner Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {learner.id_number && <div><span className="text-muted-foreground">ID Number: </span>{learner.id_number}</div>}
              {learner.email && <div><span className="text-muted-foreground">Email: </span>{learner.email}</div>}
              {learner.phone && <div><span className="text-muted-foreground">Phone: </span>{learner.phone}</div>}
              {learner.notes && <div><span className="text-muted-foreground">Notes: </span>{learner.notes}</div>}
            </CardContent>
          </Card>

          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="text-base">Document Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{presentCount}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{unclearCount}</p>
                  <p className="text-xs text-muted-foreground">Unclear</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{missingCount}</p>
                  <p className="text-xs text-muted-foreground">Missing</p>
                </div>
              </div>
              <div className="mt-3 text-center text-xs text-muted-foreground">
                {presentCount} of {totalRequired} required docs confirmed
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Document Checklist */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Document Checklist</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddDoc(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>

        <div className="space-y-3">
          {docTypes.map((docType) => {
            const doc = docMap.get(docType.id);
            const StatusIcon = doc ? STATUS_CONFIG[doc.status].icon : XCircle;

            return (
              <Card key={docType.id} className="glass-card-solid border-0">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <StatusIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${doc ? STATUS_CONFIG[doc.status].color : 'text-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{docType.name}</p>
                          {docType.is_required && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                        </div>
                        {docType.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{docType.description}</p>
                        )}
                        {doc?.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc ? (
                        <>
                          <Select
                            value={doc.status}
                            onValueChange={(val) => updateDocStatus(doc, val as any)}
                            disabled={savingId === doc.id}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="unclear">Unclear</SelectItem>
                              <SelectItem value="missing">Missing</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Not recorded</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add Document Dialog */}
      <Dialog open={showAddDoc} onOpenChange={setShowAddDoc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={newDocTypeId} onValueChange={setNewDocTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {docTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Document Name / Reference</Label>
              <Input
                placeholder="e.g. John Smith ID Copy"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newDocStatus} onValueChange={(v) => setNewDocStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="unclear">Unclear</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this document..."
                value={newDocNotes}
                onChange={(e) => setNewDocNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDoc(false)}>Cancel</Button>
            <Button onClick={addDocument} disabled={isAdding || !newDocTypeId || !newDocName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
