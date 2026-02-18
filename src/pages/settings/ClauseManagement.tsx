import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, BookOpen, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

interface ClauseRow {
  edith_number: string;
  clause_number: string;
  clause_title: string;
  section_number: string | null;
  section_title: string | null;
  iso_standard_version: string;
}

interface ClauseVersion {
  id: string;
  edith_number: string;
  iso_version: string;
  clause_number: string;
  clause_title: string;
  active: boolean;
}

export default function ClauseManagement() {
  const navigate = useNavigate();
  const { profile, roles } = useAuth();
  const [clauses, setClauses] = useState<ClauseRow[]>([]);
  const [versions, setVersions] = useState<ClauseVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [selectedEdithNumber, setSelectedEdithNumber] = useState('');
  const [newVersion, setNewVersion] = useState({ iso_version: '', clause_number: '', clause_title: '' });

  const isAdmin = roles.includes('super_admin') || roles.includes('site_admin');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [clausesRes, versionsRes] = await Promise.all([
      supabase
        .from('edith_iso_knowledge')
        .select('edith_number, clause_number, clause_title, section_number, section_title, iso_standard_version')
        .order('edith_number'),
      supabase
        .from('iso_clause_versions')
        .select('*')
        .order('edith_number'),
    ]);

    if (clausesRes.data) setClauses(clausesRes.data);
    if (versionsRes.data) setVersions(versionsRes.data as ClauseVersion[]);
    setIsLoading(false);
  };

  const getDisplayClause = (edithNum: string) => {
    const activeVersion = versions.find(v => v.edith_number === edithNum && v.active);
    if (activeVersion) return { number: activeVersion.clause_number, title: activeVersion.clause_title };
    const clause = clauses.find(c => c.edith_number === edithNum);
    if (!clause) return { number: '—', title: '—' };
    return {
      number: clause.section_number || clause.clause_number,
      title: clause.section_title || clause.clause_title,
    };
  };

  const getVersionsForClause = (edithNum: string) => {
    return versions.filter(v => v.edith_number === edithNum);
  };

  const handleAddVersion = async () => {
    if (!newVersion.iso_version || !newVersion.clause_number || !newVersion.clause_title) {
      toast({ title: 'Missing fields', description: 'All fields are required.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('iso_clause_versions')
      .insert({
        edith_number: selectedEdithNumber,
        iso_version: newVersion.iso_version,
        clause_number: newVersion.clause_number,
        clause_title: newVersion.clause_title,
        active: false,
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Version added', description: `New mapping added for ${selectedEdithNumber}` });
    setShowAddVersion(false);
    setNewVersion({ iso_version: '', clause_number: '', clause_title: '' });
    loadData();
  };

  const handleToggleActive = async (version: ClauseVersion) => {
    if (version.active) {
      // Deactivate
      await supabase.from('iso_clause_versions').update({ active: false }).eq('id', version.id);
    } else {
      // Deactivate others for this edith_number, activate this one
      await supabase
        .from('iso_clause_versions')
        .update({ active: false })
        .eq('edith_number', version.edith_number);
      await supabase
        .from('iso_clause_versions')
        .update({ active: true })
        .eq('id', version.id);
    }
    loadData();
    toast({ title: 'Version toggled', description: `${version.edith_number} active version updated.` });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                Clause Management
              </h1>
              <p className="text-muted-foreground">
                Manage Edith Numbers and ISO clause version mappings
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Info card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About Edith Numbers</CardTitle>
            <CardDescription>
              Edith Numbers (E001, E002, etc.) are stable internal references that map to ISO clause numbers.
              When ISO standards update, you add new version mappings without changing historical NC records.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Clause table */}
        <Card>
          <CardHeader>
            <CardTitle>ISO 9001 Clause Mappings</CardTitle>
            <CardDescription>
              {clauses.length} clauses mapped · Active version: ISO 9001:2015
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Edith #</TableHead>
                    <TableHead className="w-28">ISO Clause</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-24">Version</TableHead>
                    <TableHead className="w-24">Mappings</TableHead>
                    {isAdmin && <TableHead className="w-20">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clauses.map((clause) => {
                    const display = getDisplayClause(clause.edith_number);
                    const clauseVersions = getVersionsForClause(clause.edith_number);
                    return (
                      <TableRow key={clause.edith_number}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {clause.edith_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {display.number}
                        </TableCell>
                        <TableCell className="text-sm">
                          {display.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {clause.iso_standard_version}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {clauseVersions.length} ver.
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEdithNumber(clause.edith_number);
                                setShowAddVersion(true);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Version history */}
        {versions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Version Mappings</CardTitle>
              <CardDescription>
                All ISO version mappings across standards. Toggle active to switch which version is displayed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Edith #</TableHead>
                      <TableHead className="w-24">ISO Ver.</TableHead>
                      <TableHead className="w-28">Clause #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-20">Active</TableHead>
                      {isAdmin && <TableHead className="w-20">Toggle</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {version.edith_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{version.iso_version}</TableCell>
                        <TableCell className="font-mono text-sm">{version.clause_number}</TableCell>
                        <TableCell className="text-sm">{version.clause_title}</TableCell>
                        <TableCell>
                          {version.active ? (
                            <Badge className="bg-primary text-primary-foreground">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(version)}
                            >
                              {version.active ? (
                                <ToggleRight className="h-4 w-4 text-primary" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Version Dialog */}
      <Dialog open={showAddVersion} onOpenChange={setShowAddVersion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Version Mapping for {selectedEdithNumber}</DialogTitle>
            <DialogDescription>
              Map this Edith Number to a clause in a different ISO standard version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ISO Version</Label>
              <Input
                placeholder="e.g., 2025"
                value={newVersion.iso_version}
                onChange={(e) => setNewVersion(prev => ({ ...prev, iso_version: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Clause Number</Label>
              <Input
                placeholder="e.g., 7.1.2"
                value={newVersion.clause_number}
                onChange={(e) => setNewVersion(prev => ({ ...prev, clause_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Clause Title</Label>
              <Input
                placeholder="e.g., Infrastructure"
                value={newVersion.clause_title}
                onChange={(e) => setNewVersion(prev => ({ ...prev, clause_title: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVersion(false)}>Cancel</Button>
            <Button onClick={handleAddVersion}>Add Mapping</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
