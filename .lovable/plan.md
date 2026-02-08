
# Phase 1 Completion Plan — QMS Guard

This plan addresses the remaining gaps identified in the Phase 1 audit to bring the NC workflow and reporting system to production-ready status.

---

## Summary of Remaining Work

| Item | Priority | Effort |
|------|----------|--------|
| Add `date_occurred` field to NC form | High | Small |
| Create e-signature canvas component | Medium | Medium |
| Add PDF export functionality | Medium | Medium |
| Verify 3-day reminder cron job | Low | Testing |
| Mobile responsiveness check | Low | Testing |

---

## Task 1: Add `date_occurred` Field to ReportNC Form

The database column `date_occurred` already exists on `non_conformances`, but the submission form does not include a field for users to specify when the incident occurred (distinct from submission date).

### Changes Required

**File: `src/pages/ReportNC.tsx`**

1. Update Zod schema to include `date_occurred`:
```typescript
date_occurred: z.date({ required_error: 'Please select when this occurred' }),
```

2. Add a date picker field in the "Identification" card section (after the Shift selector):
```text
- Label: "Date Occurred"
- Type: Date picker (using Popover + Calendar pattern)
- Default: Today
- Description: "When did this non-conformance occur?"
```

3. Update `onSubmit` to include `date_occurred` in the insert payload:
```typescript
date_occurred: format(data.date_occurred, 'yyyy-MM-dd'),
```

### UI Layout
The date picker will use the existing Shadcn Calendar component with Popover pattern (same as the Due Date field).

---

## Task 2: Create E-Signature Canvas Component

A simple draw-to-sign canvas component that captures user signatures during approval workflows. This serves as a DocuSign placeholder for Phase 1.

### New Component: `src/components/ui/signature-canvas.tsx`

**Features:**
- HTML5 Canvas for drawing
- Touch and mouse support
- Clear button
- Returns signature as Base64 data URL
- Accessible container with label

**API:**
```typescript
interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  label?: string;
}
```

### Integration Points

**File: `src/components/nc/workflow/ManagerApprovalForm.tsx`**

Add optional signature capture before submission:
- Show signature canvas when user selects "Approve"
- Store signature data URL in the `workflow_approvals` record (new column or JSON field)
- Display "Signed by [Name] on [Date]" confirmation

### Database Migration

Add `signature_data` column to `workflow_approvals` table:
```sql
ALTER TABLE workflow_approvals 
ADD COLUMN signature_data TEXT;
```

---

## Task 3: PDF Export Functionality

Enable PDF generation for individual NC reports and summary lists for compliance documentation.

### Approach

Use browser-native `window.print()` with print-specific CSS for Phase 1 (lightweight, no external dependencies). A dedicated PDF library can be added in Phase 2 if needed.

### New Component: `src/components/nc/NCPrintView.tsx`

A print-optimized layout of the NC detail view:
- Company logo/branding
- NC header information
- Full workflow history timeline
- Corrective action details
- Signature blocks (if captured)
- Footer with print timestamp

### Integration

**File: `src/pages/NCDetail.tsx`**

Add "Export PDF" button in the header:
- Opens a new window with print-styled content
- Triggers `window.print()`

**File: `src/index.css`**

Add print media query styles:
```css
@media print {
  /* Hide sidebar, navigation */
  /* Show print-only elements */
  /* Adjust page margins */
}
```

---

## Task 4: Verify Scheduled Reminder Functionality

The edge function `nc-scheduled-tasks` exists and handles:
- Identifying open/overdue NCs
- Grouping by responsible person
- Sending email reminders via Resend

### Verification Steps

1. Check if a cron job is configured in Supabase to trigger this function daily
2. Test the function manually using `supabase--curl_edge_functions`
3. Verify email delivery to test accounts
4. Confirm 3-day window logic is implemented (currently sends to all overdue)

### Potential Enhancement

Add 3-day approaching deadline warning:
```typescript
const dueIn3Days = userNcs.filter(nc => {
  const due = new Date(nc.due_date);
  const today = new Date();
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  return diff <= 3 && diff > 0;
});
```

---

## Task 5: Mobile Responsiveness Audit

Verify all key pages render correctly on mobile devices.

### Pages to Test
- Dashboard (`/`)
- NC List (`/nc`)
- NC Detail (`/nc/:id`)
- Report NC (`/report`)
- My Tasks (`/tasks`)

### Known Mobile Patterns Already Used
- Responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Flex wrap: `flex-col sm:flex-row`
- Mobile-first form layouts

### Focus Areas
- KPI cards stack properly
- Form fields are full-width on mobile
- Tables have horizontal scroll on small screens
- Action buttons are touch-friendly (min 44px)

---

## Implementation Order

1. **date_occurred field** — Quick win, small change
2. **E-signature canvas** — Medium effort, high value for compliance
3. **PDF export** — Medium effort, required for documentation
4. **Scheduled reminders verification** — Testing/debugging only
5. **Mobile responsiveness** — Testing and minor fixes

---

## Technical Notes

- All changes follow existing code patterns in the project
- Shadcn UI components are used consistently
- Form validation uses Zod + react-hook-form
- Database changes use migration tool
- Edge functions are auto-deployed
