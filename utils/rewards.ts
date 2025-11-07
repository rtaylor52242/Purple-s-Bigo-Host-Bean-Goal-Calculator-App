
export interface RewardTier {
  tier: string;
  description: string;
  rewards: string[];
}

export const getRewardTier = (beans: number): RewardTier => {
  // Add specific reward structure based on the event screenshot provided.
  // This is triggered when the maximum payout is exactly 2,400 beans.
  if (beans === 2400) {
    return {
      tier: 'Reward Structure',
      description: 'The maximum reward you can receive is 2,400 beans reward.',
      rewards: [
        'lv.1 - if 1,000 beans received, get 600 beans reward',
        'lv.2 - if 2,500 beans received, get extra 900 beans reward',
        'lv.3 - if 5,000 beans received, get extra 900 beans reward',
      ],
    };
  }

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
