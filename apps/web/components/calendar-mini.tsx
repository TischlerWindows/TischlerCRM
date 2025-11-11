'use client';

import { useState } from 'react';
import { Calendar, Video, Phone, Clock } from 'lucide-react';
import { formatDateShort } from '@/lib/utils';
import type { CalendarEvent } from '@/lib/types';

interface CalendarMiniProps {
  events: CalendarEvent[];
  loading?: boolean;
}

export function CalendarMini({ events, loading }: CalendarMiniProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  if (loading) {
    return <CalendarMiniSkeleton />;
  }

  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return <Video className="w-4 h-4" />;
      case 'call':
        return <Phone className="w-4 h-4" />;
      case 'deadline':
        return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'call':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'deadline':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    }
  };

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Next 7 Days</h3>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming events</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedEvents.map((event) => (
            <div key={event.id} className="relative">
              <button
                onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-1.5 rounded-lg flex-shrink-0 ${getEventColor(event.type)}`}
                  >
                    {getEventIcon(event.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatDateShort(event.date)}
                      </span>
                      {event.time && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {event.time}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {/* Popover */}
              {selectedEvent?.id === event.id && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>{formatDateShort(event.date)}</span>
                        {event.time && (
                          <>
                            <span>•</span>
                            <span>{event.time}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getEventColor(event.type)}`}
                      >
                        {getEventIcon(event.type)}
                        <span className="capitalize">{event.type}</span>
                      </span>
                    </div>

                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                      <button
                        onClick={() => setSelectedEvent(null)}
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        Close
                      </button>
                      <button
                        className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarMiniSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
      ))}
    </div>
  );
}
