
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../App';

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const HelpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


const Header: React.FC = () => {
  const { setIsAuthenticated, theme, setTheme } = useAppContext();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };
  
  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-white'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
    }`;

  const HelpModal = () => (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" 
        onClick={() => setIsHelpModalOpen(false)}
    >
        <div 
            className="bg-white dark:bg-[#1a1625] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">How to Use PurpleApp</h2>
                <button 
                    onClick={() => setIsHelpModalOpen(false)} 
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none text-2xl leading-none"
                    aria-label="Close help"
                >
                    &times;
                </button>
            </div>
            <div className="flex-grow overflow-y-auto p-6 space-y-6 text-gray-700 dark:text-gray-300">
                <div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">1. Event Uploads Page</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Start here by uploading screenshots of your event schedules. You can upload multiple images at once.</li>
                        <li>Click "Process Batch". The AI will analyze each image to extract event details like names, dates, times, and reward tiers.</li>
                        <li>Review the extracted details. You can select or deselect specific time slots for each event before finalizing.</li>
                        <li>Click "Confirm & Create All Valid Events" to add them to the app's available event pool.</li>
                        <li>Your past uploads are saved in the "Upload History" for quick re-importing.</li>
                    </ul>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">2. Date Preferences Page</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Use the interactive calendar to select the dates you prefer to stream.</li>
                        <li>Click a date to select it, or Shift-Click to select a range. Use the header buttons (e.g., 'Sun', 'Mon') to select all of that weekday in the month.</li>
                        <li>Use the quick-select buttons ("Select Month", "Select Weekends", etc.) for faster selection.</li>
                        <li>Enable "Lock to Current Month" to prevent accidentally navigating to other months.</li>
                        <li>Your selected dates are used by the AI to create smarter recommendations on the Schedule page.</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">3. Tier Chart Page</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Upload a screenshot of your official Bigo regional tier chart.</li>
                        <li>The AI will read the image and create an interactive table with your ranks, goals, and payouts.</li>
                        <li>Click on any "Bean Goal" in the table to instantly set it as your "Monthly Bean Goal" on the Schedule page.</li>
                        <li>You can export the data to a CSV file or reset the chart back to the app's default values.</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">4. Schedule Page</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li><b>Profile & Goals:</b> Update your Bigo ID, phone number, current bean/hour counts, and monthly goal.</li>
                        <li><b>Event Preferences:</b> Browse all available events (from your uploads). Check the box next to events to add them to your "confirmed" schedule.</li>
                        <li><b>Recommendations:</b> After selecting some events, click "Process Recommendations". The AI will generate several strategic "pathways" to help you meet your goals.</li>
                        <li>View, print, copy, or have the AI report read aloud to you.</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-2">5. Calendar Page</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>This page provides a visual representation of your schedule.</li>
                        <li>By default, it shows your "confirmed" events (those you selected on the Schedule page).</li>
                        <li>Use the "Visualize Pathway" dropdown to see what your calendar would look like if you followed one of the AI's recommended pathways.</li>
                        <li>If you like a pathway, click "Apply Pathway" to automatically select those events on the Schedule page.</li>
                    </ul>
                </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-right">
                <button 
                    onClick={() => setIsHelpModalOpen(false)} 
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    Got it!
                </button>
            </div>
        </div>
    </div>
  );

  return (
    <>
      <header className="bg-white dark:bg-[#1a1625] shadow-md dark:shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  <span className="text-purple-600 dark:text-purple-400">Purple</span>App
                </span>
              </div>
              <div>
                <div className="ml-4 md:ml-10 flex items-baseline space-x-2 md:space-x-4">
                  <NavLink to="/settings" className={navLinkClass}>
                    Date Preferences
                  </NavLink>
                  <NavLink to="/tier-chart" className={navLinkClass}>
                    Tier Chart
                  </NavLink>
                  <NavLink to="/admin-upload" className={navLinkClass}>
                    Event Uploads
                  </NavLink>
                  <NavLink to="/schedule" className={navLinkClass}>
                    Schedule
                  </NavLink>
                  <NavLink to="/calendar" className={navLinkClass}>
                    Calendar
                  </NavLink>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsHelpModalOpen(true)}
                className="p-2 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                aria-label="Help"
              >
                <HelpIcon />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                onClick={() => setIsAuthenticated(false)}
                className="px-3 md:px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-white"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>
      {isHelpModalOpen && <HelpModal />}
    </>
  );
};

export default Header;
