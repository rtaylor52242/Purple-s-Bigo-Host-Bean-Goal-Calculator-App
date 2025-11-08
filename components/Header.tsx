import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../App';

const Header: React.FC = () => {
  const { setIsAuthenticated } = useAppContext();
  
  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive
        ? 'bg-purple-800 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <header className="bg-[#1a1625] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold text-white">
                <span className="text-purple-400">Purple</span>App
              </span>
            </div>
            <div>
              <div className="ml-4 md:ml-10 flex items-baseline space-x-2 md:space-x-4">
                <NavLink to="/settings" className={navLinkClass}>
                  Settings
                </NavLink>
                <NavLink to="/admin-upload" className={navLinkClass}>
                  Admin Upload
                </NavLink>
              </div>
            </div>
          </div>
          <div>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="px-3 md:px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
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