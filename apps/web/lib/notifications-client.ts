import { apiClient } from './api-client';

export type NotificationKind =
  | 'ticket.created'
  | 'ticket.commented'
  | 'ticket.status_changed'
  | 'ticket.assigned'
  | 'ticket.resolved'
  // Any string is permitted server-side so the client stays open-ended for
  // future kinds without a frontend deploy.
  | (string & {});

export interface NotificationDTO {
  id: string;
  orgId: string;
  recipientId: string;
  kind: NotificationKind;
  subjectType: string;
  subjectId: string;
  title: string;
  body: string | null;
  linkUrl: string;
  count: number;
  groupKey: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActor: { id: string; name: string | null; email: string } | null;
}

export interface NotificationListResponse {
  items: NotificationDTO[];
  nextCursor: string | null;
}

export interface UnreadCountResponse {
  count: number;
  hasMore: boolean;
}

export interface NotificationTypeItem {
  kind: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  enabled: boolean;
}

export const notificationsClient = {
  async list(params: {
    cursor?: string;
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<NotificationListResponse> {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.unreadOnly) qs.set('unreadOnly', 'true');
    const s = qs.toString();
    return apiClient.get<NotificationListResponse>(
      `/me/notifications${s ? `?${s}` : ''}`,
    );
  },

  async unreadCount(): Promise<UnreadCountResponse> {
    return apiClient.get<UnreadCountResponse>('/me/notifications/unread-count');
  },

  async markRead(id: string): Promise<void> {
    await apiClient.post(`/me/notifications/${encodeURIComponent(id)}/read`);
  },

  async markAllRead(): Promise<{ updated: number }> {
    return apiClient.post<{ updated: number }>('/me/notifications/read-all');
  },

  async listTypes(): Promise<{ items: NotificationTypeItem[] }> {
    return apiClient.get<{ items: NotificationTypeItem[] }>('/admin/notification-types');
  },

  async setTypeEnabled(kind: string, enabled: boolean): Promise<void> {
    await apiClient.put(`/admin/notification-types/${encodeURIComponent(kind)}`, {
      enabled,
    });
  },
};
