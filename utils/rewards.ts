
export interface RewardTier {
  tier: string;
  description: string;
  rewards: string[];
}

export const getRewardTier = (beans: number): RewardTier => {
  // This function now serves as a fallback for events that might not have
  // a detailed reward structure provided by the Gemini API.
  if (beans >= 7500) {
    return { 
      tier: 'Gold Tier', 
      description: 'Top rewards for high earners.', 
      rewards: ['Exclusive profile badge', 'Featured stream slot', '500 bonus coins'] 
    };
  }
  if (beans >= 5000) {
    return { 
      tier: 'Silver Tier', 
      description: 'Great rewards for consistent performance.', 
      rewards: ['Temporary profile frame', '200 bonus coins'] 
    };
  }
  return { 
    tier: 'Bronze Tier', 
    description: 'Standard rewards for participation.', 
    rewards: ['100 bonus coins'] 
  };
};
