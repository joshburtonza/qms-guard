import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface NCContext {
  ncId: string | null;
  ncNumber: string | null;
  ncDescription: string | null;
  ncStatus: string | null;
  ncSeverity: string | null;
  isOnNCPage: boolean;
}

export function useEdithNCContext(): NCContext {
  const location = useLocation();
  const [ncContext, setNCContext] = useState<NCContext>({
    ncId: null,
    ncNumber: null,
    ncDescription: null,
    ncStatus: null,
    ncSeverity: null,
    isOnNCPage: false,
  });

  useEffect(() => {
    // Check if we're on an NC detail page
    const ncDetailMatch = location.pathname.match(/^\/nc\/([a-f0-9-]+)$/i);
    
    if (ncDetailMatch) {
      const ncId = ncDetailMatch[1];
      
      // Fetch NC details
      const fetchNC = async () => {
        const { data, error } = await supabase
          .from('non_conformances')
          .select('id, nc_number, description, status, severity')
          .eq('id', ncId)
          .single();

        if (!error && data) {
          setNCContext({
            ncId: data.id,
            ncNumber: data.nc_number,
            ncDescription: data.description?.substring(0, 100) + (data.description?.length > 100 ? '...' : ''),
            ncStatus: data.status,
            ncSeverity: data.severity,
            isOnNCPage: true,
          });
        }
      };

      fetchNC();
    } else {
      setNCContext({
        ncId: null,
        ncNumber: null,
        ncDescription: null,
        ncStatus: null,
        ncSeverity: null,
        isOnNCPage: false,
      });
    }
  }, [location.pathname]);

  return ncContext;
}
