
import React, { useState, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProfile, Event, AdminUploadState } from './types';
import Header from './components/Header';
import SettingsPage from './pages/SettingsPage';
import AdminUploadPage from './pages/AdminUploadPage';
import LoginPage from './pages/LoginPage';

// Mock Data
const initialUser: UserProfile = {
  bigoUserId: 'Bigo-Host1',
  phoneNumber: '+15551234567',
  enableSms: true,
  currentBeanCount: 150000,
  monthlyBeanGoal: 500000,
  preferredSlots: new Set(['October Bean Spree|10:00|60', 'Weekend Bonanza|14:00|45']),
  timeFormat: 'standard',
};

const initialEvents: Event[] = [
  {
    name: 'October Bean Spree',
    eventDates: '10/01 - 10/31',
    slots: [
      { id: 'obs-1', time: '10:00', duration: 60, estimatedPayout: 5000 },
      { id: 'obs-2', time: '11:00', duration: 60, estimatedPayout: 5000 },
      { id: 'obs-3', time: '13:00', duration: 60, estimatedPayout: 5000 },
    ],
  },
  {
    name: 'Weekend Bonanza',
    eventDates: 'Every Weekend',
    slots: [
      { id: 'wb-1', time: '14:00', duration: 45, estimatedPayout: 7500 },
      { id: 'wb-2', time: '16:00', duration: 45, estimatedPayout: 7500 },
    ],
  },
];

export const initialAdminUploadState: AdminUploadState = {
  file: null,
  preview: null,
  isLoading: false,
  error: null,
  ocrResult: null,
  processedEvent: null,
  // FIX: Explicitly specify the generic type for new Set() to avoid it being inferred as Set<unknown>.
  // This was the root cause for the error in AdminUploadPage.tsx on line 137.
  selectedOcrSlots: new Set<string>(),
};


// App Context
interface AppContextType {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  adminUploadState: AdminUploadState;
  setAdminUploadState: React.Dispatch<React.SetStateAction<AdminUploadState>>;
}

const AppContext = createContext<AppContextType | null>(null);
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

const ProtectedRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { isAuthenticated } = useAppContext();
  return isAuthenticated ? element : <Navigate to="/login" replace />;
};


const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUploadState, setAdminUploadState] = useState<AdminUploadState>(initialAdminUploadState);


  const contextValue: AppContextType = {
    user,
    setUser,
    events,
    setEvents,
    isAuthenticated,
    setIsAuthenticated,
    adminUploadState,
    setAdminUploadState,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <div className="min-h-screen bg-[#10101a] text-gray-200">
          {isAuthenticated && <Header />}
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/settings" replace />} />
              <Route path="/settings" element={<ProtectedRoute element={<SettingsPage />} />} />
              <Route path="/admin-upload" element={<ProtectedRoute element={<AdminUploadPage />} />} />
              <Route path="/" element={<Navigate to={isAuthenticated ? "/settings" : "/login"} replace />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AppContext.Provider>
  );
};

export default App;