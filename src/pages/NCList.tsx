import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { NCListItem } from '@/components/nc/NCListItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { NCStatus, NC_STATUS_LABELS, NC_CATEGORY_LABELS, NCCategory } from '@/types/database';

export default function NCList() {
  const [ncs, setNCs] = useState<any[]>([]);
  const [filteredNCs, setFilteredNCs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetchNCs();
  }, []);

  useEffect(() => {
    filterNCs();
  }, [ncs, searchQuery, statusFilter, categoryFilter]);

  async function fetchNCs() {
    try {
      const { data, error } = await supabase
        .from('non_conformances')
        .select(`
          *,
          reporter:reported_by(full_name),
          responsible:responsible_person(full_name),
          department:department_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNCs(data || []);
    } catch (error) {
      console.error('Error fetching NCs:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function filterNCs() {
    let filtered = [...ncs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (nc) =>
          nc.nc_number?.toLowerCase().includes(query) ||
          nc.description?.toLowerCase().includes(query) ||
          nc.department?.name?.toLowerCase().includes(query) ||
          nc.reporter?.full_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.category === categoryFilter);
    }

    setFilteredNCs(filtered);
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Non-Conformances</h1>
            <p className="text-muted-foreground">
              {filteredNCs.length} of {ncs.length} records
            </p>
          </div>
          <Button asChild>
            <Link to="/report">
              <Plus className="mr-2 h-4 w-4" />
              Report NC
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by NC number, description, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(NC_STATUS_LABELS) as NCStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {NC_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(Object.keys(NC_CATEGORY_LABELS) as NCCategory[]).map((category) => (
                  <SelectItem key={category} value={category}>
                    {NC_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* NC List */}
        {filteredNCs.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No non-conformances found</p>
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' ? (
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild variant="link">
                <Link to="/report">Report your first NC</Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNCs.map((nc) => (
              <NCListItem key={nc.id} nc={nc} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
