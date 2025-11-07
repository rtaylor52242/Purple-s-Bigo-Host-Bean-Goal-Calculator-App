
export interface UserProfile {
  bigoUserId: string;
  phoneNumber: string;
  enableSms: boolean;
  currentBeanCount: number;
  monthlyBeanGoal: number;
  preferredSlots: Set<string>;
  timeFormat: 'military' | 'standard';
}

export interface EventSlot {
  id: string;
  time: string;
  duration: number;
  estimatedPayout: number;
}

export interface Event {
  name: string;
  eventDates: string;
  slots: EventSlot[];
}

export interface DetectedSlot {
  time: string; // "HH:MM"
  duration: number; // in minutes
}

export interface OcrResult {
  eventName: string;
  eventDates: string;
  estimatedPayout: number;
  slots: DetectedSlot[];
}

export interface AdminUploadState {
  file: File | null;
  preview: string | null;
  isLoading: boolean;
  error: string | null;
  ocrResult: OcrResult | null;
  processedEvent: Event | null;
  selectedOcrSlots: Set<string>;
}