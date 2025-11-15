
import React, { useState, useCallback, useMemo } from 'react';
import { useAppContext } from '../App';
import Calendar from '../components/Calendar';
import { formatSelectedDatesForDisplay } from '../utils/date';
import { getHolidays } from '../utils/holidays';

const AdminToolsPage: React.FC = () => {
  const { user, setUser } = useAppContext();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [holidayModalInfo, setHolidayModalInfo] = useState<{ name: string; date: Date } | null>(null);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());

  const holidays = useMemo(() => getHolidays(currentCalendarMonth.getFullYear()), [currentCalendarMonth]);

  const handleCalendarDatesChange = useCallback((newSelectedDates: Set<string>) => {
    setUser(prevUser => ({
      ...prevUser,
      preferredDates: newSelectedDates,
    }));
  }, [setUser]);

  const handleDeleteSelectedDateGroup = useCallback((datesToDelete: string[]) => {
    setUser(prevUser => {
      const newPreferredDates = new Set(prevUser.preferredDates || []);
      datesToDelete.forEach(dateIso => newPreferredDates.delete(dateIso));
      return { ...prevUser, preferredDates: newPreferredDates };
    });
  }, [setUser]);

  const handleHolidayClick = (name: string, date: Date) => {
    setHolidayModalInfo({ name, date });
  };
  
  const handleSavePreferences = () => {
    setSaveMessage("Date preferences saved!");
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000);
  };

  const handleLockToggle = useCallback(() => {
    const newLockState = !(user.isMonthLocked ?? false);
    setUser(prev => ({...prev, isMonthLocked: newLockState}));
    if (newLockState) {
      setCurrentCalendarMonth(new Date());
    }
  }, [user.isMonthLocked, setUser]);

  const formattedSelectedDates = formatSelectedDatesForDisplay(user.preferredDates || new Set());
  
  const uniqueDaysCount = useMemo(() => {
    return user.preferredDates?.size || 0;
  }, [user.preferredDates]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-8">Date Preferences</h1>
        
        <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Preferred Dates</h2>
            <div className="flex items-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-3" id="month-lock-label">
                    Lock to Current Month
                </span>
                <label htmlFor="month-lock-toggle" className="relative inline-flex items-center cursor-pointer">
                    <input 
                    type="checkbox" 
                    id="month-lock-toggle" 
                    className="sr-only peer" 
                    checked={user.isMonthLocked ?? false}
                    onChange={handleLockToggle}
                    aria-labelledby="month-lock-label"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
              <Calendar 
                selectedDates={user.preferredDates || new Set()} 
                onDatesChange={handleCalendarDatesChange}
                currentMonth={currentCalendarMonth}
                onMonthChange={setCurrentCalendarMonth}
                holidays={holidays}
                onHolidayClick={handleHolidayClick}
                isMonthLocked={user.isMonthLocked ?? false}
              />
            </div>
            <div className="flex flex-col h-full min-h-[350px]">
              <label htmlFor="selected-dates-display" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Selected Preferred Dates:</label>
              <div className="mb-2">
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2.5 py-1 rounded-full">
                  Total Unique Days: {uniqueDaysCount}
                </span>
              </div>
              <div 
                id="selected-dates-display" 
                className="flex-grow w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white overflow-y-auto"
                aria-label="Selected dates from calendar"
              >
                {formattedSelectedDates.length > 0 ? (
                  formattedSelectedDates.map(group => (
                    <div key={group.id} className="flex items-center justify-between text-sm py-1">
                      <span>{group.displayString}</span>
                      <button 
                        onClick={() => handleDeleteSelectedDateGroup(group.datesInGroup)}
                        className="ml-2 p-1 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                        aria-label={`Delete ${group.displayString}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 dark:text-gray-500">No dates selected.</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-8 w-full max-w-lg mx-auto">
            <button
              onClick={handleSavePreferences}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-indigo-500"
            >
              Save Date Preferences
            </button>
          </div>
          {saveMessage && (
            <div className="fixed bottom-8 right-8 bg-green-500 text-white py-3 px-6 rounded-lg shadow-xl animate-fade-in-out z-50">
              {saveMessage}
            </div>
          )}
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
    </div>
  );
};

export default AdminToolsPage;