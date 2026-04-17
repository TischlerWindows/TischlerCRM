/**
 * Registry of all notification kinds this system knows about.
 *
 * Adding a new kind: add an entry below. `defaultEnabled: true` means the
 * admin can turn it off via Settings > Notifications; the framework treats
 * a missing NotificationTypeSetting row as enabled (opt-OUT model).
 *
 * `category` is used to group kinds in the admin UI. Keep it stable.
 */

export interface NotificationKindDefinition {
  kind: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
}

export const NOTIFICATION_KINDS = [
  {
    kind: 'ticket.created',
    label: 'New support ticket',
    description: 'Fires when a new support ticket is submitted. Sent to admins and users with the Support Tickets permission.',
    category: 'Support',
    defaultEnabled: true,
  },
  {
    kind: 'ticket.commented',
    label: 'Ticket comment',
    description: 'Fires when someone comments on a ticket. Sent to the submitter, assignee, and other prior participants (excluding the commenter).',
    category: 'Support',
    defaultEnabled: true,
  },
  {
    kind: 'ticket.status_changed',
    label: 'Ticket status change',
    description: 'Fires when a ticket moves between statuses (other than Resolved). Sent to the submitter.',
    category: 'Support',
    defaultEnabled: true,
  },
  {
    kind: 'ticket.assigned',
    label: 'Ticket assignment',
    description: 'Fires when a ticket is assigned to someone. Sent to the new assignee.',
    category: 'Support',
    defaultEnabled: true,
  },
  {
    kind: 'ticket.resolved',
    label: 'Ticket resolved',
    description: 'Fires when a ticket is marked Resolved. Sent to the submitter.',
    category: 'Support',
    defaultEnabled: true,
  },
] as const satisfies readonly NotificationKindDefinition[];

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]['kind'];

const VALID_KINDS = new Set<string>(NOTIFICATION_KINDS.map((k) => k.kind));

export function isValidNotificationKind(kind: string): kind is NotificationKind {
  return VALID_KINDS.has(kind);
}

export function getNotificationKind(kind: string): NotificationKindDefinition | undefined {
  return NOTIFICATION_KINDS.find((k) => k.kind === kind);
}
