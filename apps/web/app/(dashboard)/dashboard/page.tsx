'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter } from 'lucide-react';
import { KpiCard, KpiCardSkeleton } from '@/components/kpi-card';
import { OpportunitiesTable } from '@/components/opportunities-table';
import { OpportunityDrawer } from '@/components/opportunity-drawer';
import { NewOpportunityDialog } from '@/components/new-opportunity-dialog';
import { TasksPanel } from '@/components/tasks-panel';
import { CalendarMini } from '@/components/calendar-mini';
import { useToast } from '@/components/toast';
import { fetchKpis, fetchOpportunities, fetchTasks, fetchCalendarEvents } from '@/lib/mock-data';
import type { Kpi, Opportunity, Task, CalendarEvent, NewOpportunityFormData, TaskStatus } from '@/lib/types';

type OpportunityFilter = 'all' | 'my' | 'month';

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();

  // State
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [kpisLoading, setKpisLoading] = useState(true);
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunityFilter, setOpportunityFilter] = useState<OpportunityFilter>('all');
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // Load data
  useEffect(() => {
    loadKpis();
    loadOpportunities();
    loadTasks();
    loadCalendar();
  }, []);

  const loadKpis = async () => {
    setKpisLoading(true);
    const data = await fetchKpis();
    setKpis(data);
    setKpisLoading(false);
  };

  const loadOpportunities = async () => {
    setOpportunitiesLoading(true);
    const data = await fetchOpportunities();
    setOpportunities(data);
    setOpportunitiesLoading(false);
  };

  const loadTasks = async () => {
    setTasksLoading(true);
    const data = await fetchTasks();
    setTasks(data);
    setTasksLoading(false);
  };

  const loadCalendar = async () => {
    setCalendarLoading(true);
    const data = await fetchCalendarEvents();
    setCalendarEvents(data);
    setCalendarLoading(false);
  };

  // Handlers
  const handleOpportunityClick = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setDrawerOpen(true);
  };

  const handleCreateOpportunity = (formData: NewOpportunityFormData) => {
    const newOpportunity: Opportunity = {
      id: `opp-${Date.now()}`,
      name: formData.name,
      accountName: formData.accountName,
      stage: formData.stage,
      amount: formData.amount,
      closeDate: new Date(formData.closeDate),
      ownerName: formData.ownerName,
      notes: formData.notes,
      probability: formData.stage === 'Closed Won' ? 100 : formData.stage === 'Negotiation' ? 75 : 50,
    };

    setOpportunities([newOpportunity, ...opportunities]);
    setDialogOpen(false);
    showToast(`Opportunity "${formData.name}" created successfully!`, 'success');
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleAddTask = (title: string, status: TaskStatus) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      dueDate: new Date(),
      completed: false,
      status,
    };
    setTasks([newTask, ...tasks]);
    showToast('Task added successfully!', 'success');
  };

  // Filter opportunities
  const filteredOpportunities = opportunities.filter((opp) => {
    if (opportunityFilter === 'my') {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      return opp.ownerName === currentUser.name;
    }
    if (opportunityFilter === 'month') {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return opp.closeDate <= nextMonth;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpisLoading
            ? [...Array(4)].map((_, i) => <KpiCardSkeleton key={i} />)
            : kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Opportunities - takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Opportunities
                </h2>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setOpportunityFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    opportunityFilter === 'all'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setOpportunityFilter('my')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    opportunityFilter === 'my'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  My
                </button>
                <button
                  onClick={() => setOpportunityFilter('month')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    opportunityFilter === 'month'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  This Month
                </button>
              </div>
            </div>

            <div className="p-6">
              <OpportunitiesTable
                opportunities={filteredOpportunities}
                onRowClick={handleOpportunityClick}
                loading={opportunitiesLoading}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Tasks */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Tasks
            </h2>
            <TasksPanel
              tasks={tasks}
              onToggleComplete={handleToggleTask}
              onAddTask={handleAddTask}
              loading={tasksLoading}
            />
          </div>

          {/* Calendar */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
            <CalendarMini events={calendarEvents} loading={calendarLoading} />
          </div>
        </div>
      </div>

      {/* Opportunity drawer */}
      <OpportunityDrawer
        opportunity={selectedOpportunity}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setTimeout(() => setSelectedOpportunity(null), 300);
        }}
        onEdit={(opp) => {
          showToast('Edit functionality coming soon!', 'success');
          setDrawerOpen(false);
        }}
      />

      {/* New opportunity dialog */}
      <NewOpportunityDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateOpportunity}
      />
    </div>
  );
}
