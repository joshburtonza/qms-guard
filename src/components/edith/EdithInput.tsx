import { useRef, useEffect, useState, KeyboardEvent, DragEvent } from 'react';
import { Send, Loader2, Paperclip, X, FileText, Image as ImageIcon, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EdithInputProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading: boolean;
  isStreaming: boolean;
  isOffline: boolean;
  onStop?: () => void;
  placeholder?: string;
  contextLabel?: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export function EdithInput({
  onSend,
  isLoading,
  isStreaming,
  isOffline,
  onStop,
  placeholder = "Ask Edith anything...",
  contextLabel,
}: EdithInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200); // max 8 lines approx
      textarea.style.height = `${newHeight}px`;
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((trimmed || attachedFiles.length > 0) && !isLoading && !isStreaming) {
      onSend(trimmed, attachedFiles.length > 0 ? attachedFiles : undefined);
      setValue('');
      setAttachedFiles([]);
      setFileError(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const validateAndAddFiles = (files: FileList | File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Unsupported file type`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 25MB)`);
        return;
      }
      if (attachedFiles.length + validFiles.length >= 5) {
        errors.push('Maximum 5 files allowed');
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setFileError(errors[0]);
      setTimeout(() => setFileError(null), 3000);
    }

    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-3 w-3" />;
    if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') {
      return <Sheet className="h-3 w-3" />;
    }
    return <FileText className="h-3 w-3" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={cn(
        "border-t p-4 transition-colors",
        isDragging && "bg-primary/5 border-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Context indicator */}
      {contextLabel && (
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {contextLabel}
          </Badge>
        </div>
      )}

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachedFiles.map((file, index) => (
            <Badge
              key={index}
              variant="outline"
              className="flex items-center gap-1 pr-1"
            >
              {getFileIcon(file.type)}
              <span className="max-w-[100px] truncate text-xs">{file.name}</span>
              <span className="text-muted-foreground text-[10px]">
                ({formatFileSize(file.size)})
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1"
                onClick={() => removeFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* File error */}
      {fileError && (
        <p className="text-xs text-destructive mb-2">{fileError}</p>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="mb-2 p-4 border-2 border-dashed border-primary rounded-lg bg-primary/5 text-center">
          <p className="text-sm text-primary">Drop files here</p>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
        />
        
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isStreaming || isOffline || attachedFiles.length >= 5}
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading || isOffline}
          className="min-h-[40px] max-h-[200px] resize-none flex-1"
          rows={1}
        />

        {isStreaming ? (
          <Button
            onClick={onStop}
            size="icon"
            variant="destructive"
            className="shrink-0 h-10 w-10"
            title="Stop generating"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isLoading || isOffline || (!value.trim() && attachedFiles.length === 0)}
            size="icon"
            className="shrink-0 h-10 w-10"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to send,{' '}
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
