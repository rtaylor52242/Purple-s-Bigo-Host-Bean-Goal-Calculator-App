
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

  const handleDateDelete = useCallback((dateToDelete: string) => {
    setUser(prevUser => {
      const newPreferredDates = new Set(prevUser.preferredDates || []);
      newPreferredDates.delete(dateToDelete);
      return { ...prevUser, preferredDates: newPreferredDates };
    });
  }, [setUser]);

  const handleHolidayClick = (name: string, date: Date) => {
    setHolidayModalInfo({ name, date });
  };
  
  const handleSavePreferences = () => {
    setSaveMessage("Configuration saved!");
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
  
  const sortedPreferredDates = useMemo(() => {
    if (!user.preferredDates) return [];
    return Array.from(user.preferredDates).sort();
  }, [user.preferredDates]);

  const handleEmailConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUser(prevUser => ({
        ...prevUser,
        emailConfig: {
            ...(prevUser.emailConfig || { serviceId: '', templateId: '', publicKey: '' }),
            [name]: value,
        }
    }));
  };

  return (
    <div className="flex flex-col items-center pb-10">
      <div className="w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-8">Date Preferences</h1>
        
        <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
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
                  Total Unique Days: {sortedPreferredDates.length}
                </span>
              </div>
              <div 
                id="selected-dates-display" 
                className="flex-grow w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md p-2 text-gray-900 dark:text-white overflow-y-auto"
                aria-label="Selected dates from calendar"
              >
                {sortedPreferredDates.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sortedPreferredDates.map(isoDate => {
                       const date = new Date(isoDate + 'T00:00:00Z');
                       const formattedDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
                       return (
                        <div key={isoDate} className="flex items-center bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-100 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                          <span>{formattedDate}</span>
                          <button 
                            onClick={() => handleDateDelete(isoDate)}
                            className="ml-2 w-4 h-4 flex items-center justify-center rounded-full text-purple-600 dark:text-purple-200 hover:bg-purple-300 dark:hover:bg-purple-700"
                            aria-label={`Delete ${formattedDate}`}
                          >
                            &times;
                          </button>
                        </div>
                       )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 p-2">No dates selected.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* EmailJS Configuration Section */}
        <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">System Configuration</h2>
            <h3 className="text-md font-medium text-purple-600 dark:text-purple-400 mb-3">EmailJS Settings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Configure these settings to enable the "Give Feedback" feature. You can find these keys in your EmailJS dashboard.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Service ID</label>
                    <input 
                        type="text" 
                        name="serviceId" 
                        value={user.emailConfig?.serviceId || ''} 
                        onChange={handleEmailConfigChange} 
                        className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                        placeholder="service_..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Template ID</label>
                    <input 
                        type="text" 
                        name="templateId" 
                        value={user.emailConfig?.templateId || ''} 
                        onChange={handleEmailConfigChange} 
                        className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                        placeholder="template_..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Public Key</label>
                    <input 
                        type="text" 
                        name="publicKey" 
                        value={user.emailConfig?.publicKey || ''} 
                        onChange={handleEmailConfigChange} 
                        className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                        placeholder="User ID / Public Key"
                    />
                </div>
            </div>
        </div>

        <div className="flex justify-center mt-8 w-full max-w-lg mx-auto">
            <button
              onClick={handleSavePreferences}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-indigo-500"
            >
              Save Configuration
            </button>
        </div>

        {saveMessage && (
            <div className="fixed bottom-8 right-8 bg-green-500 text-white py-3 px-6 rounded-lg shadow-xl animate-fade-in-out z-50">
              {saveMessage}
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
    </div>
  );
};

export default AdminToolsPage;
