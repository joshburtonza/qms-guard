import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { AlertTriangle, AlertOctagon, Siren, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EscalationPanelProps {
  ncs: any[];
}

interface EscalationTier {
  label: string;
  minDays: number;
  maxDays: number | null;
  icon: React.ElementType;
  badgeClass: string;
  headerClass: string;
  rowHoverClass: string;
}

const TIERS: EscalationTier[] = [
  {
    label: 'Critical',
    minDays: 14,
    maxDays: null,
    icon: Siren,
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    headerClass: 'text-purple-700 dark:text-purple-400',
    rowHoverClass: 'hover:bg-purple-50/50 dark:hover:bg-purple-900/10',
  },
  {
    label: 'Escalated',
    minDays: 7,
    maxDays: 13,
    icon: AlertOctagon,
    badgeClass: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    headerClass: 'text-red-700 dark:text-red-400',
    rowHoverClass: 'hover:bg-red-50/50 dark:hover:bg-red-900/10',
  },
  {
    label: 'Overdue',
    minDays: 1,
    maxDays: 6,
    icon: AlertTriangle,
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    headerClass: 'text-amber-700 dark:text-amber-400',
    rowHoverClass: 'hover:bg-amber-50/50 dark:hover:bg-amber-900/10',
  },
];

export function EscalationPanel({ ncs }: EscalationPanelProps) {
  const [openTiers, setOpenTiers] = useState<Record<string, boolean>>({
    Critical: true,
    Escalated: true,
    Overdue: false,
  });

  const tieredNCs = useMemo(() => {
    const today = new Date();

    const overdueNCs = ncs
      .filter((nc) => {
        if (!nc.due_date || nc.status === 'closed' || nc.status === 'rejected') return false;
        const days = differenceInDays(today, new Date(nc.due_date));
        return days >= 1;
      })
      .map((nc) => ({
        ...nc,
        daysOverdue: differenceInDays(today, new Date(nc.due_date)),
      }));

    return TIERS.map((tier) => ({
      tier,
      items: overdueNCs.filter((nc) => {
        if (tier.maxDays === null) return nc.daysOverdue >= tier.minDays;
        return nc.daysOverdue >= tier.minDays && nc.daysOverdue <= tier.maxDays;
      }),
    }));
  }, [ncs]);

  const totalOverdue = tieredNCs.reduce((sum, t) => sum + t.items.length, 0);

  const toggleTier = (label: string) => {
    setOpenTiers((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  if (totalOverdue === 0) {
    return (
      <Card className="glass-card-solid border-0">
        <CardContent className="flex items-center gap-3 py-5">
          <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-display font-semibold text-green-700 dark:text-green-400">All NCs on track</p>
            <p className="text-sm text-muted-foreground">No overdue non-conformances at this time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Escalation Monitor</h2>
        <Badge variant="outline" className="rounded-full text-xs">
          {totalOverdue} overdue
        </Badge>
      </div>

      {tieredNCs.map(({ tier, items }) => {
        if (items.length === 0) return null;
        const Icon = tier.icon;
        const isOpen = openTiers[tier.label];

        return (
          <Card key={tier.label} className="glass-card-solid border-0 overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={() => toggleTier(tier.label)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none py-3 px-4 flex-row items-center justify-between space-y-0">
                  <CardTitle className={`flex items-center gap-2 text-sm font-semibold ${tier.headerClass}`}>
                    <Icon className="h-4 w-4" />
                    Tier {TIERS.indexOf(tier) === 0 ? 3 : TIERS.indexOf(tier) === 1 ? 2 : 1} — {tier.label}
                    <Badge className={`ml-1 rounded-full text-xs border ${tier.badgeClass}`}>
                      {items.length}
                    </Badge>
                  </CardTitle>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="p-0 pb-1">
                  <div className="divide-y divide-border/40">
                    {items.map((nc) => (
                      <Link
                        key={nc.id}
                        to={`/nc/${nc.id}`}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${tier.rowHoverClass}`}
                      >
                        <span className="font-mono text-xs font-semibold text-foreground/80 w-24 flex-shrink-0">
                          {nc.nc_number}
                        </span>
                        <span className="text-sm text-muted-foreground flex-1 truncate">
                          {nc.description?.length > 60
                            ? nc.description.slice(0, 60) + '…'
                            : nc.description}
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:block w-28 flex-shrink-0 truncate">
                          {nc.responsible?.full_name || nc.responsible_person_profile?.full_name || 'Unassigned'}
                        </span>
                        <Badge className={`rounded-full text-xs border flex-shrink-0 ${tier.badgeClass}`}>
                          {nc.daysOverdue}d
                        </Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
