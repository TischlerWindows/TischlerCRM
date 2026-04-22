import { prisma } from '@crm/db/client';

export type ReportAccessMode = 'read' | 'write';

type ReportOwnershipRow = {
  id: string;
  createdById: string;
  isPrivate: boolean;
  sharedWith: unknown;
};

export type ReportAccessResult =
  | { ok: true; report: ReportOwnershipRow }
  | { ok: false; code: 403 | 404 };

// Gate report-id endpoints against owner / admin / shared-with / non-private
// rules. The legacy handlers performed only findUnique-by-id, so any
// authenticated user could read or mutate any report by guessing IDs.
//
// Read denials return 404 (not 403) on purpose: a 403 confirms the ID exists,
// which is an information leak. Write denials return 403 because the caller
// is already known to be able to observe the report (via the read path) if
// they have legitimate access.
export async function assertReportAccess(
  reportId: string,
  userId: string,
  userRole: string,
  mode: ReportAccessMode
): Promise<ReportAccessResult> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, createdById: true, isPrivate: true, sharedWith: true },
  });
  if (!report) return { ok: false, code: 404 };

  const isAdmin = userRole === 'ADMIN';
  const isOwner = report.createdById === userId;

  if (mode === 'write') {
    if (isAdmin || isOwner) return { ok: true, report };
    return { ok: false, code: 403 };
  }

  if (isAdmin || isOwner) return { ok: true, report };
  if (!report.isPrivate) return { ok: true, report };

  const sharedWith = Array.isArray(report.sharedWith) ? (report.sharedWith as unknown[]) : [];
  if (sharedWith.includes(userId)) return { ok: true, report };

  // Report.sharedWith may hold user IDs or email addresses (see schema comment).
  // Only pay for the extra lookup when an ID match already failed.
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (viewer?.email && sharedWith.includes(viewer.email)) return { ok: true, report };

  return { ok: false, code: 404 };
}
