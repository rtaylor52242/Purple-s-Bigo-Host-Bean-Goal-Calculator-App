
import React from 'react';
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

const Header: React.FC = () => {
  const { setIsAuthenticated, theme, setTheme } = useAppContext();
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };
  
  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-white'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
    }`;

  return (
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
  );
};

export default Header;
