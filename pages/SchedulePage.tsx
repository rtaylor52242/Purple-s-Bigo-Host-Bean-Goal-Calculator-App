
import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../App';
import CalendarView from '../components/CalendarView';
import { CalendarEvent, Event, EventSlot, SlotPreference } from '../types';
import { getHolidays } from '../utils/holidays';

// This regex is designed to parse event lines from the AI-generated report.
// It captures: 1. Event Name, 2. Date, 3. Time (12 or 24hr), 4. Duration
const EVENT_LINE_REGEX = /- \s*(.+?)\s*\((\d{2}\/\d{2}\/\d{4})\)\s+at\s+([\d:]{3,5}\s*(?:AM|PM)?)\s+for\s+(\d+)\s*m/;

const SchedulePage: React.FC = () => {
  const { user, events, setUser } = useAppContext();
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPathwayKey, setSelectedPathwayKey] = useState<string | null>(null);
  const [holidayModalInfo, setHolidayModalInfo] = useState<{ name: string; date: Date } | null>(null);

  const holidays = useMemo(() => getHolidays(currentDate.getFullYear()), [currentDate]);

  const slotDetailsMap = useMemo(() => {
    const map = new Map<string, { event: Event, slot: EventSlot }>();
    events.forEach(event => {
        event.slots.forEach(slot => {
            const identifier = `${event.name}|${slot.time}|${slot.duration}`;
            map.set(identifier, { event, slot });
        });
    });
    return map;
  }, [events]);

  const confirmedCalendarEvents = useMemo<CalendarEvent[]>(() => {
    const calendarEvents: CalendarEvent[] = [];
    user.preferredSlots.forEach((pref, identifier) => {
      if (pref.isSelected) {
        const details = slotDetailsMap.get(identifier);
        if (details) {
          const { event, slot } = details;
          const dateMatch = event.name.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
          if (dateMatch?.[1]) {
            const [month, day, year] = dateMatch[1].split('/');
            
            let hours = NaN;
            let minutes = NaN;
            const timeStr = slot.time;

            if (timeStr.includes(':')) {
                const timeParts = timeStr.split(':');
                hours = parseInt(timeParts[0], 10);
                minutes = parseInt(timeParts[1] || '0', 10);
            } else if (timeStr.length >= 3) {
                hours = parseInt(timeStr.slice(0, -2), 10);
                minutes = parseInt(timeStr.slice(-2), 10);
            }
            
            if (isNaN(hours) || isNaN(minutes)) {
                console.warn(`Could not parse time for confirmed event: ${identifier}`);
                return;
            }

            const start = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes));
            
            if (isNaN(start.getTime())) {
                console.warn(`Created invalid date for confirmed event: ${identifier}`);
                return;
            }

            const end = new Date(start.getTime() + slot.duration * 60000);

            calendarEvents.push({
              id: identifier,
              title: event.name.split('(')[0].trim(),
              start,
              end,
              status: 'confirmed',
            });
          }
        }
      }
    });
    return calendarEvents;
  }, [user.preferredSlots, slotDetailsMap]);

  const pathwayOptions = useMemo(() => {
    if (!user.recommendationHistory) return [];
    
    const options: { key: string; label: string }[] = [];
    user.recommendationHistory.forEach(item => {
        const report = item.report;
        const pathwayTitles = report.match(/\*\*(.*?Pathway.*?)\*\*/g);
        
        if (pathwayTitles) {
            pathwayTitles.forEach((titleWithStars) => {
                const cleanTitle = titleWithStars.replace(/\*\*/g, '');
                options.push({
                    key: `${item.id}|${cleanTitle}`,
                    label: `(${new Date(item.date).toLocaleDateString()}) ${cleanTitle}`
                });
            });
        }
    });
    return options;
  }, [user.recommendationHistory]);


  const pathwayEvents = useMemo(() => {
    if (!selectedPathwayKey) return [];

    const [historyId, pathwayTitle] = selectedPathwayKey.split('|');
    if (!historyId || !pathwayTitle) return [];

    const selectedHistoryItem = user.recommendationHistory?.find(h => h.id === historyId);
    if (!selectedHistoryItem) return [];

    const report = selectedHistoryItem.report;
    const escapedTitle = pathwayTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startRegex = new RegExp(`\\*\\*${escapedTitle}\\*\\*`);
    const startIndexMatch = report.match(startRegex);

    if (!startIndexMatch || typeof startIndexMatch.index === 'undefined') {
        return [];
    }
    const startIndex = startIndexMatch.index + startIndexMatch[0].length;

    let endIndex = report.length;
    const nextPathwayMatch = report.substring(startIndex).match(/\*\*(.*?Pathway.*?)\*\*/);
    if (nextPathwayMatch && typeof nextPathwayMatch.index !== 'undefined') {
        endIndex = startIndex + nextPathwayMatch.index;
    } else {
        const summaryMatch = report.substring(startIndex).match(/\*\*Best Pathway Summary\*\*/);
        if (summaryMatch && typeof summaryMatch.index !== 'undefined') {
            endIndex = startIndex + summaryMatch.index;
        }
    }
    const pathwayContent = report.substring(startIndex, endIndex);


    const parsedEvents: CalendarEvent[] = [];
    const lines = pathwayContent.split('\n');

    for (const line of lines) {
      const match = line.match(EVENT_LINE_REGEX);
      if (match) {
        const [, eventName, dateStr, timeStr, durationStr] = match;
        const [month, day, year] = dateStr.split('/');
        const duration = parseInt(durationStr, 10);

        let hours = NaN;
        let minutes = NaN;
        
        const cleanedTime = timeStr.replace(/(AM|PM)/i, '').trim();

        if (cleanedTime.includes(':')) {
            const timeParts = cleanedTime.split(':');
            hours = parseInt(timeParts[0], 10);
            minutes = parseInt(timeParts[1] || '0', 10);
        } else if (cleanedTime.length >= 3) {
            hours = parseInt(cleanedTime.slice(0, -2), 10);
            minutes = parseInt(cleanedTime.slice(-2), 10);
        }

        if (isNaN(duration) || isNaN(hours) || isNaN(minutes) || isNaN(parseInt(year)) || isNaN(parseInt(month)) || isNaN(parseInt(day))) {
            console.warn(`Skipping event line due to parsing error: ${line}`);
            continue;
        }

        if (/PM/i.test(timeStr) && hours < 12) {
            hours += 12;
        }
        if (/AM/i.test(timeStr) && hours === 12) {
            hours = 0;
        }
        
        const start = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hours, minutes));

        if (isNaN(start.getTime())) {
            console.warn(`Skipping event line due to invalid date creation: ${line}`);
            continue;
        }

        const end = new Date(start.getTime() + duration * 60000);
        const time24hr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        
        const fullEventName = `${eventName.trim()} (${dateStr})`;
        const identifier = `${fullEventName}|${time24hr}|${duration}`;

        parsedEvents.push({
          id: identifier,
          title: eventName.trim(),
          start,
          end,
          status: 'preview'
        });
      }
    }
    return parsedEvents;
  }, [selectedPathwayKey, user.recommendationHistory]);
  
  const pathwaySlotsToSelect = useMemo(() => {
    const slotsToSelect = new Map<string, SlotPreference>();
    if (!pathwayEvents || pathwayEvents.length === 0) return slotsToSelect;

    pathwayEvents.forEach(event => {
        const details = slotDetailsMap.get(event.id);
        if (details) {
            const highestTierIndex = details.event.rewardTiers.length - 1;
            slotsToSelect.set(event.id, { isSelected: true, rewardTierIndex: highestTierIndex });
        }
    });
    return slotsToSelect;

  }, [pathwayEvents, slotDetailsMap]);

  const handleApplyPathway = useCallback(() => {
    if (pathwaySlotsToSelect.size === 0) {
        alert("No pathway selected or pathway has no events to add.");
        return;
    }
    
    setUser(prevUser => {
        const newPreferredSlots = new Map<string, SlotPreference>(prevUser.preferredSlots);
        pathwaySlotsToSelect.forEach((pref, identifier) => {
            newPreferredSlots.set(identifier, pref);
        });
        return { ...prevUser, preferredSlots: newPreferredSlots };
    });

    alert(`${pathwaySlotsToSelect.size} event(s) from the selected pathway have been added to your selections!`);
    setSelectedPathwayKey(null);

  }, [pathwaySlotsToSelect, setUser]);

  const eventsToDisplay = useMemo(() => {
    // If a pathway is selected, show ONLY the events from that pathway.
    if (selectedPathwayKey) {
      return pathwayEvents;
    }
    // Otherwise, show the user's confirmed schedule.
    return confirmedCalendarEvents;
  }, [selectedPathwayKey, pathwayEvents, confirmedCalendarEvents]);

  const handleHolidayClick = (name: string, date: Date) => {
    setHolidayModalInfo({ name, date });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-white dark:bg-[#1a1625] rounded-lg shadow-md border border-gray-200 dark:border-gray-700 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event Calendar</h1>
        
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="font-medium text-sm">View:</span>
                {(['month', 'week', 'day'] as const).map(v => (
                    <button 
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === v ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                ))}
            </div>
             <button
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Print
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1625] p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 print:hidden">
        <div className="flex flex-col md:flex-row items-center gap-4">
            <label htmlFor="pathway-select" className="font-medium text-sm flex-shrink-0">Visualize Pathway:</label>
            <select 
                id="pathway-select"
                value={selectedPathwayKey || ''}
                onChange={(e) => setSelectedPathwayKey(e.target.value || null)}
                className="w-full md:w-auto flex-grow bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
            >
                <option value="">-- View Your Schedule Only --</option>
                {pathwayOptions.map(item => (
                    <option key={item.key} value={item.key}>
                        {item.label}
                    </option>
                ))}
            </select>
            {selectedPathwayKey && (
                <button 
                    onClick={handleApplyPathway}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                    Apply Pathway
                </button>
            )}
        </div>
      </div>
      
      <div className="bg-white dark:bg-[#1a1625] p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 print:shadow-none print:border-none print:p-0">
        <CalendarView 
          events={eventsToDisplay}
          view={view}
          currentDate={currentDate}
          onSetCurrentDate={setCurrentDate}
          holidays={holidays}
          onHolidayClick={handleHolidayClick}
        />
      </div>
      {holidayModalInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setHolidayModalInfo(null)}>
          <div className="bg-white dark:bg-[#1a1625] rounded-lg shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">{holidayModalInfo.name}</h3>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
              {holidayModalInfo.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <button
              onClick={() => setHolidayModalInfo(null)}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulePage;
