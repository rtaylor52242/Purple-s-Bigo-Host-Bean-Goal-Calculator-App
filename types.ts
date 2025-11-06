
export interface UserProfile {
  bigoUserId: string;
  phoneNumber: string;
  enableSms: boolean;
  currentBeanCount: number;
  monthlyBeanGoal: number;
  preferredSlots: Set<string>;
}

export interface EventSlot {
  id: string;
  time: string;
  duration: number;
  estimatedPayout: number;
}

export interface Event {
  name: string;
  slots: EventSlot[];
}

export interface OcrResult {
  eventName: string;
  estimatedPayout: number;
}
