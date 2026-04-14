// API Client for communicating with the backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── TypeScript interfaces ─────────────────────────────────────────────────

export type InviteStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'LEGACY' | 'NOT_SENT';

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  profile: { id: string; name: string; label: string } | null;
  department: { id: string; name: string } | null;
  inviteStatus: InviteStatus;
}

export interface UserDetail extends UserRow {
  nickname: string | null;
  alias: string | null;
  mobilePhone: string | null;
  timezone: string | null;
  locale: string | null;
  manager: { id: string; name: string | null; email: string } | null;
  createdBy: { id: string; name: string | null } | null;
  inviteAcceptedAt: string | null;
  inviteSentAt: string | null;
  lastModifiedBy: { id: string; name: string | null } | null;
  lastModifiedAt: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  title?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  nickname?: string | null;
  alias?: string | null;
  profileId?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  timezone?: string | null;
  locale?: string | null;
  password?: string;
}

export type UpdateUserInput = Partial<CreateUserInput & { isActive: boolean }>;

export interface LoginEventRow {
  id: string;
  userId: string;
  ip: string;
  userAgent: string | null;
  createdAt: string;
  success: boolean;
  user?: { id: string; name: string | null; email: string };
}

export type ObjectPerm = {
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
};
export type ProfileObjects = Record<string, ObjectPerm>;
export type ProfileApp = Record<string, boolean>;
export interface ProfilePermissions {
  objects: ProfileObjects;
  app: ProfileApp;
}

export interface Profile {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  grantsAdminAccess: boolean;
  permissions: ProfilePermissions;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface CreateProfileInput {
  name: string;
  label: string;
  description?: string | null;
  permissions?: ProfilePermissions;
}
export interface UpdateProfileInput {
  label?: string;
  description?: string | null;
  grantsAdminAccess?: boolean;
}

export interface GlobalSearchResult {
  id: string;
  objectApiName: string;
  objectLabel: string;
  objectPluralLabel: string;
  title: string;
  subtitle: string;
  matchedFields: string[];
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Try to load token from localStorage on init
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for requests that carry a body;
    // sending it on bodiless DELETE/GET causes Fastify to try
    // to parse the empty body as JSON → 400 Bad Request.
    if (options.body) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      let errorMessage = errorData.error || `HTTP error! status: ${response.status}`;

      // Parse Zod-style validation errors (fieldErrors / formErrors)
      if (!errorData.error && errorData.fieldErrors && typeof errorData.fieldErrors === 'object') {
        const fieldMsgs = Object.entries(errorData.fieldErrors)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
          .join('; ');
        if (fieldMsgs) errorMessage = `Validation failed: ${fieldMsgs}`;
      }

      // On 401 (expired/invalid token), clear stale credentials and redirect
      // to login so the user can re-authenticate instead of seeing empty pages.
      // Guard against redirect loop: don't redirect if we're already on /login.
      if (response.status === 401 && typeof window !== 'undefined') {
        this.setToken(null);
        localStorage.removeItem('user');
        document.cookie = 'auth-token=; Max-Age=0; path=/;';
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }

      if (errorData.fields && Array.isArray(errorData.fields)) {
        errorMessage += ': ' + errorData.fields.join(', ');
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return response.json();
  }

