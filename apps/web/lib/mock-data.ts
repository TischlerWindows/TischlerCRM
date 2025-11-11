import type { Kpi, Opportunity, Task, CalendarEvent } from './types';

// Simulate async fetch with delay
export async function fetchKpis(): Promise<Kpi[]> {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return [
    {
      id: '1',
      label: 'Open Opportunities',
      value: 24,
      trend: { value: 12, isPositive: true },
    },
    {
      id: '2',
      label: 'Pipeline Value',
      value: '$1.2M',
      trend: { value: 8, isPositive: true },
    },
    {
      id: '3',
      label: 'Tasks Due Today',
      value: 7,
      trend: { value: 3, isPositive: false },
    },
    {
      id: '4',
      label: 'Win Rate %',
      value: '68%',
      trend: { value: 5, isPositive: true },
    },
  ];
}

export async function fetchOpportunities(): Promise<Opportunity[]> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return [
    {
      id: '1',
      name: 'Enterprise Software License',
      accountName: 'Acme Corporation',
      stage: 'Negotiation',
      amount: 125000,
      closeDate: new Date('2025-11-30'),
      ownerName: 'Sarah Chen',
      probability: 75,
      notes: 'Decision maker meeting scheduled for next week',
    },
    {
      id: '2',
      name: 'Cloud Migration Project',
      accountName: 'TechStart Inc',
      stage: 'Proposal',
      amount: 85000,
      closeDate: new Date('2025-12-15'),
      ownerName: 'Michael Brown',
      probability: 60,
    },
    {
      id: '3',
      name: 'Annual Support Renewal',
      accountName: 'Global Industries',
      stage: 'Closed Won',
      amount: 45000,
      closeDate: new Date('2025-11-05'),
      ownerName: 'Sarah Chen',
      probability: 100,
    },
    {
      id: '4',
      name: 'Mobile App Development',
      accountName: 'RetailCo',
      stage: 'Qualification',
      amount: 95000,
      closeDate: new Date('2026-01-20'),
      ownerName: 'David Lee',
      probability: 30,
    },
    {
      id: '5',
      name: 'Security Audit & Compliance',
      accountName: 'FinanceHub',
      stage: 'Negotiation',
      amount: 67000,
      closeDate: new Date('2025-12-01'),
      ownerName: 'Michael Brown',
      probability: 70,
    },
    {
      id: '6',
      name: 'Data Analytics Platform',
      accountName: 'Marketing Pro',
      stage: 'Proposal',
      amount: 110000,
      closeDate: new Date('2025-12-20'),
      ownerName: 'Sarah Chen',
      probability: 50,
    },
    {
      id: '7',
      name: 'Custom Integration',
      accountName: 'Healthcare Systems',
      stage: 'Qualification',
      amount: 55000,
      closeDate: new Date('2026-01-15'),
      ownerName: 'David Lee',
      probability: 40,
    },
  ];
}

export async function fetchTasks(): Promise<Task[]> {
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return [
    {
      id: '1',
      title: 'Follow up with Acme Corp decision maker',
      dueDate: today,
      completed: false,
      status: 'today',
      relatedTo: 'Enterprise Software License',
    },
    {
      id: '2',
      title: 'Prepare proposal for TechStart',
      dueDate: today,
      completed: false,
      status: 'today',
      relatedTo: 'Cloud Migration Project',
    },
    {
      id: '3',
      title: 'Send contract to Global Industries',
      dueDate: new Date(Date.now() - 86400000),
      completed: false,
      status: 'overdue',
    },
    {
      id: '4',
      title: 'Review security requirements with FinanceHub',
      dueDate: new Date(Date.now() + 86400000),
      completed: false,
      status: 'upcoming',
    },
    {
      id: '5',
      title: 'Schedule demo for RetailCo',
      dueDate: new Date(Date.now() + 172800000),
      completed: false,
      status: 'upcoming',
    },
    {
      id: '6',
  title: 'Update TCP records',
      dueDate: today,
      completed: true,
      status: 'today',
    },
  ];
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const today = new Date();
  
  return [
    {
      id: '1',
      title: 'Demo with Acme Corp',
      date: today,
      time: '2:00 PM',
      type: 'meeting',
    },
    {
      id: '2',
      title: 'Call with TechStart CTO',
      date: new Date(Date.now() + 86400000),
      time: '10:30 AM',
      type: 'call',
    },
    {
      id: '3',
      title: 'Proposal deadline - RetailCo',
      date: new Date(Date.now() + 172800000),
      type: 'deadline',
    },
    {
      id: '4',
      title: 'Team sync',
      date: new Date(Date.now() + 259200000),
      time: '9:00 AM',
      type: 'meeting',
    },
    {
      id: '5',
      title: 'FinanceHub security review',
      date: new Date(Date.now() + 345600000),
      time: '3:00 PM',
      type: 'meeting',
    },
  ];
}
