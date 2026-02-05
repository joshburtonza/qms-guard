import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BadgeStats {
  count: number;
  hasUrgent: boolean;
}

export function useEdithBadge() {
  const [badge, setBadge] = useState<BadgeStats>({ count: 0, hasUrgent: false });
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile?.tenant_id) {
      setBadge({ count: 0, hasUrgent: false });
      return;
    }

    const fetchBadge = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // Fetch overdue NCs count
        const { count: overdueCount } = await supabase
          .from('non_conformances')
          .select('id', { count: 'exact', head: true })
          .lt('due_date', today)
          .not('status', 'eq', 'closed');

        // Fetch critical open NCs
        const { count: criticalCount } = await supabase
          .from('non_conformances')
          .select('id', { count: 'exact', head: true })
          .eq('severity', 'critical')
          .not('status', 'eq', 'closed');

        const totalUrgent = (overdueCount || 0) + (criticalCount || 0);
        
        setBadge({
          count: totalUrgent,
          hasUrgent: (criticalCount || 0) > 0 || (overdueCount || 0) > 0,
        });
      } catch (error) {
        console.error('Failed to fetch Edith badge:', error);
      }
    };

    fetchBadge();

    // Refresh every 2 minutes
    const interval = setInterval(fetchBadge, 120000);
    
    // Subscribe to NC changes
    const channel = supabase
      .channel('edith-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'non_conformances' },
        () => fetchBadge()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user, profile?.tenant_id]);

  return badge;
}
