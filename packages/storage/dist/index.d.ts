export type ParentType = 'account' | 'contact' | 'opportunity';
export interface StorageProvider {
    ensureRecordFolder(params: {
        parentType: ParentType;
        parentId: string;
        nameHint?: string;
    }): Promise<{
        url: string;
    }>;
    listFiles(params: {
        folderUrl: string;
    }): Promise<Array<{
        id: string;
        name: string;
        url: string;
        mimeType?: string;
        modifiedAt?: string;
    }>>;
    getPreviewUrl(params: {
        fileId: string;
        folderUrl: string;
    }): Promise<string>;
}
export declare class DropboxStub implements StorageProvider {
    ensureRecordFolder(params: {
        parentType: ParentType;
        parentId: string;
        nameHint?: string;
    }): Promise<{
        url: string;
    }>;
    listFiles(_: {
        folderUrl: string;
    }): Promise<never[]>;
    getPreviewUrl(params: {
        fileId: string;
        folderUrl: string;
    }): Promise<string>;
}
