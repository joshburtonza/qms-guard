import { useNavigate } from 'react-router-dom';
import { ExternalLink, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface NCData {
  nc_number: string;
  id?: string;
  description?: string;
  status?: string;
  severity?: string;
  due_date?: string;
  overdue?: boolean;
  responsible?: string;
}

interface EdithNCReferenceProps {
  nc: NCData;
  variant?: 'inline' | 'card';
  showActions?: boolean;
  onView?: () => void;
}

export function EdithNCReference({
  nc,
  variant = 'inline',
  showActions = true,
  onView,
}: EdithNCReferenceProps) {
  const navigate = useNavigate();

  const handleView = () => {
    if (onView) {
      onView();
    } else if (nc.id) {
      navigate(`/nc/${nc.id}`);
    }
  };

  const getSeverityIcon = () => {
    switch (nc.severity) {
      case 'critical':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 'major':
        return <AlertCircle className="h-3 w-3 text-orange-500" />;
      case 'minor':
        return <Info className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityColor = () => {
    switch (nc.severity) {
      case 'critical':
        return 'destructive';
      case 'major':
        return 'default';
      case 'minor':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusColor = () => {
    switch (nc.status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'pending_review':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'pending_verification':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'closed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  if (variant === 'inline') {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-auto py-1 px-2 text-left inline-flex items-center gap-1",
          "bg-muted/50 hover:bg-muted rounded-md font-mono text-xs",
          nc.overdue && "border-l-2 border-destructive"
        )}
        onClick={handleView}
      >
        {getSeverityIcon()}
        <span className="font-medium">{nc.nc_number}</span>
        {nc.status && (
          <Badge variant="secondary" className={cn("text-[10px] ml-1", getStatusColor())}>
            {formatStatus(nc.status)}
          </Badge>
        )}
        {nc.overdue && (
          <Badge variant="destructive" className="text-[10px] ml-1">
            Overdue
          </Badge>
        )}
        {showActions && <ExternalLink className="h-3 w-3 ml-1 opacity-50" />}
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
        nc.overdue && "border-l-2 border-destructive"
      )}
      onClick={handleView}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {getSeverityIcon()}
          <span className="font-mono font-medium text-sm">{nc.nc_number}</span>
        </div>
        <div className="flex items-center gap-1">
          {nc.severity && (
            <Badge variant={getSeverityColor() as any} className="text-[10px]">
              {nc.severity}
            </Badge>
          )}
          {nc.overdue && (
            <Badge variant="destructive" className="text-[10px]">
              Overdue
            </Badge>
          )}
        </div>
      </div>
      
      {nc.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {nc.description}
        </p>
      )}
      
      <div className="flex items-center justify-between mt-2">
        {nc.status && (
          <Badge variant="secondary" className={cn("text-[10px]", getStatusColor())}>
            {formatStatus(nc.status)}
          </Badge>
        )}
        {nc.due_date && (
          <span className="text-[10px] text-muted-foreground">
            Due: {new Date(nc.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
      
      {nc.responsible && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Assigned: {nc.responsible}
        </p>
      )}
    </Card>
  );
}
