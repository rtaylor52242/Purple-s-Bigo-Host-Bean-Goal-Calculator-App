
import React, { useMemo } from 'react';
import { CalendarEvent } from '../types';
import { getMonthGrid, getWeekDays, getDayHours } from '../utils/calendar';

interface CalendarViewProps {
  events: CalendarEvent[];
  view: 'month' | 'week' | 'day';
  currentDate: Date;
  onSetCurrentDate: (date: Date) => void;
  holidays?: Map<string, string>;
  onHolidayClick?: (name: string, date: Date) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ events, view, currentDate, onSetCurrentDate, holidays, onHolidayClick }) => {
  const monthGrid = useMemo(() => getMonthGrid(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const dayHours = useMemo(() => getDayHours(), []);

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
  
  const formatEventTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const renderMonthView = () => (
    <div className="grid grid-cols-7">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-semibold text-sm text-gray-600 dark:text-gray-400 p-2 border-b border-gray-200 dark:border-gray-700">{day}</div>
        ))}
        {monthGrid.map((day, index) => {
            const eventsForDay = events.filter(e => isSameDay(e.start, day.date));
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
                        {eventsForDay.map(event => (
                            <div key={event.id} className="relative group">
                                <div className={`p-1 rounded-md text-white truncate ${event.status === 'confirmed' ? 'bg-purple-500' : 'bg-green-500'}`}>
                                    {event.title}
                                </div>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                    <h4 className="font-bold">{event.title}</h4>
                                    <p className="text-xs text-gray-300">{formatEventTime(event.start)} - {formatEventTime(event.end)}</p>
                                    <p className={`text-xs font-semibold capitalize ${event.status === 'confirmed' ? 'text-purple-300' : 'text-green-300'}`}>{event.status}</p>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-gray-900"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        })}
    </div>
  );

  const renderWeekOrDayView = () => {
    const daysToRender = view === 'week' ? weekDays : [currentDate];
    return (
        <div className="flex flex-grow overflow-auto print:overflow-visible">
            <div className="w-16 text-right pr-2 text-xs print:hidden">
                {dayHours.map(hour => (
                    <div key={hour} className="h-12 border-t border-gray-200 dark:border-gray-700 flex justify-end items-start pt-1">
                        <span className="relative -top-2 bg-white dark:bg-[#1a1625] px-1 text-gray-500">{hour}</span>
                    </div>
                ))}
            </div>
            <div className="grid flex-grow" style={{ gridTemplateColumns: `repeat(${daysToRender.length}, 1fr)`}}>
                {daysToRender.map((day, dayIndex) => (
                    <div key={dayIndex} className="relative border-l border-gray-200 dark:border-gray-700">
                        <div className="print:hidden">
                            {dayHours.map((_, hourIndex) => (
                                <div key={hourIndex} className="h-12 border-t border-gray-200 dark:border-gray-700"></div>
                            ))}
                        </div>
                        {events.filter(e => isSameDay(e.start, day)).map(event => {
                            const startMinutes = event.start.getUTCHours() * 60 + event.start.getUTCMinutes();
                            const endMinutes = event.end.getUTCHours() * 60 + event.end.getUTCMinutes();
                            const duration = endMinutes - startMinutes;
                            
                            const top = (startMinutes / (24 * 60)) * 100;
                            const height = (duration / (24 * 60)) * 100;

                            return (
                                <div 
                                    key={event.id} 
                                    className={`absolute w-[calc(100%-4px)] ml-[2px] p-2 rounded-md text-white text-xs z-10 group ${event.status === 'confirmed' ? 'bg-purple-600' : 'bg-green-600'} print:relative print:w-auto print:ml-0 print:mb-1 print:h-auto`}
                                    style={{ top: `${top}%`, height: `${height}%`}}
                                >
                                    <p className="font-semibold">{event.title}</p>
                                    <p>{formatEventTime(event.start)} - {formatEventTime(event.end)}</p>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 print:hidden">
                                        <h4 className="font-bold">{event.title}</h4>
                                        <p className="text-xs text-gray-300">{formatEventTime(event.start)} - {formatEventTime(event.end)}</p>
                                        <p className={`text-xs font-semibold capitalize ${event.status === 'confirmed' ? 'text-purple-300' : 'text-green-300'}`}>{event.status}</p>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-gray-900"></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
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
        {view === 'week' && (
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 ml-16 print:ml-0">
                 {weekDays.map(day => {
                    const holidayName = holidays?.get(day.toISOString().split('T')[0]);
                    return (
                        <div key={day.toISOString()} className={`text-center font-semibold text-sm p-2 ${isSameDay(day, today) ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                            <div>{day.toLocaleString('default', { weekday: 'short' })}</div>
                            <div className="flex items-center justify-center gap-1">
                                <span>{day.getDate()}</span>
                                {holidayName && (
                                  <div 
                                    className="h-1.5 w-1.5 bg-red-500 rounded-full cursor-pointer" 
                                    title={holidayName}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onHolidayClick) {
                                        onHolidayClick(holidayName, day);
                                      } else {
                                        alert(holidayName);
                                      }
                                    }}
                                  ></div>
                                )}
                            </div>
                        </div>
                    );
                 })}
            </div>
        )}
        <div className="print:block hidden text-center p-4 text-2xl font-bold">{getHeaderTitle()}</div>
        {view === 'month' ? renderMonthView() : renderWeekOrDayView()}
    </div>
  );
};

export default CalendarView;
