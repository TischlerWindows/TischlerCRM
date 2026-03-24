'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { FileText, Upload, Download, ExternalLink, Loader2, CloudOff, FolderOpen, X, Cloud } from 'lucide-react';

type DropboxFile = {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedAt: string | null;
};

type DropboxStatus = {
  enabled: boolean;
  configured: boolean;
  connected: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DropboxFileBrowser({
  objectApiName,
  recordId,
}: {
  objectApiName: string;
  recordId: string;
}) {
  const [status, setStatus] = useState<DropboxStatus | null>(null);
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      // Always check status first to know if integration is enabled/configured
      const s = await apiClient.getDropboxStatus();
      setStatus(s);

      if (!s.enabled || !s.configured || !s.connected) {
        setFiles([]);
        return;
      }

      // Only fetch files if fully connected
      const result = await apiClient.listDropboxFiles(objectApiName, recordId);
      setFiles(result.files);
    } catch (err: any) {
      console.error('[DropboxFileBrowser] status check failed:', err);
      setError(err.message || 'Failed to load Dropbox status');
      setStatus({ enabled: true, configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, [objectApiName, recordId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleConnect = async () => {
    try {
      const { url } = await apiClient.getDropboxConnectUrl();
      const popup = window.open(url, '_blank', 'noopener');
      // Listen for the OAuth result from the popup
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
      // Fallback: if popup is closed without posting a message, refresh status
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
        if (file) await apiClient.uploadDropboxFile(objectApiName, recordId, file);
      }
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (file: DropboxFile) => {
    try {
      const { url } = await apiClient.getDropboxDownloadUrl(file.id);
      window.open(url, '_blank');
    } catch {
      setError('Failed to get download link');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 mt-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading Dropbox files…</span>
        </div>
      </div>
    );
  }

  // Integration not enabled at all
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

  return (
    <div className="border border-gray-200 rounded-lg mt-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">Dropbox Files</h3>
        </div>
        {status.connected && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            Upload
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

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-xs text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Not connected */}
      {status.configured && !status.connected && (
        <div className="p-6 text-center">
          <CloudOff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">Connect Dropbox to attach files to this record</p>
          <button
            onClick={handleConnect}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Connect Dropbox
          </button>
        </div>
      )}

      {/* Integration enabled but credentials not configured */}
      {!status.configured && (
        <div className="p-6 text-center">
          <CloudOff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Dropbox integration is not fully configured. Ask an admin to add the Client ID and Secret in Connected Apps.</p>
        </div>
      )}

      {/* Connected — file list or empty */}
      {status.connected && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`min-h-[60px] transition ${dragOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''}`}
        >
          {files.length === 0 ? (
            <div className="p-6 text-center">
              <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No files yet. Drag &amp; drop or click Upload.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatBytes(file.size)}</span>
                  </div>
                  <button
                    onClick={() => handleDownload(file)}
                    title="Download"
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
