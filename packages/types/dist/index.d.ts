export type UUID = string;
export type Role = 'admin' | 'user' | 'viewer';
export interface BaseEntity {
    id: UUID;
    createdAt: string;
    updatedAt: string;
}
export interface Account extends BaseEntity {
    name: string;
    domain?: string | null;
    ownerId: UUID;
}
export interface Contact extends BaseEntity {
    accountId: UUID | null;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    title?: string | null;
    ownerId: UUID | null;
}
export type OpportunityStage = 'prospect' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export interface Opportunity extends BaseEntity {
    accountId: UUID;
    name: string;
    stage: OpportunityStage;
    amount?: number | null;
    closeDate?: string | null;
    ownerId: UUID;
    probability?: number | null;
}
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task';
export interface Activity extends BaseEntity {
    accountId?: UUID | null;
    contactId?: UUID | null;
    opportunityId?: UUID | null;
    type: ActivityType;
    dueDate?: string | null;
    completedAt?: string | null;
    content?: string | null;
    ownerId: UUID;
}
export interface FileLink extends BaseEntity {
    accountId?: UUID | null;
    contactId?: UUID | null;
    opportunityId?: UUID | null;
    dropboxFolderUrl: string;
    lastSyncedAt?: string | null;
}
