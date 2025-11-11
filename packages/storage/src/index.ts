export type ParentType = 'account' | 'contact' | 'opportunity';

export interface StorageProvider {
  ensureRecordFolder(params: {
    parentType: ParentType;
    parentId: string;
    nameHint?: string;
  }): Promise<{ url: string }>; // canonical folder URL

  listFiles(params: {
    folderUrl: string;
  }): Promise<Array<{ id: string; name: string; url: string; mimeType?: string; modifiedAt?: string }>>;

  getPreviewUrl(params: { fileId: string; folderUrl: string }): Promise<string>;
}

export class DropboxStub implements StorageProvider {
  async ensureRecordFolder(params: { parentType: ParentType; parentId: string; nameHint?: string }) {
    const base = process.env.DROPBOX_FOLDER_BASE_URL || 'https://www.dropbox.com/home/CRM';
    return { url: `${base}/${params.parentType}/${params.parentId}` };
  }

  async listFiles(_: { folderUrl: string }) {
    return [];
  }

  async getPreviewUrl(params: { fileId: string; folderUrl: string }) {
    return `${params.folderUrl}?preview=${encodeURIComponent(params.fileId)}`;
  }
}
