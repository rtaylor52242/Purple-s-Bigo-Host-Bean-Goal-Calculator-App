import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../App';
import CalendarView from '../components/CalendarView';
import { CalendarEvent, Event, EventSlot, SlotPreference, UserProfile } from '../types';
import { getHolidays } from '../utils/holidays';
import { getWeekDays } from '../utils/calendar';

// This regex is designed to parse event lines from the AI-generated report.
// It captures: 1. Event Name, 2. Date, 3. Time (12 or 24hr), 4. Duration
const EVENT_LINE_REGEX = /- \s*(.+?)\s*\((\d{2}\/\d{2}\/\d{4})\)\s+at\s+([\d:]{3,5}\s*(?:AM|PM)?)\s+for\s+(\d+)\s*m/;

const PrintableSchedule: React.FC<{ events: CalendarEvent[]; title: string; user: UserProfile; }> = ({ events, title, user }) => {
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: CalendarEvent[] } = {};
    events.forEach(event => {
      const dateKey = event.start.toISOString().split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    // Sort events within each group by start time
    for (const key in groups) {
      groups[key].sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return groups;
  }, [events]);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="text-black">
      <h1 className="text-3xl font-bold mb-4 text-center">{title}</h1>
      <div className="space-y-6">
        {sortedDates.map(dateKey => (
          <div key={dateKey}>
            <h2 className="text-xl font-semibold border-b border-gray-400 pb-2 mb-2">
              {new Date(dateKey + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
            </h2>
            <ul className="space-y-2">
              {groupedEvents[dateKey].map(event => (
                <li key={event.id} className={`p-3 rounded-md border-l-4 bg-gray-50 ${event.status === 'confirmed' ? 'border-purple-500' : 'border-green-500'}`}>
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-sm">
                    {event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: user.timeZone || 'UTC' })}
                    {' - '}
                    {event.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: user.timeZone || 'UTC' })}
                  </p>
                  <p className={`text-xs font-bold uppercase mt-1 ${event.status === 'confirmed' ? 'text-purple-600' : 'text-green-600'}`}>
                    {event.status}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {events.length === 0 && <p className="text-center">No events to display.</p>}
      </div>
    </div>
  );
};


const SchedulePage: React.FC = () => {
  const { user, events, setEvents, setUser } = useAppContext();
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPathwayKey, setSelectedPathwayKey] = useState<string | null>(null);
  const [holidayModalInfo, setHolidayModalInfo] = useState<{ name: string; date: Date } | null>(null);
  const [dayDetailModal, setDayDetailModal] = useState<{ isOpen: boolean; date: Date | null }>({ isOpen: false, date: null });


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

  const handleLoadSamples = () => {
    if (!user.preferredDates || user.preferredDates.size === 0) {
      alert("Please select some preferred dates on the 'Date Preferences' page first.");
      return;
    }

    const newSampleEvents: Event[] = [];
    const existingEventNames = new Set(events.map(e => e.name));
    const allPreferredDates = Array.from(user.preferredDates);

    // Step 1: Determine which new sample events need to be created.
    for (const isoDate of allPreferredDates) {
      const date = new Date(isoDate + 'T00:00:00Z');
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(date);
      const eventName = `Sample Event (${formattedDate})`;

      if (!existingEventNames.has(eventName)) {
        newSampleEvents.push({
          name: eventName,
          eventDates: formattedDate,
          rewardTiers: [
            { level: 1, beans: 1000 },
            { level: 2, beans: 2500 },
            { level: 3, beans: 5000 },
          ],
          slots: [
            { id: `${eventName}-1`, time: '09:00', duration: 60 },
            { id: `${eventName}-2`, time: '14:00', duration: 60 },
            { id: `${eventName}-3`, time: '19:00', duration: 60 },
          ],
        });
      }
    }

    // Step 2: Update events state if new ones were created.
    if (newSampleEvents.length > 0) {
      setEvents(prevEvents => [...prevEvents, ...newSampleEvents].sort((a, b) => a.name.localeCompare(b.name)));
    }

    // Step 3: Update the user profile to select all slots for all relevant sample events (both new and existing).
    setUser(prevUser => {
      const newPreferredSlots = new Map<string, SlotPreference>(prevUser.preferredSlots);
      
      // We must use the events from context PLUS the new events we just created
      // to ensure we can select slots from events that haven't been rendered yet.
      const allRelevantEvents = [...events, ...newSampleEvents];

      allPreferredDates.forEach(isoDate => {
        const date = new Date(isoDate + 'T00:00:00Z');
        const formattedDate = new Intl.DateTimeFormat('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          timeZone: 'UTC'
        }).format(date);
        const eventName = `Sample Event (${formattedDate})`;

        const targetEvent = allRelevantEvents.find(e => e.name === eventName);
        if (targetEvent) {
          targetEvent.slots.forEach(slot => {
            const identifier = `${targetEvent.name}|${slot.time}|${slot.duration}`;
            const highestTierIndex = targetEvent.rewardTiers.length - 1;
            newPreferredSlots.set(identifier, {
              isSelected: true,
              rewardTierIndex: highestTierIndex,
            });
          });
        }
      });

      return { ...prevUser, preferredSlots: newPreferredSlots };
    });

    // Step 4: Provide user feedback.
    if (newSampleEvents.length > 0) {
      alert(`${newSampleEvents.length} sample event(s) created and selected.`);
    } else {
      alert("Existing sample events for preferred dates have been selected.");
    }
  };

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
  
  const eventDays = useMemo(() => {
    return new Set(eventsToDisplay.map(event => event.start.toISOString().split('T')[0]));
  }, [eventsToDisplay]);

  const eventsForModal = useMemo(() => {
    if (!dayDetailModal.date) return [];
    
    const modalDate = dayDetailModal.date;
    
    // Create a UTC start and end for the clicked day
    const modalDateStart = new Date(Date.UTC(modalDate.getFullYear(), modalDate.getMonth(), modalDate.getDate()));
    const modalDateEnd = new Date(Date.UTC(modalDate.getFullYear(), modalDate.getMonth(), modalDate.getDate() + 1));

    return eventsToDisplay.filter(event => {
      const eventStart = event.start;
      return eventStart >= modalDateStart && eventStart < modalDateEnd;
    }).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [dayDetailModal.date, eventsToDisplay]);

  const handleHolidayClick = (name: string, date: Date) => {
    setHolidayModalInfo({ name, date });
  };

  const handleDayClick = useCallback((date: Date) => {
    setDayDetailModal({ isOpen: true, date });
  }, []);

  const handleCloseModal = () => {
    setDayDetailModal({ isOpen: false, date: null });
  };

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const headerTitle = useMemo(() => {
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
  }, [view, currentDate, holidays, weekDays]);


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
              onClick={handleLoadSamples}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              Load Samples
            </button>
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
      
      <div className="bg-white dark:bg-[#1a1625] p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 print:hidden">
        <CalendarView 
          events={eventsToDisplay}
          eventDays={eventDays}
          onDayClick={handleDayClick}
          view={view}
          currentDate={currentDate}
          onSetCurrentDate={setCurrentDate}
          holidays={holidays}
          onHolidayClick={handleHolidayClick}
        />
      </div>

      <div className="hidden print:block">
        <PrintableSchedule events={eventsToDisplay} title={`Schedule for ${headerTitle}`} user={user} />
      </div>

      {dayDetailModal.isOpen && dayDetailModal.date && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div className="bg-white dark:bg-[#1a1625] rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Events for {dayDetailModal.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <button 
                onClick={handleCloseModal} 
                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none text-2xl leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-3">
              {eventsForModal.length > 0 ? (
                eventsForModal.map(event => (
                  <div key={event.id} className={`p-3 rounded-md border-l-4 ${event.status === 'confirmed' ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500' : 'bg-green-50 dark:bg-green-900/30 border-green-500'}`}>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{event.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: user.timeZone || 'UTC' })}
                      {' - '}
                      {event.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: user.timeZone || 'UTC' })}
                    </p>
                    <p className={`text-xs font-bold uppercase mt-1 ${event.status === 'confirmed' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}`}>
                      {event.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No events scheduled for this day.</p>
              )}
            </div>
          </div>
        </div>
      )}

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
