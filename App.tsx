
import React, { useState, createContext, useContext, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProfile, Event, AdminUploadState, UploadHistoryItem, SlotPreference, RegionalTier } from './types';
import Header from './components/Header';
import SettingsPage from './pages/SettingsPage';
import AdminUploadPage from './pages/AdminUploadPage';
import AdminToolsPage from './pages/AdminToolsPage';
import LoginPage from './pages/LoginPage';
import SchedulePage from './pages/SchedulePage';
import TierChartPage from './pages/TierChartPage'; // Import new page
import { defaultRegionalTiers } from './data/defaultTiers';

// Mock Data - used as a fallback if no saved data, or to fill missing fields
const defaultInitialUser: UserProfile = {
  bigoUserId: 'Bigo-Host1',
  phoneNumber: '+15551234567',
  enableSms: true,
  currentBeanCount: 150000,
  monthlyBeanGoal: 500000,
  preferredSlots: new Map<string, SlotPreference>(),
  timeFormat: 'standard',
  timeZone: 'America/Los_Angeles',
  maxPathways: 10,
  currentHours: 0, // Re-added
  currentForeignBeanCount: 0, // Re-added
  preferredDates: new Set<string>(), // Re-added
  recommendationHistory: [],
  allowEventAutoselection: false,
  recommendationModel: 'gemini-2.5-pro',
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

// Function to load user profile from localStorage
const loadUserProfileFromLocalStorage = (): UserProfile => {
  try {
    const savedUser = localStorage.getItem('purpleAppUserProfile');
    if (savedUser) {
      const parsedUser: UserProfile = JSON.parse(savedUser);
      // Reconstruct Map from array
      if (parsedUser.preferredSlots && Array.isArray(parsedUser.preferredSlots)) {
        parsedUser.preferredSlots = new Map(parsedUser.preferredSlots as unknown as Iterable<readonly [string, SlotPreference]>);
      } else {
        parsedUser.preferredSlots = new Map();
      }
      // Reconstruct Set from array for preferredDates
      if (parsedUser.preferredDates && Array.isArray(parsedUser.preferredDates)) {
        parsedUser.preferredDates = new Set(parsedUser.preferredDates);
      } else {
        parsedUser.preferredDates = new Set();
      }
      // Merge with default to ensure all fields are present, especially new ones
      return { ...defaultInitialUser, ...parsedUser };
    }
  } catch (error) {
    console.error("Failed to load user profile from localStorage:", error);
    // Clear corrupted data if parsing fails
    localStorage.removeItem('purpleAppUserProfile');
  }
  return defaultInitialUser;
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
  regionalTiers: RegionalTier[] | null; // Re-added
  setRegionalTiers: React.Dispatch<React.SetStateAction<RegionalTier[] | null>>; // Re-added
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
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
  const [user, setUser] = useState<UserProfile>(loadUserProfileFromLocalStorage());
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUploadState, setAdminUploadState] = useState<AdminUploadState>(initialAdminUploadState);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [regionalTiers, setRegionalTiers] = useState<RegionalTier[] | null>(defaultRegionalTiers); // Re-added
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Auto-save user profile to localStorage whenever the user state changes
  useEffect(() => {
    try {
      // Convert Map to array for JSON serialization
      const userToSave = {
        ...user,
        preferredSlots: Array.from(user.preferredSlots.entries()),
        preferredDates: user.preferredDates ? Array.from(user.preferredDates) : [], // Convert Set to Array
      };
      localStorage.setItem('purpleAppUserProfile', JSON.stringify(userToSave));
    } catch (error) {
      console.error("Failed to auto-save user profile to localStorage:", error);
    }
  }, [user]);


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
    regionalTiers, // Re-added
    setRegionalTiers, // Re-added
    theme,
    setTheme,
  };
  
  const defaultAuthenticatedRoute = "/calendar";

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <div className="min-h-screen text-gray-900 dark:text-gray-200">
          {isAuthenticated && <Header />}
          <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 print:max-w-none print:p-0">
            <Routes>
              <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to={defaultAuthenticatedRoute} replace />} />
              <Route path="/settings" element={<ProtectedRoute element={<AdminToolsPage />} />} />
              <Route path="/tier-chart" element={<ProtectedRoute element={<TierChartPage />} />} />
              <Route path="/schedule" element={<ProtectedRoute element={<SettingsPage />} />} />
              <Route path="/calendar" element={<ProtectedRoute element={<SchedulePage />} />} />
              <Route path="/admin-upload" element={<ProtectedRoute element={<AdminUploadPage />} />} />
              <Route path="/" element={<Navigate to={isAuthenticated ? defaultAuthenticatedRoute : "/login"} replace />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AppContext.Provider>
  );
};

export default App;
