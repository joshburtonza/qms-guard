import { useNavigate } from 'react-router-dom';
import { ExternalLink, Mail, FileDown, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EdithToolCall } from '@/types/edith';

interface EdithMessageActionsProps {
  toolCalls?: EdithToolCall[];
  messageContent: string;
}

export function EdithMessageActions({ toolCalls, messageContent }: EdithMessageActionsProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewNC = (ncNumber: string) => {
    // Extract NC ID from the tool call result or navigate by number
    navigate(`/nc/list?search=${ncNumber}`);
  };

  const handleSendReminder = async (ncIds: string[]) => {
    setSendingReminder(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edith-send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: 'nc_reminder',
            ncIds,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send reminder');

      toast({
        title: 'Reminder Sent',
        description: `Sent reminders for ${ncIds.length} NC(s)`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Send',
        description: 'Could not send reminder emails',
        variant: 'destructive',
      });
    } finally {
      setSendingReminder(false);
    }
  };

  const handleExportReport = async (reportType: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edith-generate-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reportType,
            format: 'html',
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to generate report');

      const data = await response.json();
      
      // Open HTML report in new window
      if (data.html) {
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }

      toast({
        title: 'Report Generated',
        description: 'Report opened in new window',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not generate report',
        variant: 'destructive',
      });
    }
  };

  // Parse tool calls to determine available actions
  const actions: React.ReactNode[] = [];

  if (toolCalls) {
    for (const toolCall of toolCalls) {
      const args = toolCall.arguments;

      switch (toolCall.name) {
        case 'query_non_conformances':
        case 'get_nc_details':
          if (args.nc_number) {
            actions.push(
              <Button
                key={`view-${args.nc_number}`}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleViewNC(args.nc_number)}
              >
                <ExternalLink className="h-3 w-3" />
                View {args.nc_number}
              </Button>
            );
          }
          break;

        case 'create_nc':
          actions.push(
            <Button
              key="view-created-nc"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => navigate('/nc/list')}
            >
              <ExternalLink className="h-3 w-3" />
              View NC List
            </Button>
          );
          break;

        case 'generate_report':
        case 'generate_compliance_report':
          actions.push(
            <Button
              key="export-report"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => handleExportReport(args.report_type || 'nc_summary')}
            >
              <FileDown className="h-3 w-3" />
              Export Report
            </Button>
          );
          break;
      }
    }
  }

  // Check message content for NC numbers to add quick view actions
  const ncNumberMatches = messageContent.match(/NC-\w+-\d{4}-\d{2}-\d{5}/g);
  if (ncNumberMatches && ncNumberMatches.length > 0 && ncNumberMatches.length <= 3) {
    ncNumberMatches.forEach((ncNumber) => {
      if (!actions.some((a) => a && (a as any).key?.includes(ncNumber))) {
        actions.push(
          <Button
            key={`inline-view-${ncNumber}`}
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => handleViewNC(ncNumber)}
          >
            <ExternalLink className="h-3 w-3" />
            View {ncNumber}
          </Button>
        );
      }
    });
  }

  // Always show copy button for assistant messages
  actions.push(
    <Button
      key="copy"
      variant="ghost"
      size="sm"
      className="h-7 text-xs gap-1.5"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
      {actions}
    </div>
  );
}
