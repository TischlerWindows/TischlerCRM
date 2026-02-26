'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn, formatDateShort } from '@/lib/utils';
import type { Task, TaskStatus } from '@/lib/types';

interface TasksPanelProps {
  tasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onAddTask: (title: string, status: TaskStatus) => void;
  loading?: boolean;
}

export function TasksPanel({ tasks, onToggleComplete, onAddTask, loading }: TasksPanelProps) {
  const [activeTab, setActiveTab] = useState<TaskStatus>('today');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredTasks = tasks.filter((task) => task.status === activeTab);
  const todayCount = tasks.filter((t) => t.status === 'today' && !t.completed).length;
  const upcomingCount = tasks.filter((t) => t.status === 'upcoming').length;
  const overdueCount = tasks.filter((t) => t.status === 'overdue' && !t.completed).length;

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle, activeTab);
    setNewTaskTitle('');
    setIsAdding(false);
  };

  if (loading) {
    return <TasksPanelSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-[#293241]">
        <button
          onClick={() => setActiveTab('today')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors text-white',
            activeTab === 'today'
              ? 'border-white'
              : 'border-transparent hover:text-white'
          )}
        >
          Today
          {todayCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 text-white rounded-full">
              {todayCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors text-white',
            activeTab === 'upcoming'
              ? 'border-white'
              : 'border-transparent hover:text-white'
          )}
        >
          Upcoming
          {upcomingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 text-white rounded-full">
              {upcomingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('overdue')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors text-white',
            activeTab === 'overdue'
              ? 'border-white'
              : 'border-transparent hover:text-white'
          )}
        >
          Overdue
          {overdueCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 text-white rounded-full">
              {overdueCount}
            </span>
          )}
        </button>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeTab === 'today' && 'No tasks due today'}
              {activeTab === 'upcoming' && 'No upcoming tasks'}
              {activeTab === 'overdue' && 'No overdue tasks'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
            >
              <button
                onClick={() => onToggleComplete(task.id)}
                className={cn(
                  'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                  task.completed
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-300 dark:border-gray-600 hover:border-indigo-600 dark:hover:border-indigo-500'
                )}
                aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {task.completed && <Check className="w-3 h-3 text-white" />}
              </button>
              
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    task.completed
                      ? 'line-through text-gray-400 dark:text-gray-600'
                      : 'text-gray-900 dark:text-white'
                  )}
                >
                  {task.title}
                </p>
                {task.relatedTo && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Related: {task.relatedTo}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded-full whitespace-nowrap',
                    task.status === 'overdue'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  )}
                >
                  {formatDateShort(task.dueDate)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick add */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        {isAdding ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewTaskTitle('');
                }
              }}
              placeholder="Task title..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              autoFocus
            />
            <button
              onClick={handleAddTask}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewTaskTitle('');
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}
      </div>
    </div>
  );
}

function TasksPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
        ))}
      </div>
    </div>
  );
}
