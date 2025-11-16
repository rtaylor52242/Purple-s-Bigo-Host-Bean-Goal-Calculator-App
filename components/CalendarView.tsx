
import React, { useMemo } from 'react';
import { CalendarEvent } from '../types';
import { getMonthGrid, getWeekDays } from '../utils/calendar';

interface CalendarViewProps {
  events: CalendarEvent[];
  eventDays: Set<string>;
  view: 'month' | 'week' | 'day';
  currentDate: Date;
  onSetCurrentDate: (date: Date) => void;
  holidays?: Map<string, string>;
  onHolidayClick?: (name: string, date: Date) => void;
  onDayClick?: (date: Date) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ events, eventDays, view, currentDate, onSetCurrentDate, holidays, onHolidayClick, onDayClick }) => {
  const monthGrid = useMemo(() => getMonthGrid(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const changeDate = (amount: number) => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + amount);
    else if (view === 'week') newDate.setDate(newDate.getDate() + (amount * 7));
    else newDate.setDate(newDate.getDate() + amount);
    onSetCurrentDate(newDate);
  };

  const today = new Date();
  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const getHeaderTitle = () => {
    if (view === 'month') {
        return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
        const start = weekDays[0];
        const end = weekDays[6];
        return `${start.toLocaleString('default', { month: 'short', day: 'numeric' })} - ${end.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    const title = currentDate.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
    const holidayName = holidays?.get(currentDate.toISOString().split('T')[0]);
    return holidayName ? `${title} (${holidayName})` : title;
  };
  
  const renderMonthView = () => (
    <div className="grid grid-cols-7 grid-rows-6 flex-grow">
        {monthGrid.map((day, index) => {
            const hasEvents = day.isCurrentMonth && eventDays.has(day.date.toISOString().split('T')[0]);
            const holidayName = holidays?.get(day.date.toISOString().split('T')[0]);
            return (
                <div key={index} className={`border-r border-b border-gray-200 dark:border-gray-700 p-2 flex flex-col ${day.isCurrentMonth ? '' : 'bg-gray-50 dark:bg-gray-800/20'}`}>
                    <span className={`relative font-medium ${isSameDay(day.date, today) ? 'text-purple-600 dark:text-purple-400 font-bold' : day.isCurrentMonth ? '' : 'text-gray-400 dark:text-gray-500'}`}>
                      {day.date.getDate()}
                      {holidayName && (
                        <div 
                          className="absolute -top-1 -right-2 h-2 w-2 bg-red-500 rounded-full cursor-pointer z-10"
                          title={holidayName}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onHolidayClick) {
                              onHolidayClick(holidayName, day.date);
                            } else {
                              alert(holidayName);
                            }
                          }}
                        ></div>
                      )}
                    </span>
                    <div className="mt-1 space-y-1 text-xs overflow-y-auto print:overflow-visible">
                        {hasEvents && (
                          <div
                            className="p-1.5 rounded-md text-white truncate bg-blue-500 cursor-pointer hover:bg-blue-600 text-center font-semibold"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onDayClick) {
                                    onDayClick(day.date);
                                }
                            }}
                          >
                            Events
                          </div>
                        )}
                    </div>
                </div>
            )
        })}
    </div>
  );

  const renderSimplifiedWeekOrDayView = () => {
    const daysToRender = view === 'week' ? weekDays : [currentDate];
    return (
      <div className="grid flex-grow" style={{ gridTemplateColumns: `repeat(${daysToRender.length}, 1fr)` }}>
        {daysToRender.map((day, dayIndex) => {
          const dayISO = day.toISOString().split('T')[0];
          const hasEvents = eventDays.has(dayISO);
          const holidayName = holidays?.get(dayISO);

          return (
            <div key={dayIndex} className="border-r border-b border-gray-200 dark:border-gray-700 p-2 flex flex-col min-h-[120px]">
              {/* Day number is now inside cell for week view */}
              {view === 'week' && (
                <span className={`relative font-medium ${isSameDay(day, today) ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}`}>
                  {day.getDate()}
                  {holidayName && (
                    <div
                      className="absolute -top-1 -right-2 h-2 w-2 bg-red-500 rounded-full cursor-pointer z-10"
                      title={holidayName}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onHolidayClick) onHolidayClick(holidayName, day);
                      }}
                    ></div>
                  )}
                </span>
              )}

              <div className="mt-1 flex-grow space-y-1 text-xs overflow-y-auto print:overflow-visible">
                {hasEvents && (
                  <div
                    className="p-1.5 rounded-md text-white truncate bg-blue-500 cursor-pointer hover:bg-blue-600 text-center font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDayClick) onDayClick(day);
                    }}
                  >
                    Events
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div className="flex flex-col h-full print:h-auto">
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700 print:hidden">
            <button onClick={() => changeDate(-1)} className="px-3 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">&lt;</button>
            <h2 className="text-lg font-semibold">{getHeaderTitle()}</h2>
            <button onClick={() => changeDate(1)} className="px-3 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">&gt;</button>
        </div>
        
        <div className="grid grid-cols-7">
            { (view === 'month' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : weekDays.map(d => d.toLocaleString('default', { weekday: 'short' }))).map((dayHeader, index) => (
                 <div key={index} className="text-center font-semibold text-sm text-gray-600 dark:text-gray-400 p-2 border-b border-gray-200 dark:border-gray-700">
                    {dayHeader}
                </div>
            ))}
        </div>

        <div className="print:block hidden text-center p-4 text-2xl font-bold">{getHeaderTitle()}</div>
        {view === 'month' ? renderMonthView() : renderSimplifiedWeekOrDayView()}
    </div>
  );
};

export default CalendarView;