
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../App';
import { UserProfile, Event, EventSlot, SlotPreference } from '../types';
import { formatTime } from '../utils/time';

const SettingsPage: React.FC = () => {
  const { user, setUser, events } = useAppContext();
  const [streamDaysError, setStreamDaysError] = useState('');

  const slotDetailsMap = useMemo(() => {
    const map = new Map<string, { event: Event, slot: EventSlot }>();
    events.forEach(event => {
        event.slots.forEach(slot => {
            const identifier = `${event.name}|${slot.time}|${slot.duration}`;
            map.set(identifier, { event, slot });
        });
    });
    return map;
  }, [events]);

  const remainingDaysInMonth = useMemo(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return lastDayOfMonth.getDate() - today.getDate();
  }, []);

  useEffect(() => {
    const availableDays = user.availableStreamDays;
    // The number of available days should not exceed the actual number of days left in the month.
    if (availableDays && availableDays > remainingDaysInMonth + 1) {
      setStreamDaysError(`Stream days cannot exceed the ${remainingDaysInMonth + 1} days left in the month.`);
    } else {
      setStreamDaysError('');
    }
  }, [user.availableStreamDays, remainingDaysInMonth]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    let newValue: any;
    if (type === 'checkbox') {
        newValue = checked;
    } else if (type === 'number') {
        const num = parseInt(value, 10);
        if (name === 'availableStreamDays') {
            newValue = isNaN(num) ? undefined : num;
        } else {
            newValue = num || 0;
        }
    } else {
        newValue = value;
    }

    setUser(prev => ({
        ...prev,
        [name]: newValue,
    }));
  };
  
  const handleSlotToggle = (slotIdentifier: string) => {
    setUser(prevUser => {
        const newPreferredSlots = new Map(prevUser.preferredSlots);
        // FIX: Explicitly typing currentPref to help TypeScript infer the correct type from the Map, resolving spread and property access errors.
        const currentPref: SlotPreference | undefined = newPreferredSlots.get(slotIdentifier);
        const details = slotDetailsMap.get(slotIdentifier);
        const highestTierIndex = details ? details.event.rewardTiers.length - 1 : 0;

        if (currentPref) {
            newPreferredSlots.set(slotIdentifier, { ...currentPref, isSelected: !currentPref.isSelected });
        } else {
            newPreferredSlots.set(slotIdentifier, { isSelected: true, rewardTierIndex: highestTierIndex });
        }
        return { ...prevUser, preferredSlots: newPreferredSlots };
    });
  };

  const handleRewardLevelChange = (slotIdentifier: string, direction: 'up' | 'down') => {
    const details = slotDetailsMap.get(slotIdentifier);
    if (!details) return;

    const tierCount = details.event.rewardTiers.length;

    setUser(prevUser => {
        const newPreferredSlots = new Map(prevUser.preferredSlots);
        // FIX: Explicitly typing currentPref to help TypeScript infer the correct type from the Map, resolving property access errors.
        const currentPref: SlotPreference | undefined = newPreferredSlots.get(slotIdentifier);
        const highestTierIndex = tierCount - 1;

        const currentTierIndex = currentPref ? currentPref.rewardTierIndex : highestTierIndex;
        let nextTierIndex = currentTierIndex;

        if (direction === 'up') {
            nextTierIndex = Math.min(tierCount - 1, currentTierIndex + 1);
        } else {
            nextTierIndex = Math.max(0, currentTierIndex - 1);
        }

        if (nextTierIndex !== currentTierIndex) {
            newPreferredSlots.set(slotIdentifier, {
                isSelected: currentPref ? currentPref.isSelected : false,
                rewardTierIndex: nextTierIndex,
            });
        }
        
        return { ...prevUser, preferredSlots: newPreferredSlots };
    });
  };

  const handleTimeFormatToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isStandard = e.target.checked;
    const newFormat = isStandard ? 'standard' : 'military';
    setUser(prev => ({...prev, timeFormat: newFormat}));
  }
  
  const handleSelectAll = () => {
    setUser(prevUser => {
        const newPreferredSlots = new Map(prevUser.preferredSlots);
        slotDetailsMap.forEach((details, identifier) => {
            // FIX: Explicitly typing currentPref to help TypeScript infer the correct type from the Map, resolving property access errors.
            const currentPref: SlotPreference | undefined = newPreferredSlots.get(identifier);
            const highestTierIndex = details.event.rewardTiers.length - 1;
            newPreferredSlots.set(identifier, {
                isSelected: true,
                rewardTierIndex: currentPref?.rewardTierIndex ?? highestTierIndex,
            });
        });
        return {...prevUser, preferredSlots: newPreferredSlots };
    });
  };

  const handleClearAll = () => {
    setUser(prevUser => {
        const newPreferredSlots = new Map(prevUser.preferredSlots);
        // FIX: Explicitly typing `pref` in the forEach callback to ensure correct type inference, resolving spread errors.
        newPreferredSlots.forEach((pref: SlotPreference, key) => {
            newPreferredSlots.set(key, { ...pref, isSelected: false });
        });
        return {...prevUser, preferredSlots: newPreferredSlots };
    });
  };

  const goalProgress = useMemo(() => {
    const { monthlyBeanGoal, currentBeanCount, availableStreamDays } = user;
    if (monthlyBeanGoal <= 0) return { dailyBeansNeeded: 0, remainingGoal: 0, remainingDays: 0, statusMessage: 'Set a monthly goal to see your progress.' };

    const remainingGoal = Math.max(0, monthlyBeanGoal - currentBeanCount);
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const remainingDaysForCalc = Math.max(1, lastDayOfMonth.getDate() - today.getDate() + 1);
    const remainingDaysForDisplay = lastDayOfMonth.getDate() - today.getDate();

    const daysToStream = (availableStreamDays && availableStreamDays > 0 && !streamDaysError) 
                            ? availableStreamDays 
                            : remainingDaysForCalc;

    const dailyBeansNeeded = Math.ceil(remainingGoal / daysToStream);

    const statusMessage = remainingGoal > 0
      ? `Goal Check: Need ${dailyBeansNeeded.toLocaleString()} beans ${(availableStreamDays && !streamDaysError) ? 'per stream day' : 'per day'}!`
      : `Goal reached! You are ${(currentBeanCount - monthlyBeanGoal).toLocaleString()} beans over.`;
      
    return { dailyBeansNeeded, remainingGoal, remainingDays: remainingDaysForDisplay, statusMessage };
  }, [user, streamDaysError]);

  const selectedSlots = Array.from(user.preferredSlots.entries())
    .filter(([_, pref]) => pref.isSelected)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    
  const BigoUserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  );

  const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
  );


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Your Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Card */}
          <div className="bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Bigo User ID</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3"><BigoUserIcon/></span>
                  <input type="text" name="bigoUserId" value={user.bigoUserId} onChange={handleInputChange} className="pl-10 w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Phone Number (PST)</label>
                 <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3"><PhoneIcon/></span>
                  <input type="tel" name="phoneNumber" value={user.phoneNumber} onChange={handleInputChange} className="pl-10 w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
                 </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex items-center">
                <input type="checkbox" name="enableSms" checked={user.enableSms} onChange={handleInputChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                <span className="ml-2 text-gray-300">Enable SMS Reminders</span>
              </label>
               <label className="flex items-center">
                <input type="checkbox" checked={user.timeFormat === 'standard'} onChange={handleTimeFormatToggle} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                <span className="ml-2 text-gray-300">Use Standard (12-hr) Time</span>
              </label>
            </div>
          </div>

          {/* Event Preferences Card */}
          <div className="bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">Event Preferences</h2>
            
            {selectedSlots.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
                  <h3 className="text-lg font-medium text-purple-400">Your Selections</h3>
                  <button
                    onClick={handleClearAll}
                    disabled={selectedSlots.length === 0}
                    className="px-2 py-1 text-xs font-medium text-red-400 bg-transparent rounded hover:bg-red-900/50 transition-colors focus:outline-none"
                    aria-label="Remove all selected events"
                  >
                    REMOVE ALL
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {selectedSlots.map(([identifier, pref]) => {
                        const details = slotDetailsMap.get(identifier);
                        if (!details) return null;
                        const { event, slot } = details;
                        return (
                            <div key={identifier} className="flex items-center justify-between p-2 bg-[#2a233a] rounded-md">
                                <div>
                                    <p className="text-sm">
                                        <span className="font-semibold text-purple-300">{event.name}</span>
                                        <span className="text-gray-400"> - </span>
                                        <span className="text-gray-300">{formatTime(slot.time, user.timeFormat)} PST for {slot.duration}m</span>
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleSlotToggle(identifier)}
                                    className="px-2 py-1 text-xs font-medium text-red-400 bg-transparent rounded hover:bg-red-900/50 transition-colors focus:outline-none"
                                    aria-label={`Remove ${event.name} at ${formatTime(slot.time, user.timeFormat)}`}
                                >
                                    REMOVE
                                </button>
                            </div>
                        )
                    })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={handleSelectAll} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500">
                Select All Slots
              </button>
              <button onClick={handleClearAll} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500" disabled={selectedSlots.length === 0}>
                Deselect All Slots
              </button>
            </div>

            <h3 className="text-lg font-medium text-purple-400 mt-6 mb-2">All Available Slots</h3>
            <div className="space-y-6 max-h-96 overflow-y-auto pr-2 pt-4">
              {(() => {
                let slotCounter = 0;
                return events.map(event => (
                  <div key={event.name}>
                    <h4 className="text-md font-medium text-purple-400 mb-2">{event.name}</h4>
                    <div className="space-y-2">
                      {event.slots.map(slot => {
                          slotCounter++;
                          const slotIdentifier = `${event.name}|${slot.time}|${slot.duration}`;
                          const tiers = event.rewardTiers;
                          const preference = user.preferredSlots.get(slotIdentifier);
                          const isSelected = preference?.isSelected ?? false;
                          const tierIndex = preference?.rewardTierIndex ?? tiers.length - 1;
                          const currentBeans = tiers[tierIndex]?.beans ?? 0;
                          const isUpDisabled = tierIndex >= tiers.length - 1;
                          const isDownDisabled = tierIndex <= 0;

                          return (
                              <div key={slot.id} className="relative group">
                                  <label className="flex items-center justify-between p-3 bg-[#2a233a] rounded-md hover:bg-purple-900/50 cursor-pointer transition-colors">
                                      <div className="flex items-center">
                                          <input type="checkbox" checked={isSelected} onChange={() => handleSlotToggle(slotIdentifier)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                                          <span className="ml-3 text-gray-300">
                                            <span className="inline-block w-6 text-right mr-2 text-gray-400">{slotCounter}.</span>
                                            {formatTime(slot.time, user.timeFormat)} PST for {slot.duration}m
                                          </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-green-400 font-medium text-sm">~{currentBeans.toLocaleString()} beans</span>
                                        <div className="flex flex-col">
                                          <button onClick={(e) => {e.preventDefault(); handleRewardLevelChange(slotIdentifier, 'up')}} disabled={isUpDisabled} className="disabled:opacity-20 text-white h-4 w-4 flex items-center justify-center rounded-sm hover:bg-white/20">▲</button>
                                          <button onClick={(e) => {e.preventDefault(); handleRewardLevelChange(slotIdentifier, 'down')}} disabled={isDownDisabled} className="disabled:opacity-20 text-white h-4 w-4 flex items-center justify-center rounded-sm hover:bg-white/20">▼</button>
                                        </div>
                                      </div>
                                  </label>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 bg-[#10101a] border border-gray-700 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                      <h4 className="font-bold text-purple-400">Reward Structure</h4>
                                      <p className="text-xs text-gray-300 mb-2">This event has {tiers.length} reward tiers.</p>
                                      <ul className="list-disc list-inside text-xs space-y-1">
                                          {tiers.map((tier) => <li key={tier.level}>Lv.{tier.level}: {tier.beans.toLocaleString()} beans {tier.description && `(${tier.description})`}</li>)}
                                      </ul>
                                  </div>
                              </div>
                          )
                      })}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Bean Goals Card */}
          <div className="bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">Bean Goals</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Current Bean Count</label>
                <input type="number" name="currentBeanCount" value={user.currentBeanCount} onChange={handleInputChange} className="w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Monthly Bean Goal</label>
                <input type="number" name="monthlyBeanGoal" value={user.monthlyBeanGoal} onChange={handleInputChange} className="w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Days Available to Stream this Month</label>
                <input 
                  type="number" 
                  name="availableStreamDays" 
                  value={user.availableStreamDays || ''} 
                  onChange={handleInputChange} 
                  className={`w-full bg-[#2a233a] border rounded-md py-2 px-3 text-white focus:ring-purple-500 ${streamDaysError ? 'border-red-500' : 'border-gray-600'}`}
                  placeholder={`e.g., 15 (max ${remainingDaysInMonth + 1})`}
                />
                {streamDaysError && <p className="mt-2 text-sm text-red-400">{streamDaysError}</p>}
              </div>
            </div>
          </div>

          {/* Goal Progress Card */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-lg shadow-lg text-white">
             <h2 className="text-xl font-semibold mb-4">Goal Progress</h2>
             <div className="space-y-2">
                <p className="font-bold text-lg">{goalProgress.statusMessage}</p>
                {user.monthlyBeanGoal > 0 && goalProgress.remainingGoal > 0 && (
                    <>
                        <p>Remaining Goal: {goalProgress.remainingGoal.toLocaleString()} beans</p>
                        <p>Days Left This Month: {goalProgress.remainingDays}</p>
                    </>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
