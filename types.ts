// FIX: Import Dispatch and SetStateAction from React to use in AppContextType.
import type { Dispatch, SetStateAction } from 'react';

export interface RewardTier {
  level: number;
  beans: number;
  description?: string;
}

export interface RegionalTier {
  rank: string;
  goal: number;
  hoursRequired: number;
  payout: number;
  agencySupport: number;
  walletProfit: number;
}

export interface SlotPreference {
  isSelected: boolean;
  rewardTierIndex: number;
}

export interface UploadHistoryItem {
  id: string; // Using ISO string of the date for a unique ID
  preview: string;
  date: Date;
  ocrResult: OcrResult | null;
}

export interface UserProfile {
  bigoUserId: string;
  phoneNumber: string;
  enableSms: boolean;
  currentBeanCount: number;
  monthlyBeanGoal: number;
  preferredSlots: Map<string, SlotPreference>;
  timeFormat: 'military' | 'standard';
  availableStreamDays?: number;
  timeZone: string;
  maxPathways?: number;
  currentHours?: number;
  currentForeignBeanCount?: number;
  preferredDates?: Set<string>; // New: Stores selected dates from the calendar as ISO strings
}

export interface EventSlot {
  id: string;
  time: string;
  duration: number;
}

export interface Event {
  name: string;
  eventDates: string;
  slots: EventSlot[];
  rewardTiers: RewardTier[];
}

export interface DetectedSlot {
  time: string; // "HH:MM"
  duration: number; // in minutes
}

export interface OcrResult {
  eventName: string;
  eventDates: string;
  rebatePercent?: number;
  rewardTiers: RewardTier[];
  slots: DetectedSlot[];
}

export interface AdminUploadState {
  file: File | null;
  preview: string | null;
  isLoading: boolean;
  error: string | null;
  ocrResult: OcrResult | null;
  processedEvent: Omit<Event, 'slots'> & { slots: Omit<EventSlot, 'id'|'estimatedPayout'>[] } | null;
  selectedOcrSlots: Set<string>;
}

export interface AppContextType {
  user: UserProfile;
  setUser: Dispatch<SetStateAction<UserProfile>>;
  events: Event[];
  setEvents: Dispatch<SetStateAction<Event[]>>;
  isAuthenticated: boolean;
  setIsAuthenticated: Dispatch<SetStateAction<boolean>>;
  adminUploadState: AdminUploadState;
  setAdminUploadState: Dispatch<SetStateAction<AdminUploadState>>;
  uploadHistory: UploadHistoryItem[];
  setUploadHistory: Dispatch<SetStateAction<UploadHistoryItem[]>>;
  regionalTiers: RegionalTier[] | null;
  setRegionalTiers: Dispatch<SetStateAction<RegionalTier[] | null>>;
  theme: 'light' | 'dark';
  setTheme: Dispatch<SetStateAction<'light' | 'dark'>>;
}