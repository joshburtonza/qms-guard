import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Plus, Search, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface LearnerRow {
  id: string;
  learner_number: string;
  full_name: string;
  id_number: string | null;
  email: string | null;
  phone: string | null;
  _doc_total: number;
  _doc_present: number;
  _doc_unclear: number;
  _doc_missing: number;
}

export default function LearnerList() {
  const navigate = useNavigate();
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLearners();
  }, []);

  async function fetchLearners() {
    setIsLoading(true);

    const { data: learnersData, error } = await supabase
      .from('learners')
      .select('*, learner_documents(status)')
      .order('learner_number', { ascending: true });

    if (error) {
      console.error('Error fetching learners:', error);
      setIsLoading(false);
      return;
    }

    const rows: LearnerRow[] = (learnersData || []).map((l: any) => {
      const docs: { status: string }[] = l.learner_documents || [];
      return {
        id: l.id,
        learner_number: l.learner_number,
        full_name: l.full_name,
        id_number: l.id_number,
        email: l.email,
        phone: l.phone,
        _doc_total: docs.length,
        _doc_present: docs.filter((d) => d.status === 'present').length,
        _doc_unclear: docs.filter((d) => d.status === 'unclear').length,
        _doc_missing: docs.filter((d) => d.status === 'missing').length,
      };
    });

    setLearners(rows);
    setIsLoading(false);
  }

  const filtered = learners.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.learner_number.toLowerCase().includes(q) ||
      l.full_name.toLowerCase().includes(q) ||
      (l.id_number || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (learner: LearnerRow) => {
    if (learner._doc_missing > 0) return <Badge variant="destructive">{learner._doc_missing} Missing</Badge>;
    if (learner._doc_unclear > 0) return <Badge variant="secondary">{learner._doc_unclear} Unclear</Badge>;
    if (learner._doc_total === 0) return <Badge variant="outline">No Docs</Badge>;
    return <Badge className="bg-foreground text-background">Complete</Badge>;
  };

  const stats = {
    total: learners.length,
    complete: learners.filter((l) => l._doc_missing === 0 && l._doc_unclear === 0 && l._doc_total > 0).length,
    unclear: learners.filter((l) => l._doc_missing === 0 && l._doc_unclear > 0).length,
    missing: learners.filter((l) => l._doc_missing > 0).length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              Learners
            </h1>
            <p className="text-muted-foreground text-sm">{filtered.length} of {learners.length} learners</p>
          </div>
          <Button size="sm" onClick={() => navigate('/learners/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Learner
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <GraduationCap className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Complete</p>
                  <p className="text-2xl font-bold">{stats.complete}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unclear</p>
                  <p className="text-2xl font-bold">{stats.unclear}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card-solid border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missing Docs</p>
                  <p className="text-2xl font-bold">{stats.missing}</p>
                </div>
                <XCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass-card-solid border-0 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, learner number, ID or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="glass-card-solid border-0 p-12 text-center">
            <p className="text-muted-foreground">No learners found</p>
            {searchQuery ? (
              <Button variant="link" onClick={() => setSearchQuery('')}>Clear search</Button>
            ) : (
              <Button variant="link" onClick={() => navigate('/learners/new')}>Add your first learner</Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((learner) => (
              <Card
                key={learner.id}
                className="glass-card-solid border-0 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => navigate(`/learners/${learner.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-foreground/10 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-5 w-5 text-foreground/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{learner.full_name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{learner.learner_number}</p>
                        {learner.id_number && (
                          <p className="text-xs text-muted-foreground">ID: {learner.id_number}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">
                          {learner._doc_present}/{learner._doc_total} docs
                        </p>
                        {learner.email && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{learner.email}</p>
                        )}
                      </div>
                      {getStatusBadge(learner)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
