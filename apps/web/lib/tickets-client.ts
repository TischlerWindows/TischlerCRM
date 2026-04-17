import { apiClient } from './api-client';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_USER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/** Category is an admin-managed string key. Use CategoryCatalog to resolve label/color. */
export type TicketCategory = string;

export type TicketEventType =
  | 'CREATED'
  | 'COMMENT'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'CATEGORY_CHANGED'
  | 'ASSIGNED'
  | 'ATTACHMENT_ADDED'
  | 'ERROR_LOG_ATTACHED'
  | 'RESOLVED'
  | 'REOPENED';

export interface UserRef {
  id: string;
  name: string | null;
  email: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  author: UserRef;
  body: string;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  uploadedBy: UserRef;
  kind: 'screenshot' | 'file';
  fileName: string;
  sizeBytes: number | null;
  mimeType: string | null;
  storagePath: string;
  storageId: string | null;
  storageRev: string | null;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  actor: UserRef | null;
  type: TicketEventType;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface TicketErrorLog {
  id: string;
  message: string;
  url: string | null;
  createdAt: string;
  source: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  submittedBy: UserRef;
  assignedTo: UserRef | null;
  resolvedBy: UserRef | null;
  attachmentFolderRef: string | null;
  sessionId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: TicketComment[];
  attachments: TicketAttachment[];
  events: TicketEvent[];
  errorLogs: TicketErrorLog[];
}

export interface TicketListItem {
  id: string;
  ticketNumber: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  submittedBy: UserRef;
  assignedTo: UserRef | null;
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number; attachments: number };
}

export interface TicketListResponse {
  items: TicketListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RecentErrorLogItem {
  id: string;
  message: string;
  url: string | null;
  createdAt: string;
  ticketId: string | null;
}

export const ticketsClient = {
  async list(params: {
    status?: TicketStatus;
    category?: TicketCategory;
    priority?: TicketPriority;
    assignedToId?: string;
    mine?: boolean;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<TicketListResponse> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.category) qs.set('category', params.category);
    if (params.priority) qs.set('priority', params.priority);
    if (params.assignedToId) qs.set('assignedToId', params.assignedToId);
    if (params.mine !== undefined) qs.set('mine', String(params.mine));
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const s = qs.toString();
    return apiClient.get<TicketListResponse>(`/tickets${s ? `?${s}` : ''}`);
  },

  async get(id: string): Promise<SupportTicket> {
    return apiClient.get<SupportTicket>(`/tickets/${encodeURIComponent(id)}`);
  },

  async create(body: {
    title: string;
    description: string;
    category: string;
    sessionId?: string;
    errorLogIds?: string[];
  }): Promise<SupportTicket> {
    return apiClient.post<SupportTicket>('/tickets', body);
  },

  async patch(
    id: string,
    body: {
      status?: TicketStatus;
      priority?: TicketPriority;
      category?: TicketCategory;
      assignedToId?: string | null;
    },
  ): Promise<SupportTicket> {
    return apiClient.patch<SupportTicket>(`/tickets/${encodeURIComponent(id)}`, body);
  },

  async addComment(id: string, body: string): Promise<SupportTicket> {
    return apiClient.post<SupportTicket>(`/tickets/${encodeURIComponent(id)}/comments`, { body });
  },

  async attachErrorLogs(id: string, errorLogIds: string[]): Promise<{ attached: number }> {
    return apiClient.post<{ attached: number }>(
      `/tickets/${encodeURIComponent(id)}/error-logs`,
      { errorLogIds },
    );
  },

  async getAssignableUsers(): Promise<{ users: UserRef[] }> {
    return apiClient.get<{ users: UserRef[] }>('/tickets/assignable-users');
  },

  async getMyRecentErrors(
    sessionId: string,
    limit = 20,
  ): Promise<{ items: RecentErrorLogItem[] }> {
    const qs = new URLSearchParams({ sessionId, limit: String(limit) });
    return apiClient.get<{ items: RecentErrorLogItem[] }>(
      `/me/error-log/recent?${qs.toString()}`,
    );
  },
};