  // Generic HTTP helpers
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = void>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const result = await this.request<{ token: string; user: any; mustChangePassword?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  logout() {
    this.setToken(null);
  }

  // ── Global search ────────────────────────────────────────────────────────
  async globalSearch(q: string): Promise<{ results: GlobalSearchResult[] }> {
    return this.get(`/search?q=${encodeURIComponent(q)}`);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return this.post('/auth/change-password', { currentPassword, newPassword });
  }

  // ── Users (admin) ───────────────────────────────────────────────────────
  async getUsers(params?: { includeDeleted?: boolean }): Promise<UserRow[]> {
    const q = params?.includeDeleted ? '?includeDeleted=true' : '';
    return this.get(`/admin/users${q}`);
  }

  async getUser(id: string): Promise<UserDetail> {
    return this.get(`/admin/users/${id}`);
  }

  async createUser(data: CreateUserInput): Promise<{ user: UserRow; inviteUrl?: string; inviteSent: boolean }> {
    return this.post('/admin/users', data);
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<UserDetail> {
    return this.put(`/admin/users/${id}`, data);
  }

  async deleteUser(id: string): Promise<void> {
    return this.delete(`/admin/users/${id}`);
  }

  async freezeUser(id: string): Promise<UserRow> {
    return this.post(`/admin/users/${id}/freeze`);
  }

  async adminSetUserPassword(id: string, newPassword: string): Promise<void> {
    return this.post(`/admin/users/${id}/reset-password`, { password: newPassword });
  }

  async resendUserInvite(id: string): Promise<{ inviteUrl?: string; inviteSent: boolean }> {
    return this.post(`/admin/users/${id}/resend-invite`);
  }

  async impersonateUser(id: string): Promise<{ token: string; user: { id: string; email: string; name: string | null; role: string } }> {
    return this.post(`/admin/users/${id}/impersonate`);
  }

  async impersonateUser(id: string): Promise<{ token: string; user: { id: string; email: string; name: string | null; role: string } }> {
    return this.post(`/admin/users/${id}/impersonate`);
  }

  async getUserLoginHistory(id: string): Promise<LoginEventRow[]> {
    return this.get(`/security/login-events?userId=${id}`);
  }

  // ── Profiles (admin) ────────────────────────────────────────────────────
  async getProfiles(): Promise<Profile[]> {
    return this.get('/admin/profiles');
  }

  async getProfile(id: string): Promise<Profile> {
    return this.get(`/admin/profiles/${id}`);
  }

  async createProfile(data: CreateProfileInput): Promise<Profile> {
    return this.post('/admin/profiles', data);
  }

  async updateProfile(id: string, data: UpdateProfileInput): Promise<Profile> {
    return this.put(`/admin/profiles/${id}`, data);
  }

  async updateProfilePermissions(id: string, permissions: ProfilePermissions): Promise<Profile> {
    return this.put(`/admin/profiles/${id}/permissions`, permissions);
  }

  async cloneProfile(id: string): Promise<Profile> {
    return this.post(`/admin/profiles/${id}/clone`);
  }

  async deleteProfile(id: string): Promise<void> {
    return this.delete(`/admin/profiles/${id}`);
  }

  async getProfileMembers(id: string): Promise<UserRow[]> {
    return this.get(`/admin/profiles/${id}/members`);
  }

  // ── Public auth (no token required) ────────────────────────────────────
  async acceptInvite(token: string, password: string): Promise<{ token: string; user: { id: string; name: string | null; email: string; role: string } }> {
    return this.post('/auth/accept-invite', { token, password });
  }

  async forgotPassword(email: string): Promise<{ success: boolean }> {
    return this.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string): Promise<{ token: string; user: { id: string; name: string | null; email: string; role: string } }> {
    return this.post('/auth/reset-password', { token, password });
  }

  // Health check
  async health() {
    return this.request<{ ok: boolean }>('/health');
  }

  // Objects (Schema)
  async getObjects() {
    return this.request<any[]>('/objects');
  }

  async getObject(apiName: string) {
    return this.request<any>(`/objects/${apiName}`);
  }

  async createObject(data: {
    apiName: string;
    label: string;
    pluralLabel: string;
    description?: string;
  }) {
    return this.request<any>('/objects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateObject(apiName: string, data: Partial<any>) {
    return this.request<any>(`/objects/${apiName}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteObject(apiName: string) {
    return this.request<void>(`/objects/${apiName}`, {
      method: 'DELETE',
    });
  }

  // Fields
  async getFields(objectApiName: string) {
    return this.request<any[]>(`/objects/${objectApiName}/fields`);
  }

  async createField(objectApiName: string, data: any) {
    return this.request<any>(`/objects/${objectApiName}/fields`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateField(objectApiName: string, fieldId: string, data: Partial<any>) {
    return this.request<any>(`/objects/${objectApiName}/fields/${fieldId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteField(objectApiName: string, fieldId: string) {
    return this.request<void>(`/objects/${objectApiName}/fields/${fieldId}`, {
      method: 'DELETE',
    });
  }

  // Page Layouts
  async getLayouts(objectApiName: string) {
    return this.request<any[]>(`/objects/${objectApiName}/layouts`);
  }

  async createLayout(objectApiName: string, data: any) {
    return this.request<any>(`/objects/${objectApiName}/layouts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLayout(objectApiName: string, layoutId: string, data: Partial<any>) {
    return this.request<any>(`/objects/${objectApiName}/layouts/${layoutId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteLayout(objectApiName: string, layoutId: string) {
    return this.request<void>(`/objects/${objectApiName}/layouts/${layoutId}`, {
      method: 'DELETE',
    });
  }

  // Records
  async getRecords(objectApiName: string, options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    const queryString = params.toString();
    return this.request<any[]>(`/objects/${objectApiName}/records${queryString ? `?${queryString}` : ''}`);
  }

  async getRecord(objectApiName: string, recordId: string) {
    return this.request<any>(`/objects/${objectApiName}/records/${recordId}`);
  }

  async createRecord(objectApiName: string, data: Record<string, any>, pageLayoutId?: string) {
    return this.request<any>(`/objects/${objectApiName}/records`, {
      method: 'POST',
      body: JSON.stringify({ data, pageLayoutId }),
    });
  }

  async updateRecord(objectApiName: string, recordId: string, data: Record<string, any>) {
    return this.request<any>(`/objects/${objectApiName}/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
  }

  async createRequote(objectApiName: string, recordId: string) {
    return this.request<any>(`/objects/${objectApiName}/records/${recordId}/requote`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getRequoteVersions(objectApiName: string, recordId: string) {
    return this.request<{ versions: Array<{ id: string; label: string; isCurrent: boolean }> }>(
      `/objects/${objectApiName}/records/${recordId}/requote-versions`
    );
  }

  async deleteRecord(objectApiName: string, recordId: string) {
    return this.request<void>(`/objects/${objectApiName}/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  async importRecords(objectApiName: string, records: Record<string, any>[]): Promise<{ created: number; errors: Array<{ row: number; error: string }> }> {
    return this.request<{ created: number; errors: Array<{ row: number; error: string }> }>(
      `/objects/${objectApiName}/records/import`,
      {
        method: 'POST',
        body: JSON.stringify({ records }),
      },
    );
  }

  async migrateRecordLayouts(objectApiName: string, fromPageLayoutId: string): Promise<{ updatedCount: number }> {
    return this.request<{ updatedCount: number }>(
      `/objects/${objectApiName}/records/page-layout/migrate`,
      {
        method: 'POST',
        body: JSON.stringify({ fromPageLayoutId }),
      },
    );
  }

  // Reports
  async getReports() {
    return this.request<any[]>('/reports');
  }

  async getReport(reportId: string) {
    return this.request<any>(`/reports/${reportId}`);
  }

  async createReport(data: any) {
    return this.request<any>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReport(reportId: string, data: Partial<any>) {
    return this.request<any>(`/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteReport(reportId: string) {
    return this.request<void>(`/reports/${reportId}`, {
      method: 'DELETE',
    });
  }

  async runReport(reportId: string) {
    return this.request<any>(`/reports/${reportId}/run`);
  }

  // Dashboards
  async getDashboards() {
    return this.request<any[]>('/dashboards');
  }

  async getDashboard(dashboardId: string) {
    return this.request<any>(`/dashboards/${dashboardId}`);
  }

  async createDashboard(data: any) {
    return this.request<any>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDashboard(dashboardId: string, data: Partial<any>) {
    return this.request<any>(`/dashboards/${dashboardId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDashboard(dashboardId: string) {
    return this.request<void>(`/dashboards/${dashboardId}`, {
      method: 'DELETE',
    });
  }
  // Backups
  async createBackup() {
    return this.request<any>('/admin/backup', { method: 'POST', body: '{}' });
  }

  async getBackups() {
    return this.request<{ backups: any[] }>('/admin/backups');
  }

  async downloadBackup(backupId: string) {
    const url = `${this.baseUrl}/admin/backups/${backupId}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return res.json();
  }

  async deleteBackup(backupId: string) {
    return this.request<void>(`/admin/backups/${backupId}`, { method: 'DELETE' });
  }

  async restoreBackup(backupId: string) {
    return this.request<any>(`/admin/backups/${backupId}/restore`, { method: 'POST', body: '{}' });
  }

  async getBackupStatus() {
    return this.request<{
      usingDedicatedDb: boolean;
      totalBackups: number;
      totalSizeMB: string;
      daily: { count: number; maxRetained: number; lastBackup: string | null };
      weekly: { count: number; maxRetained: number; lastBackup: string | null };
      manual: { count: number; maxRetained: number; lastBackup: string | null };
    }>('/admin/backup/status');
  }

  // Settings (org-level)
  async getSettings() {
    return this.request<Record<string, any>>('/settings');
  }

  async getSetting(key: string) {
    return this.request<{ key: string; value: any }>(`/settings/${encodeURIComponent(key)}`);
  }

  async setSetting(key: string, value: any) {
    return this.request<{ key: string; value: any }>(`/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async deleteSetting(key: string) {
    return this.request<void>(`/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
  }

  // User preferences (per-user)
  async getPreferences() {
    return this.request<Record<string, any>>('/user/preferences');
  }

  async getPreference(key: string) {
    return this.request<{ key: string; value: any }>(`/user/preferences/${encodeURIComponent(key)}`);
  }

  async setPreference(key: string, value: any) {
    return this.request<{ key: string; value: any }>(`/user/preferences/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async setPreferences(prefs: Record<string, any>) {
    return this.request<Record<string, any>>('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  }

  async deletePreference(key: string) {
    return this.request<void>(`/user/preferences/${encodeURIComponent(key)}`, { method: 'DELETE' });
  }

  // Integrations
  async getIntegrations() {
    return this.request<any[]>('/integrations');
  }

  async getIntegration(provider: string) {
    return this.request<any>(`/integrations/${encodeURIComponent(provider)}`);
  }

  async updateIntegration(provider: string, data: {
    enabled?: boolean;
    apiKey?: string | null;
    clientId?: string | null;
    clientSecret?: string | null;
    config?: Record<string, any>;
    webhookUrl?: string | null;
  }) {
    return this.request<any>(`/integrations/${encodeURIComponent(provider)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async resetIntegration(provider: string) {
    return this.request<void>(`/integrations/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
    });
  }

  async getMyConnections() {
    return this.request<any[]>('/integrations/me/connections');
  }

  // Widgets
  async getWidgetSettings(): Promise<Array<{ widgetId: string; enabled: boolean }>> {
    return this.request('/widgets');
  }

  async updateWidgetSetting(widgetId: string, enabled: boolean): Promise<void> {
    return this.request(`/widgets/${encodeURIComponent(widgetId)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  // Automations (Triggers & Controllers)
  async getTriggerSettings() {
    return this.request<Array<{ triggerId: string; enabled: boolean; name: string; description: string; icon: string; objectApiName: string; events: string[] }>>('/automations/triggers');
  }

  async updateTriggerSetting(triggerId: string, enabled: boolean): Promise<void> {
    return this.request(`/automations/triggers/${encodeURIComponent(triggerId)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  async getControllerSettings() {
    return this.request<Array<{ controllerId: string; enabled: boolean; name: string; description: string; icon: string; objectApiName: string; routePrefix: string }>>('/automations/controllers');
  }

  async updateControllerSetting(controllerId: string, enabled: boolean): Promise<void> {
    return this.request(`/automations/controllers/${encodeURIComponent(controllerId)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  // Google Places (proxied through backend — API key never reaches the browser)
  async placesAutocomplete(input: string, sessionToken: string) {
    const params = new URLSearchParams({ input, sessionToken });
    return this.request<{
      predictions: Array<{
        description: string;
        place_id: string;
        structured_formatting: { main_text: string; secondary_text: string };
      }>;
    }>(`/places/autocomplete?${params}`);
  }

  async placeDetails(placeId: string, sessionToken: string) {
    const params = new URLSearchParams({ placeId, sessionToken });
    return this.request<{
      address: {
        street: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        lat: number | null;
        lng: number | null;
        formattedAddress: string;
      };
    }>(`/places/details?${params}`);
  }

  // ── Outlook / Microsoft ────────────────────────────────────────────────────

  async getOutlookStatus() {
    return this.request<{
      enabled: boolean;
      configured: boolean;
      connected: boolean;
      senderEmail: string | null;
      tenantId: string | null;
    }>('/outlook/status');
  }

  async sendOutlookTestEmail() {
    return this.request<{ sent: boolean; message: string }>('/outlook/test-email', { method: 'POST' });
  }

  // ── Dropbox ────────────────────────────────────────────────────────────────

  async getDropboxConnectUrl() {
    return this.request<{ url: string }>('/dropbox/connect');
  }

  async getDropboxStatus() {
    return this.request<{
      enabled: boolean;
      configured: boolean;
      connected: boolean;
      externalEmail: string | null;
      connectedAt: string | null;
    }>('/dropbox/status');
  }

  async disconnectDropbox() {
    return this.request<void>('/dropbox/disconnect', { method: 'DELETE' });
  }

  async listDropboxFiles(objectApiName: string, recordId: string, subPath?: string, folderName?: string) {
    const p = new URLSearchParams();
    if (subPath) p.set('subPath', subPath);
    if (folderName) p.set('folderName', folderName);
    const qs = p.toString() ? `?${p.toString()}` : '';
    return this.request<{
      connected: boolean;
      needsReauth?: boolean;
      files: Array<{
        id: string;
        name: string;
        path: string;
        size: number;
        modifiedAt: string | null;
        isFolder: boolean;
      }>;
    }>(`/dropbox/files/${encodeURIComponent(objectApiName)}/${encodeURIComponent(recordId)}${qs}`);
  }

  async getDropboxDownloadUrl(fileId: string) {
    return this.request<{ url: string }>(`/dropbox/download/${encodeURIComponent(fileId)}`);
  }

  async createDropboxFolder(objectApiName: string, recordId: string, name: string, subPath?: string, folderName?: string) {
    return this.request<{ id: string; name: string; path: string }>(`/dropbox/folder/${encodeURIComponent(objectApiName)}/${encodeURIComponent(recordId)}`, {
      method: 'POST',
      body: JSON.stringify({ name, subPath, folderName }),
    });
  }

  async ensureDropboxFolder(objectApiName: string, recordId: string, folderName?: string) {
    return this.request<{ created: boolean; path: string; exists?: boolean; linked?: boolean }>(
      `/dropbox/ensure-folder/${encodeURIComponent(objectApiName)}/${encodeURIComponent(recordId)}`,
      { method: 'POST', body: JSON.stringify({ folderName }) }
    );
  }

  async resolveDropboxPath(objectApiName: string, recordId: string) {
    return this.request<{
      linked: boolean;
      parentObjectApiName?: string;
      parentRecordId?: string;
      parentFolderName?: string;
      subfolder?: string;
      childFolderName?: string;
      linkedOpportunityFolderName?: string;
      isRequote?: boolean;
      parentOpportunityNumber?: string;
      parentOpportunityFolderName?: string;
    }>(
      `/dropbox/resolve-path/${encodeURIComponent(objectApiName)}/${encodeURIComponent(recordId)}`
    );
  }

  async ensureDropboxLinkedFolder(opts: {
    parentObjectApiName: string;
    parentRecordId: string;
    parentFolderName?: string;
    childObjectApiName: string;
    childFolderName: string;
  }) {
    return this.request<{ created: boolean; path: string; reason?: string }>(
      '/dropbox/ensure-linked-folder',
      { method: 'POST', body: JSON.stringify(opts) }
    );
  }

  async renameDropboxFolder(opts: {
    objectApiName: string;
    recordId: string;
    oldFolderName: string;
    newFolderName: string;
  }) {
    return this.request<{ renamed: boolean; oldPath?: string; newPath?: string; reason?: string }>(
      '/dropbox/rename-folder',
      { method: 'POST', body: JSON.stringify(opts) }
    );
  }

  async renameDropboxLinkedFolder(opts: {
    parentObjectApiName: string;
    parentFolderName: string;
    childObjectApiName: string;
    oldChildFolderName: string;
    newChildFolderName: string;
  }) {
    return this.request<{ renamed: boolean; oldPath?: string; newPath?: string; reason?: string }>(
      '/dropbox/rename-linked-folder',
      { method: 'POST', body: JSON.stringify(opts) }
    );
  }

  async copyDropboxFile(opts: {
    fromPath: string;
    toObjectApiName: string;
    toRecordId: string;
    toFolderName?: string;
    toSubPath?: string;
  }) {
    return this.request<{ success: boolean; path: string }>(
      '/dropbox/copy',
      { method: 'POST', body: JSON.stringify(opts) }
    );
  }

  async deleteDropboxFile(fileId: string) {
    return this.request<void>(`/dropbox/file/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  }

  async uploadDropboxFile(objectApiName: string, recordId: string, file: File, subPath?: string, folderName?: string) {
    const fileName = subPath ? `${subPath}/${file.name}` : file.name;
    const p = new URLSearchParams({ fileName });
    if (folderName) p.set('folderName', folderName);
    const url = `${this.baseUrl}/dropbox/upload/${encodeURIComponent(objectApiName)}/${encodeURIComponent(recordId)}?${p.toString()}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: HeadersInit = {
      'Content-Type': 'application/octet-stream',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: file,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return resp.json() as Promise<{
      id: string;
      name: string;
      path: string;
      size: number;
      modifiedAt: string;
    }>;
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
