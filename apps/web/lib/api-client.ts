// API Client for communicating with the backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
      'Content-Type': 'application/json',
      ...options.headers,
    };

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

      // On 401 (expired/invalid token), clear stale credentials and redirect
      // to login so the user can re-authenticate instead of seeing empty pages.
      // Guard against redirect loop: don't redirect if we're already on /login.
      if (response.status === 401 && typeof window !== 'undefined') {
        this.setToken(null);
        sessionStorage.removeItem('user');
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
    const result = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  async signup(name: string, email: string, password: string) {
    const result = await this.request<{ token: string; user: any }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  logout() {
    this.setToken(null);
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

  async deleteRecord(objectApiName: string, recordId: string) {
    return this.request<void>(`/objects/${objectApiName}/records/${recordId}`, {
      method: 'DELETE',
    });
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
    return this.request<any>('/admin/backup', { method: 'POST' });
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
    return this.request<any>(`/admin/backups/${backupId}/restore`, { method: 'POST' });
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
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
