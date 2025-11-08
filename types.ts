
export interface RewardTier {
  level: number;
  beans: number;
  description?: string;
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
