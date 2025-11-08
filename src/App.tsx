
import React, { useState, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProfile, Event, AdminUploadState, UploadHistoryItem, SlotPreference } from './types';
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
  preferredSlots: new Map<string, SlotPreference>(),
  timeFormat: 'standard',
};

const initialEvents: Event[] = [];

export const initialAdminUploadState: AdminUploadState = {
  file: null,
  preview: null,
  isLoading: false,
  error: null,
  ocrResult: null,
  processedEvent: null,
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
  uploadHistory: UploadHistoryItem[];
  setUploadHistory: React.Dispatch<React.SetStateAction<UploadHistoryItem[]>>;
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
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);


  const contextValue: AppContextType = {
    user,
    setUser,
    events,
    setEvents,
    isAuthenticated,
    setIsAuthenticated,
    adminUploadState,
    setAdminUploadState,
    uploadHistory,
    setUploadHistory,
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
