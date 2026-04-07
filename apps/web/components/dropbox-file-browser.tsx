'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  FileText, Upload, Download, Loader2, CloudOff, FolderOpen, X, Trash2,
  FolderPlus, Search, ChevronRight, ArrowLeft, MoreVertical, File, ExternalLink,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

type DropboxEntry = {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedAt: string | null;
  isFolder: boolean;
};

type DropboxStatus = {
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  needsReauth?: boolean;
};

type SortField = 'name' | 'modifiedAt' | 'size';
type SortDir = 'asc' | 'desc';

// ── Helpers ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Dropbox logo SVG
function DropboxLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 43.35 40.38" fill="#0061FF" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.87 0L0 8.15l8.8 7.04L21.67 8.1zM0 22.23l12.87 8.15 8.8-7.09-12.87-7.1zM21.67 23.29l8.81 7.09 12.87-8.15-8.81-7.04zM43.35 8.15L30.48 0l-8.81 7.1 12.87 7.09zM21.7 24.91l-8.83 7.09-4.03-2.64v2.96l12.86 7.72 12.87-7.72v-2.96l-4.04 2.64z" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────

export function DropboxFileBrowser({
  objectApiName,
  recordId,
  folderName,
  defaultSubPath,
  rootLabel,
}: {
  objectApiName: string;
  recordId: string;
  folderName?: string;
  /** Pre-navigate into a subfolder, e.g. "Leads/John Smith" */
  defaultSubPath?: string;
  /** Label shown for the root breadcrumb (defaults to folderName or "Root") */
  rootLabel?: string;
}) {
  const [status, setStatus] = useState<DropboxStatus | null>(null);
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPath, setCurrentPath] = useState<string[]>(
    defaultSubPath ? defaultSubPath.split('/').filter(Boolean) : []
  );
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const subPath = currentPath.join('/');

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
        setContextMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, entry: DropboxEntry) => {
    e.preventDefault();
    e.stopPropagation();
    // Position relative to the table container
    const rect = tableRef.current?.getBoundingClientRect();
    setContextMenuPos({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
    setContextMenuId(entry.id);
  };

  const folderEnsuredKey = useRef<string>('');
  const isFirstEnsure = useRef(true);

  const loadFiles = useCallback(async (retryCount = 0) => {
    // Don't load until we have a real record ID
    if (!recordId) return;

    try {
      const s = await apiClient.getDropboxStatus();
      setStatus(s);

      if (!s.enabled || !s.configured || !s.connected) {
        setEntries([]);
        return;
      }

      // Auto-create the record folder — but only on initial load.
      // When the folder name changes (record was renamed), the server-side
      // PUT handler renames the Dropbox folder before responding, so we
      // just need to list files under the new name.
      const ensureKey = `${recordId}::${folderName}`;
      const nameChanged = folderEnsuredKey.current !== '' && folderEnsuredKey.current !== ensureKey;
      if (folderEnsuredKey.current !== ensureKey) {
        const first = isFirstEnsure.current;
        isFirstEnsure.current = false;
        folderEnsuredKey.current = ensureKey;
        // Only call ensureDropboxFolder on first mount, not on renames
        if (first) {
          try {
            await apiClient.ensureDropboxFolder(objectApiName, recordId, folderName);
          } catch { /* non-fatal — folder may already exist */ }
        }
      }

      try {
        const result = await apiClient.listDropboxFiles(objectApiName, recordId, subPath || undefined, folderName);
        if (result.needsReauth) {
          setStatus({ ...s, connected: false, needsReauth: true });
          setEntries([]);
          return;
        }
        // If folder was just renamed and listing is empty, retry a few times
        // to allow the server-side rename to propagate
        if (nameChanged && result.files.length === 0 && retryCount < 3) {
          await new Promise(r => setTimeout(r, 1500));
          return loadFiles(retryCount + 1);
        }
        setEntries(result.files);
      } catch (fileErr: any) {
        // If listing fails after rename, retry to allow propagation
        if (nameChanged && retryCount < 3) {
          await new Promise(r => setTimeout(r, 1500));
          return loadFiles(retryCount + 1);
        }
        console.error('[DropboxFileBrowser] file listing failed:', fileErr);
        setError(fileErr.message || 'Failed to load files');
      }
    } catch (err: any) {
      console.error('[DropboxFileBrowser] status check failed:', err);
      setError(err.message || 'Failed to load Dropbox status');
      setStatus({ enabled: true, configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, [objectApiName, recordId, subPath, folderName]);

  useEffect(() => {
    if (!recordId) return; // Wait for real record data
    setLoading(true);
    loadFiles();
  }, [loadFiles, recordId]);

  const handleConnect = async () => {
    try {
      const { url } = await apiClient.getDropboxConnectUrl();
      const popup = window.open(url, '_blank', 'noopener');
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'dropbox-oauth-result') {
          window.removeEventListener('message', onMessage);
          if (e.data.status === 'connected') {
            loadFiles();
          } else {
            setError(`Dropbox authorization failed: ${e.data.reason || 'unknown error'}`);
          }
        }
      };
      window.addEventListener('message', onMessage);
      const check = setInterval(() => {
        if (popup?.closed) {
          clearInterval(check);
          window.removeEventListener('message', onMessage);
          loadFiles();
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to start Dropbox authorization');
    }
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file) await apiClient.uploadDropboxFile(objectApiName, recordId, file, subPath || undefined, folderName);
      }
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (entry: DropboxEntry) => {
    try {
      const { url } = await apiClient.getDropboxDownloadUrl(entry.id);
      window.open(url, '_blank');
    } catch {
      setError('Failed to get download link');
    }
  };

  const handleDelete = async (entry: DropboxEntry) => {
    if (!confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
    setDeletingId(entry.id);
    setContextMenuId(null);
    try {
      await apiClient.deleteDropboxFile(entry.id);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await apiClient.createDropboxFolder(objectApiName, recordId, newFolderName.trim(), subPath || undefined, folderName);
      setNewFolderName('');
      setShowNewFolder(false);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderOpen = (folder: DropboxEntry) => {
    setCurrentPath([...currentPath, folder.name]);
    setSearchQuery('');
  };

  const handleNavigateUp = () => {
    setCurrentPath(currentPath.slice(0, -1));
    setSearchQuery('');
  };

  const getDropboxWebUrl = (entryPath?: string) => {
    if (entryPath) {
      // Entry path is the full Dropbox path like /TischlerCRM/opportunities/abc123/file.pdf
      const folderPath = entryPath.substring(0, entryPath.lastIndexOf('/'));
      return `https://www.dropbox.com/home${folderPath}`;
    }
    const pathName = folderName || recordId;
    const basePath = `/TischlerCRM/${objectApiName}/${pathName}`;
    const full = currentPath.length > 0 ? `${basePath}/${currentPath.join('/')}` : basePath;
    return `https://www.dropbox.com/home${full}`;
  };

  const handleBreadcrumb = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
    setSearchQuery('');
  };

  const openInDropbox = async (entryPath?: string) => {
    try {
      await apiClient.ensureDropboxFolder(objectApiName, recordId, folderName);
    } catch { /* non-fatal */ }
    window.open(getDropboxWebUrl(entryPath), '_blank', 'noopener');
  };

  const handleDragStart = (e: React.DragEvent, entry: DropboxEntry) => {
    const data = JSON.stringify({
      path: entry.path,
      name: entry.name,
      isFolder: entry.isFolder,
      sourceObject: objectApiName,
      sourceRecord: recordId,
    });
    e.dataTransfer.setData('application/x-crm-dropbox-entry', data);
    // Also set text/plain so cross-window works (some browsers need this)
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.effectAllowed = 'copyMove';
    setDraggingId(entry.id);

    // Custom drag ghost
    if (dragGhostRef.current) {
      dragGhostRef.current.textContent = entry.isFolder ? `\uD83D\uDCC1 ${entry.name}` : `\uD83D\uDCC4 ${entry.name}`;
      dragGhostRef.current.style.display = 'flex';
      e.dataTransfer.setDragImage(dragGhostRef.current, 0, 0);
      // Hide after a tick so it doesn't stay visible
      requestAnimationFrame(() => {
        if (dragGhostRef.current) dragGhostRef.current.style.display = 'none';
      });
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folder: DropboxEntry) => {
    e.preventDefault();
    e.stopPropagation();
    if (folder.id !== draggingId) {
      setDropTargetId(folder.id);
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDropTargetId(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: DropboxEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    setDraggingId(null);

    const crmData = e.dataTransfer.getData('application/x-crm-dropbox-entry') || e.dataTransfer.getData('text/plain');
    if (!crmData) return;

    try {
      const source = JSON.parse(crmData);
      if (source.path === targetFolder.path) return; // can't drop on self
      setCopying(true);
      setError(null);

      // Build the destination path: target folder's full path + source file name
      const fileName = source.path.split('/').pop();
      const toPath = `${targetFolder.path}/${fileName}`;

      // Use raw copy endpoint with full paths
      await apiClient.copyDropboxFile({
        fromPath: source.path,
        toObjectApiName: objectApiName,
        toRecordId: recordId,
        toFolderName: folderName,
        toSubPath: subPath ? `${subPath}/${targetFolder.name}` : targetFolder.name,
      });
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to copy file');
    } finally {
      setCopying(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setDraggingId(null);
    setDropTargetId(null);

    // Check for internal CRM Dropbox drag (cross-record or same-record file copy)
    const crmData = e.dataTransfer.getData('application/x-crm-dropbox-entry') || e.dataTransfer.getData('text/plain');
    if (crmData) {
      try {
        const source = JSON.parse(crmData);
        // Don't copy to the same folder
        const destFolder = buildCurrentDropboxPath();
        const sourceDir = source.path.substring(0, source.path.lastIndexOf('/'));
        if (sourceDir.toLowerCase() === destFolder.toLowerCase()) return;

        setCopying(true);
        setError(null);
        await apiClient.copyDropboxFile({
          fromPath: source.path,
          toObjectApiName: objectApiName,
          toRecordId: recordId,
          toFolderName: folderName,
          toSubPath: subPath || undefined,
        });
        await loadFiles();
      } catch (err: any) {
        // If parsing fails, it's not our data — fall through to file upload
        if (err instanceof SyntaxError) {
          handleUpload(e.dataTransfer.files);
          return;
        }
        setError(err.message || 'Failed to copy file');
      } finally {
        setCopying(false);
      }
      return;
    }

    // Fall back to OS file upload
    handleUpload(e.dataTransfer.files);
  };

  /** Build the full Dropbox path for the current folder view. */
  const buildCurrentDropboxPath = () => {
    const pathName = folderName || recordId;
    const basePath = `/TischlerCRM/${objectApiName}/${pathName.replace(/[\\/:*?"<>|]/g, '_').trim()}`;
    return currentPath.length > 0 ? `${basePath}/${currentPath.join('/')}` : basePath;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Filter & sort entries
  const filteredEntries = entries
    .filter(e => !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'modifiedAt':
          cmp = (a.modifiedAt || '').localeCompare(b.modifiedAt || '');
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-blue-600">{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 mt-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading Dropbox files…</span>
        </div>
      </div>
    );
  }

  // ── Not enabled ──
  if (!status?.enabled) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 mt-4">
        <div className="flex items-center gap-2 text-gray-400">
          <CloudOff className="w-4 h-4" />
          <span className="text-sm">Dropbox integration is not enabled</span>
        </div>
      </div>
    );
  }

  // ── Not configured / not connected ──
  if (!status.configured || !status.connected) {
    return (
      <div className="border border-gray-200 rounded-lg mt-4">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
          <DropboxLogo className="w-5 h-5" />
          <h3 className="text-sm font-semibold text-gray-700">Dropbox</h3>
        </div>
        <div className="p-8 text-center">
          <CloudOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          {!status.configured ? (
            <p className="text-sm text-gray-500">Dropbox integration is not fully configured. Ask an admin to add the Client ID and Secret in Connected Apps.</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {status.needsReauth
                  ? 'Dropbox permissions have changed. Please reconnect to grant the required access.'
                  : 'Connect your Dropbox account to attach files to this record.'}
              </p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0061FF] rounded-lg hover:bg-[#004FC7] transition"
              >
                <DropboxLogo className="w-4 h-4 [&_path]:fill-white" />
                {status.needsReauth ? 'Reconnect Dropbox' : 'Connect Dropbox'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Connected — full file browser ──
  return (
    <div className="border border-gray-200 rounded-lg mt-4 overflow-visible relative">
      {/* Hidden drag ghost */}
      <div
        ref={dragGhostRef}
        style={{ display: 'none', position: 'fixed', top: -1000, left: -1000, pointerEvents: 'none' }}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-lg text-sm font-medium text-gray-800 whitespace-nowrap"
      />
      {/* Header bar */}
      <div className="bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <DropboxLogo className="w-5 h-5" />
            <h3 className="text-sm font-bold text-gray-800">Dropbox</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Add Files
            </button>
            <button
              onClick={() => { setShowNewFolder(true); setNewFolderName(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New Folder
            </button>
            <button
              onClick={() => openInDropbox()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Dropbox
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Breadcrumb / folder path */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-100 text-sm">
        {currentPath.length > 0 ? (
          <button
            onClick={() => setCurrentPath([])}
            className="text-blue-600 hover:underline font-medium"
          >
            {rootLabel || folderName || 'Root'}
          </button>
        ) : (
          <span className="text-gray-700 font-medium flex items-center gap-1">
            <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
            {rootLabel || folderName || 'Root'}
          </span>
        )}
        {currentPath.map((segment, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-gray-400" />
            {i === currentPath.length - 1 ? (
              <span className="text-gray-700 font-medium">{segment}</span>
            ) : (
              <button
                onClick={() => handleBreadcrumb(i)}
                className="text-blue-600 hover:underline"
              >
                {segment}
              </button>
            )}
          </span>
        ))}
        {currentPath.length > 0 && (
          <button
            onClick={handleNavigateUp}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-xs text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* New folder inline form */}
      {showNewFolder && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
          />
          <button
            onClick={handleCreateFolder}
            disabled={creatingFolder || !newFolderName.trim()}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition disabled:opacity-50"
          >
            {creatingFolder ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={() => setShowNewFolder(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Copying indicator */}
      {copying && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span className="text-xs text-blue-700">Copying file…</span>
        </div>
      )}

      {/* File table / drag-drop zone */}
      <div
        ref={tableRef}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`min-h-[120px] transition relative ${dragOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : 'bg-white'}`}
      >
        {filteredEntries.length === 0 ? (
          <div className="p-10 text-center">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {searchQuery
                ? 'No files match your search.'
                : 'No files yet. Drag & drop or click Add Files.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <SortHeader field="name" label="Name" className="pl-4" />
                <SortHeader field="modifiedAt" label="Modified" />
                <SortHeader field="size" label="Size" />
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, entry)}
                  onDragEnd={handleDragEnd}
                  onDragOver={entry.isFolder ? (e) => handleFolderDragOver(e, entry) : undefined}
                  onDragLeave={entry.isFolder ? handleFolderDragLeave : undefined}
                  onDrop={entry.isFolder ? (e) => handleFolderDrop(e, entry) : undefined}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                  className={`border-b border-gray-50 hover:bg-gray-50 group cursor-grab active:cursor-grabbing transition-colors
                    ${deletingId === entry.id ? 'opacity-50' : ''}
                    ${draggingId === entry.id ? 'opacity-40 bg-gray-100' : ''}
                    ${dropTargetId === entry.id ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}
                  `}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.isFolder ? (
                        <FolderOpen className={`w-4 h-4 shrink-0 ${dropTargetId === entry.id ? 'text-blue-600' : 'text-blue-500'}`} />
                      ) : (
                        <File className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      {entry.isFolder ? (
                        <button
                          onClick={() => handleFolderOpen(entry)}
                          className="text-sm text-blue-600 hover:underline truncate text-left"
                        >
                          {entry.name}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(entry)}
                          className="text-sm text-gray-700 hover:text-blue-600 truncate text-left"
                        >
                          {entry.name}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {entry.isFolder ? '—' : formatDate(entry.modifiedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {entry.isFolder ? '—' : formatBytes(entry.size)}
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      onClick={(e) => {
                        if (contextMenuId === entry.id && !contextMenuPos) {
                          setContextMenuId(null);
                        } else {
                          setContextMenuPos(null);
                          setContextMenuId(entry.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Shared context menu (right-click or dots) */}
        {contextMenuId && (() => {
          const entry = filteredEntries.find(e => e.id === contextMenuId);
          if (!entry) return null;
          const closeMenu = () => { setContextMenuId(null); setContextMenuPos(null); };
          return (
            <div
              ref={contextRef}
              style={contextMenuPos ? { position: 'absolute', left: contextMenuPos.x, top: contextMenuPos.y } : undefined}
              className={`${contextMenuPos ? '' : 'absolute right-4 top-12'} z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]`}
            >
              <button
                onClick={() => { handleDownload(entry); closeMenu(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button
                onClick={() => { openInDropbox(entry.path); closeMenu(); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in Dropbox
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => { handleDelete(entry); closeMenu(); }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          );
        })()}
      </div>

      {/* Footer with file count */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg text-xs text-gray-500">
        {entries.filter(e => !e.isFolder).length} file{entries.filter(e => !e.isFolder).length !== 1 ? 's' : ''}
        {entries.filter(e => e.isFolder).length > 0 && `, ${entries.filter(e => e.isFolder).length} folder${entries.filter(e => e.isFolder).length !== 1 ? 's' : ''}`}
        {currentPath.length > 0 && ` in /${currentPath.join('/')}`}
      </div>
    </div>
  );
}
