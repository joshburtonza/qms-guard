import { format } from 'date-fns';
import { Shield } from 'lucide-react';
import {
  NC_CATEGORY_LABELS,
  NC_SEVERITY_LABELS,
  NC_SOURCE_LABELS,
  NC_STATUS_LABELS,
  SHIFT_LABELS,
} from '@/types/database';

const RISK_CLASSIFICATION_LABELS: Record<string, string> = {
  observation: 'Observation',
  ofi: 'Opportunity for Improvement (OFI)',
  minor: 'Minor NC',
  major: 'Major NC',
};

// Ascend LC brand colour used in the PDF header
const ASCEND_BRAND_COLOR = '#1B2A4A';

interface NCPrintViewProps {
  nc: any;
  attachments: any[];
  activities: any[];
  correctiveAction?: any;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  workflowApprovals?: any[];
}

export function NCPrintView({
  nc,
  attachments,
  activities,
  correctiveAction,
  tenantName,
  tenantLogoUrl,
  workflowApprovals = [],
}: NCPrintViewProps) {
  // Extract signatures from workflow_approvals
  const rpApproval = [...workflowApprovals]
    .filter((a) => a.step === 3 && a.action === 'rp_submitted')
    .sort((a, b) => new Date(b.approved_at || 0).getTime() - new Date(a.approved_at || 0).getTime())[0];
  const managerApproval = [...workflowApprovals]
    .filter((a) => a.action === 'approved')
    .sort((a, b) => new Date(b.approved_at || 0).getTime() - new Date(a.approved_at || 0).getTime())[0];

  const showClientBranding = tenantLogoUrl || tenantName;

  return (
    <div className="print-container p-8 max-w-4xl mx-auto bg-background text-foreground">
      {/* Header */}
      <div className="pb-4 mb-6" style={{ borderBottom: `2px solid ${ASCEND_BRAND_COLOR}` }}>
        <div className="flex justify-between items-start">
          {/* Ascend LC — QMS owner branding (always present) */}
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: ASCEND_BRAND_COLOR,
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              } as React.CSSProperties}
            >
              <Shield className="h-5 w-5" style={{ color: 'white' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-widest">ASCEND LC</h1>
              <p className="text-xs" style={{ color: '#666' }}>Quality Management System</p>
            </div>
          </div>

          {/* NC identifier */}
          <div className="text-right">
            <p className="text-xl font-mono font-bold">{nc.nc_number}</p>
            <p className="text-sm" style={{ color: '#555' }}>Non-Conformance Report</p>
            <p className="text-xs" style={{ color: '#888' }}>
              Generated: {format(new Date(), 'PPp')}
            </p>
          </div>
        </div>

        {/* End-client branding (when tenant logo or name is available) */}
        {showClientBranding && (
          <div
            className="mt-3 pt-3 flex items-center gap-2"
            style={{ borderTop: '1px solid #e5e7eb' }}
          >
            <span className="text-xs" style={{ color: '#888' }}>Client:</span>
            {tenantLogoUrl && (
              <img
                src={tenantLogoUrl}
                alt={tenantName || 'Client'}
                className="h-7 object-contain object-left"
                style={{ maxWidth: '150px' }}
              />
            )}
            {tenantName && (
              <span className="text-sm font-semibold">{tenantName}</span>
            )}
          </div>
        )}
      </div>

      {/* Status Banner */}
      <div className="bg-muted rounded-lg p-4 mb-6 grid grid-cols-2 gap-3 sm:flex sm:justify-between sm:items-center">
        <div>
          <span className="text-sm text-muted-foreground">Status:</span>
          <span className="ml-2 font-semibold">
            {NC_STATUS_LABELS[nc.status as keyof typeof NC_STATUS_LABELS]}
          </span>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Classification:</span>
          <span className="ml-2 font-semibold">
            {nc.risk_classification
              ? (RISK_CLASSIFICATION_LABELS[nc.risk_classification] || nc.risk_classification)
              : 'Pending QA Classification'}
          </span>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Severity (Ref):</span>
          <span className="ml-2 font-semibold">
            {NC_SEVERITY_LABELS[nc.severity as keyof typeof NC_SEVERITY_LABELS] || nc.severity}
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
          <h3 className="font-semibold text-foreground border-b pb-1">Identification</h3>
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
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="font-medium">
                {nc.source
                  ? NC_SOURCE_LABELS[nc.source as keyof typeof NC_SOURCE_LABELS] || nc.source
                  : 'N/A'}
                {nc.source === 'other' && nc.source_other ? `: ${nc.source_other}` : ''}
              </p>
            </div>
            {nc.applicable_clauses && nc.applicable_clauses.length > 0 && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Applicable ISO/QMS Clauses</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {nc.applicable_clauses.map((clause: string, i: number) => (
                    <span
                      key={i}
                      className="text-xs border border-foreground/20 rounded px-2 py-0.5"
                    >
                      {clause}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-foreground border-b pb-1">Personnel</h3>
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
        <h3 className="font-semibold text-foreground border-b pb-1 mb-3">Description</h3>
        <p className="text-sm whitespace-pre-wrap">{nc.description}</p>
      </div>

      {/* Immediate Action */}
      {nc.immediate_action && (
        <div className="mb-6">
          <h3 className="font-semibold text-foreground border-b pb-1 mb-3">
            Immediate Action Taken
          </h3>
          <p className="text-sm whitespace-pre-wrap">{nc.immediate_action}</p>
        </div>
      )}

      {/* Corrective Action */}
      {correctiveAction && (
        <div className="mb-6 bg-muted/50 rounded-lg p-4">
          <h3 className="font-semibold text-foreground border-b pb-1 mb-3">
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
            <div>
              <p className="text-muted-foreground font-medium">Target Completion</p>
              <p>{correctiveAction.completion_date}</p>
            </div>
          </div>
        </div>
      )}

      {/* Activity History */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground border-b pb-1 mb-3">
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
          <h3 className="font-semibold text-foreground border-b pb-1 mb-3">
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
          {rpApproval?.signature_data ? (
            <img
              src={rpApproval.signature_data}
              alt="Responsible Person Signature"
              className="h-12 object-contain object-left mb-2"
              style={{ maxWidth: '100%' }}
            />
          ) : (
            <div className="border-b border-foreground h-12 mb-2" />
          )}
          <p className="text-sm text-muted-foreground">Responsible Person Signature</p>
          {rpApproval?.approved_at && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(rpApproval.approved_at), 'PPp')}
            </p>
          )}
        </div>
        <div>
          {managerApproval?.signature_data ? (
            <img
              src={managerApproval.signature_data}
              alt="Manager Approval Signature"
              className="h-12 object-contain object-left mb-2"
              style={{ maxWidth: '100%' }}
            />
          ) : (
            <div className="border-b border-foreground h-12 mb-2" />
          )}
          <p className="text-sm text-muted-foreground">Manager Approval Signature</p>
          {managerApproval?.approved_at && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(managerApproval.approved_at), 'PPp')}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
        <p>This is a system-generated report from Ascend LC Quality Management System</p>
        {tenantName && <p>Prepared for: {tenantName}</p>}
        <p>Document ID: {nc.id}</p>
      </div>
    </div>
  );
}
