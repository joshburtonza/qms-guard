import { FileText, Image as ImageIcon, Sheet, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { EdithAttachment } from '@/types/edith';

interface EdithFileCardProps {
  attachment: EdithAttachment;
  variant?: 'compact' | 'full';
  showDownload?: boolean;
  className?: string;
}

export function EdithFileCard({
  attachment,
  variant = 'compact',
  showDownload = true,
  className,
}: EdithFileCardProps) {
  const { fileName, fileType, fileSize, downloadUrl } = attachment;

  const getFileIcon = () => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType === 'text/csv') {
      return <Sheet className="h-5 w-5 text-green-500" />;
    }
    if (fileType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (fileType.includes('word')) {
      return <FileText className="h-5 w-5 text-blue-600" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeLabel = () => {
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return 'Excel';
    if (fileType === 'text/csv') return 'CSV';
    if (fileType.includes('word')) return 'Word';
    if (fileType.startsWith('image/')) return 'Image';
    return 'File';
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border",
          className
        )}
      >
        {getFileIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{fileName}</p>
          <p className="text-[10px] text-muted-foreground">
            {getFileTypeLabel()} • {formatFileSize(fileSize)}
          </p>
        </div>
        {showDownload && downloadUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          {getFileIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{fileName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {getFileTypeLabel()} • {formatFileSize(fileSize)}
          </p>
        </div>
      </div>
      
      {showDownload && downloadUrl && (
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(downloadUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
