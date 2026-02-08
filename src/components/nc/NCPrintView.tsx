import { format } from 'date-fns';
import {
  NC_CATEGORY_LABELS,
  NC_SEVERITY_LABELS,
  NC_STATUS_LABELS,
  SHIFT_LABELS,
} from '@/types/database';

interface NCPrintViewProps {
  nc: any;
  attachments: any[];
  activities: any[];
  correctiveAction?: any;
  tenantName?: string;
}

export function NCPrintView({
  nc,
  attachments,
  activities,
  correctiveAction,
  tenantName = 'QMS Guard',
}: NCPrintViewProps) {
  return (
    <div className="print-container p-8 max-w-4xl mx-auto bg-white text-foreground">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">{tenantName}</h1>
          <p className="text-sm text-muted-foreground">Non-Conformance Report</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-mono font-bold">{nc.nc_number}</p>
          <p className="text-sm text-muted-foreground">
            Generated: {format(new Date(), 'PPp')}
          </p>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-muted rounded-lg p-4 mb-6 flex justify-between items-center">
        <div>
          <span className="text-sm text-muted-foreground">Status:</span>
          <span className="ml-2 font-semibold">
            {NC_STATUS_LABELS[nc.status as keyof typeof NC_STATUS_LABELS]}
          </span>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Severity:</span>
          <span className="ml-2 font-semibold">
            {NC_SEVERITY_LABELS[nc.severity as keyof typeof NC_SEVERITY_LABELS]}
          </span>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Category:</span>
          <span className="ml-2 font-semibold">
            {NC_CATEGORY_LABELS[nc.category as keyof typeof NC_CATEGORY_LABELS]}
            {nc.category === 'other' && nc.category_other && `: ${nc.category_other}`}
          </span>
        </div>
      </div>

      {/* Key Information Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-primary border-b pb-1">Identification</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Department</p>
              <p className="font-medium">{nc.department?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{nc.site_location || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Shift</p>
              <p className="font-medium">
                {SHIFT_LABELS[nc.shift as keyof typeof SHIFT_LABELS] || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Date Occurred</p>
              <p className="font-medium">
                {nc.date_occurred ? format(new Date(nc.date_occurred), 'PPP') : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-primary border-b pb-1">Personnel</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Reported By</p>
              <p className="font-medium">{nc.reporter?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Responsible Person</p>
              <p className="font-medium">{nc.responsible?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {format(new Date(nc.created_at), 'PPP')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium">
                {format(new Date(nc.due_date), 'PPP')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h3 className="font-semibold text-primary border-b pb-1 mb-3">Description</h3>
        <p className="text-sm whitespace-pre-wrap">{nc.description}</p>
      </div>

      {/* Immediate Action */}
      {nc.immediate_action && (
        <div className="mb-6">
          <h3 className="font-semibold text-primary border-b pb-1 mb-3">
            Immediate Action Taken
          </h3>
          <p className="text-sm whitespace-pre-wrap">{nc.immediate_action}</p>
        </div>
      )}

      {/* Corrective Action */}
      {correctiveAction && (
        <div className="mb-6 bg-muted/50 rounded-lg p-4">
          <h3 className="font-semibold text-primary border-b pb-1 mb-3">
            Corrective Action
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground font-medium">Root Cause</p>
              <p className="whitespace-pre-wrap">{correctiveAction.root_cause}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Corrective Action</p>
              <p className="whitespace-pre-wrap">{correctiveAction.corrective_action}</p>
            </div>
            {correctiveAction.preventive_action && (
              <div>
                <p className="text-muted-foreground font-medium">Preventive Action</p>
                <p className="whitespace-pre-wrap">{correctiveAction.preventive_action}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground font-medium">Target Completion</p>
              <p>{correctiveAction.completion_date}</p>
            </div>
          </div>
        </div>
      )}

      {/* Activity History */}
      <div className="mb-6">
        <h3 className="font-semibold text-primary border-b pb-1 mb-3">
          Workflow History
        </h3>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Action</th>
                <th className="text-left py-2">By</th>
                <th className="text-left py-2">Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {activities.slice(0, 15).map((activity) => (
                <tr key={activity.id} className="border-b">
                  <td className="py-2">{activity.action}</td>
                  <td className="py-2">{activity.performer?.full_name || 'System'}</td>
                  <td className="py-2">
                    {format(new Date(activity.performed_at), 'PPp')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-primary border-b pb-1 mb-3">
            Attachments ({attachments.length})
          </h3>
          <ul className="text-sm space-y-1">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                • {attachment.file_name} ({(attachment.file_size / 1024).toFixed(0)} KB)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Signature Block */}
      <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t">
        <div>
          <div className="border-b border-foreground h-12 mb-2" />
          <p className="text-sm text-muted-foreground">Responsible Person Signature</p>
        </div>
        <div>
          <div className="border-b border-foreground h-12 mb-2" />
          <p className="text-sm text-muted-foreground">Manager Approval Signature</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
        <p>This is a system-generated report from {tenantName}</p>
        <p>Document ID: {nc.id}</p>
      </div>
    </div>
  );
}
