'use client';

import VerticalBarChartConfigurator from '@/components/VerticalBarChartConfigurator';

// Sample CRM data
const sampleRecords = [
  {
    id: '1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
    ownerName: 'Michael Alexandrou',
    stage: 'Prospecting',
    amount: 25000,
    recordType: 'Opportunity'
  },
  {
    id: '2',
    createdAt: '2024-02-10T09:00:00Z',
    updatedAt: '2024-02-15T14:20:00Z',
    ownerName: 'Sarah Johnson',
    stage: 'Qualification',
    amount: 45000,
    recordType: 'Opportunity'
  },
  {
    id: '3',
    createdAt: '2024-02-20T11:30:00Z',
    updatedAt: '2024-03-01T16:45:00Z',
    ownerName: 'Michael Alexandrou',
    stage: 'Proposal',
    amount: 75000,
    recordType: 'Opportunity'
  },
  {
    id: '4',
    createdAt: '2024-03-05T08:15:00Z',
    updatedAt: '2024-03-10T12:00:00Z',
    ownerName: 'David Chen',
    stage: 'Negotiation',
    amount: 120000,
    recordType: 'Opportunity'
  },
  {
    id: '5',
    createdAt: '2024-03-15T13:45:00Z',
    updatedAt: '2024-03-20T10:30:00Z',
    ownerName: 'Sarah Johnson',
    stage: 'Closed Won',
    amount: 95000,
    recordType: 'Opportunity'
  },
  {
    id: '6',
    createdAt: '2024-04-01T10:00:00Z',
    updatedAt: '2024-04-05T15:00:00Z',
    ownerName: 'Michael Alexandrou',
    stage: 'Closed Won',
    amount: 150000,
    recordType: 'Project'
  },
  {
    id: '7',
    createdAt: '2024-04-10T09:30:00Z',
    updatedAt: '2024-04-12T14:15:00Z',
    ownerName: 'Emily Rodriguez',
    stage: 'Prospecting',
    amount: 30000,
    recordType: 'Opportunity'
  },
  {
    id: '8',
    createdAt: '2024-05-01T11:00:00Z',
    updatedAt: '2024-05-05T16:30:00Z',
    ownerName: 'David Chen',
    stage: 'Qualification',
    amount: 85000,
    recordType: 'Opportunity'
  },
  {
    id: '9',
    createdAt: '2024-05-15T08:45:00Z',
    updatedAt: '2024-05-20T13:20:00Z',
    ownerName: 'Sarah Johnson',
    stage: 'Proposal',
    amount: 110000,
    recordType: 'Project'
  },
  {
    id: '10',
    createdAt: '2024-06-01T10:30:00Z',
    updatedAt: '2024-06-05T15:45:00Z',
    ownerName: 'Michael Alexandrou',
    stage: 'Negotiation',
    amount: 200000,
    recordType: 'Opportunity'
  },
  {
    id: '11',
    createdAt: '2024-06-10T09:15:00Z',
    updatedAt: '2024-06-15T14:30:00Z',
    ownerName: 'Emily Rodriguez',
    stage: 'Closed Won',
    amount: 175000,
    recordType: 'Project'
  },
  {
    id: '12',
    createdAt: '2024-07-01T11:45:00Z',
    updatedAt: '2024-07-05T16:00:00Z',
    ownerName: 'David Chen',
    stage: 'Prospecting',
    amount: 40000,
    recordType: 'Opportunity'
  },
  {
    id: '13',
    createdAt: '2024-07-15T08:30:00Z',
    updatedAt: '2024-07-20T13:45:00Z',
    ownerName: 'Sarah Johnson',
    stage: 'Qualification',
    amount: 65000,
    recordType: 'Opportunity'
  },
  {
    id: '14',
    createdAt: '2024-08-01T10:15:00Z',
    updatedAt: '2024-08-05T15:30:00Z',
    ownerName: 'Michael Alexandrou',
    stage: 'Proposal',
    amount: 90000,
    recordType: 'Project'
  },
  {
    id: '15',
    createdAt: '2024-08-15T09:45:00Z',
    updatedAt: '2024-08-20T14:00:00Z',
    ownerName: 'Emily Rodriguez',
    stage: 'Closed Won',
    amount: 220000,
    recordType: 'Opportunity'
  },
  {
    id: '16',
    createdAt: '2024-09-01T11:30:00Z',
    updatedAt: '2024-09-05T16:15:00Z',
    ownerName: 'David Chen',
    stage: 'Negotiation',
    amount: 130000,
    recordType: 'Project'
  },
  {
    id: '17',
    createdAt: '2024-09-15T08:00:00Z',
    updatedAt: '2024-09-20T13:30:00Z',
    ownerName: 'Sarah Johnson',
    stage: 'Closed Won',
    amount: 185000,
    recordType: 'Opportunity'
  },
  {
    id: '18',
    createdAt: '2024-10-01T10:45:00Z',
    updatedAt: '2024-10-05T15:15:00Z',
    ownerName: 'Michael Alexandrou',
    stage: 'Prospecting',
    amount: 50000,
    recordType: 'Opportunity'
  },
  {
    id: '19',
    createdAt: '2024-10-15T09:30:00Z',
    updatedAt: '2024-10-20T14:45:00Z',
    ownerName: 'Emily Rodriguez',
    stage: 'Qualification',
    amount: 70000,
    recordType: 'Project'
  },
  {
    id: '20',
    createdAt: '2024-11-01T11:15:00Z',
    updatedAt: '2024-11-05T16:30:00Z',
    ownerName: 'David Chen',
    stage: 'Proposal',
    amount: 160000,
    recordType: 'Opportunity'
  }
];

export default function ChartDemoPage() {
  const handleSave = (config: any) => {
    console.log('Chart configuration saved:', config);
    alert('Configuration saved! Check console for details.');
  };

  return (
    <div className="h-screen">
      <VerticalBarChartConfigurator
        records={sampleRecords}
        onSave={handleSave}
        initialConfig={{
          chartTitle: 'Sales Pipeline by Stage',
          groupByField: 'stage',
          metricField: 'amount',
          aggregateFunction: 'sum'
        }}
      />
    </div>
  );
}
