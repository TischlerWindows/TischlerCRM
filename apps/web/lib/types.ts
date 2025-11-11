export interface Kpi {
  id: string;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
}

export type OpportunityStage = 'Qualification' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';

export interface Opportunity {
  id: string;
  name: string;
  accountName: string;
  stage: OpportunityStage;
  amount: number;
  closeDate: Date;
  ownerName: string;
  probability?: number;
  notes?: string;
}

export type TaskStatus = 'today' | 'upcoming' | 'overdue';

export interface Task {
  id: string;
  title: string;
  dueDate: Date;
  completed: boolean;
  status: TaskStatus;
  relatedTo?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time?: string;
  type: 'meeting' | 'call' | 'deadline';
}

export interface NewOpportunityFormData {
  name: string;
  accountName: string;
  stage: OpportunityStage;
  amount: number;
  closeDate: string;
  ownerName: string;
  notes?: string;
}
