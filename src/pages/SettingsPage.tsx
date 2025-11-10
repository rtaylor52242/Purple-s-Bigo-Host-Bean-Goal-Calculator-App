import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../App';
import { UserProfile, Event, EventSlot, SlotPreference, RegionalTier } from '../types';
import { formatTime } from '../utils/time';

const SettingsPage: React.FC = () => {
  const { user, setUser, events, regionalTiers } = useAppContext();
  const [maxPathwaysError, setMaxPathwaysError] = useState('');
  const [isBigoIdLocked, setIsBigoIdLocked] = useState(true); // Re-added
  const [saveMessage, setSaveMessage] = useState<string | null>(null); // Re-added

  useEffect(() => {
    // Corrected typo from `regionalTers` to `regionalTiers` in older versions.
    if (regionalTiers && regionalTiers.length > 0) {
      const availableGoals = regionalTiers.map(t => t.goal);
      if (!availableGoals.includes(user.monthlyBeanGoal)) {
        setUser(prev => ({
          ...prev,
          // Set to the first goal in the list which is the highest
          monthlyBeanGoal: availableGoals[0],
        }));
      }
    }
  }, [regionalTiers, user.monthlyBeanGoal, setUser]);

  const timeZoneOptions = useMemo(() => {
    try {
        // FIX: Cast Intl to any to use 'supportedValuesOf' which might not be in the default TS lib.
        return (Intl as any).supportedValuesOf('timeZone').map((timeZone: string) => {
            const offset = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset', timeZone }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value ?? '';
            const displayOffset = offset.replace('GMT', 'UTC');
            return { value: timeZone, label: `(${displayOffset}) ${timeZone.replace(/_/g, ' ')}` };
        }).sort((a, b) => {
            const offsetA = parseFloat(a.label.match(/([+-]\d+(:[0-5]\d)?)/)?.[0].replace(':', '.') || '0');
            const offsetB = parseFloat(b.label.match(/([+-]\d+(:[0-5]\d)?)/)?.[0].replace(':', '.') || '0');
            if (offsetA !== offsetB) return offsetA - offsetB;
            return a.label.localeCompare(b.label);
        });
    } catch (e) {
        // Fallback for older browsers
        return [
            { value: 'UTC', label: '(UTC+00:00) Coordinated Universal Time' },
            { value: 'Europe/London', label: '(UTC+01:00) London, Dublin' },
            { value: 'America/New_York', label: '(UTC-04:00) Eastern Time (US & Canada)' },
            { value: 'America/Chicago', label: '(UTC-05:00) Central Time (US & Canada)' },
            { value: 'America/Los_Angeles', label: '(UTC-07:00) Pacific Time (US & Canada)' },
        ];
    }
  }, []);

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

  const availableSlotsByEvent = useMemo(() => {
    const grouped = new Map<string, { event: Event, slots: EventSlot[] }>();
    events.forEach(event => {
        const unselectedSlots = event.slots.filter(slot => {
            const identifier = `${event.name}|${slot.time}|${slot.duration}`;
            return !user.preferredSlots.get(identifier)?.isSelected;
        });

        if (unselectedSlots.length > 0) {
            grouped.set(event.name, { event, slots: unselectedSlots });
        }
    });
    return grouped;
  }, [events, user.preferredSlots]);

  const totalAvailableSlots = useMemo(() => {
    // FIX: Explicitly type the accumulator `count` to `number` to resolve a type inference issue.
    return Array.from(availableSlotsByEvent.values()).reduce((count: number, eventData: { slots: EventSlot[] }) => count + eventData.slots.length, 0);
  }, [availableSlotsByEvent]);

  const remainingDaysInMonth = useMemo(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    // Include the current day in the count
    return lastDayOfMonth.getDate() - today.getDate() + 1; 
  }, []);

  useEffect(() => {
    const pathways = user.maxPathways;
    if (pathways && pathways > 20) {
      setMaxPathwaysError('Maximum pathways cannot exceed 20.');
    } else {
      setMaxPathwaysError('');
    }
  }, [user.maxPathways]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox' && e.target instanceof HTMLInputElement;

    let newValue: any;
    if (isCheckbox) {
        newValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'phoneNumber') {
        if (value === '' || value === '+') {
            newValue = value;
        } else {
            const digits = value.replace(/\D/g, '');
            newValue = `+${digits}`;
        }
    } else if (['currentBeanCount', 'monthlyBeanGoal', 'currentHours', 'currentForeignBeanCount'].includes(name)) {
        const num = parseInt(value.replace(/,/g, ''), 10);
        newValue = isNaN(num) ? 0 : num; // Ensure it's a number, default to 0
    } else if (type === 'number') {
        const num = parseInt(value, 10);
        if (name === 'maxPathways') {
            // Allow empty string to mean undefined, otherwise cap between 0 and 20
            newValue = value === '' ? undefined : Math.max(0, Math.min(num, 20)); 
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
        const newPreferredSlots = new Map<string, SlotPreference>(prevUser.preferredSlots);
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
        const newPreferredSlots = new Map<string, SlotPreference>(prevUser.preferredSlots);
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
                isSelected: currentPref?.isSelected ?? false,
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
        const newPreferredSlots = new Map<string, SlotPreference>(prevUser.preferredSlots);
        slotDetailsMap.forEach((details, identifier) => {
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
        const newPreferredSlots = new Map<string, SlotPreference>(prevUser.preferredSlots);
        newPreferredSlots.forEach((pref: SlotPreference, key) => {
            newPreferredSlots.set(key, { ...pref, isSelected: false });
        });
        return {...prevUser, preferredSlots: newPreferredSlots };
    });
  };

  const handleSaveSettings = () => {
    // Rely on App.tsx's useEffect to auto-save any changes to the user object.
    // This button primarily provides visual feedback to the user.
    setSaveMessage("Settings saved!");
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000); // Message disappears after 3 seconds
  };

  const goalProgress = useMemo(() => {
    // === START DIAGNOSTIC LOGS ===
    console.log('SettingsPage (goalProgress useMemo) - Start');
    console.log('  user.monthlyBeanGoal (initial in useMemo):', user.monthlyBeanGoal);
    console.log('  user.currentHours (initial in useMemo):', user.currentHours);
    console.log('  regionalTiers (initial in useMemo):', regionalTiers);
    // === END DIAGNOSTIC LOGS ===

    const { monthlyBeanGoal, currentBeanCount } = user;
    
    if (!regionalTiers || regionalTiers.length === 0) {
      console.warn('SettingsPage (goalProgress useMemo): regionalTiers is null or empty. Cannot calculate hours left.');
      return { dailyBeansNeeded: 0, remainingGoal: 0, remainingDays: 0, statusMessage: 'Regional tiers not loaded.', hoursLeftToGoal: 0 };
    }

    if (monthlyBeanGoal <= 0) {
      console.log('SettingsPage (goalProgress useMemo): monthlyBeanGoal is 0 or less. Returning early.');
      return { dailyBeansNeeded: 0, remainingGoal: 0, remainingDays: 0, statusMessage: 'Set a monthly goal to see your progress.', hoursLeftToGoal: 0 };
    }

    const remainingGoal = Math.max(0, monthlyBeanGoal - currentBeanCount);
    
    const remainingDaysForCalc = Math.max(1, remainingDaysInMonth); // Use remainingDaysInMonth
    const remainingDaysForDisplay = remainingDaysInMonth; // Fix: Directly use the calculated remainingDaysInMonth for display

    const daysToStream = remainingDaysForCalc;

    const dailyBeansNeeded = Math.ceil(remainingGoal / daysToStream);

    const statusMessage = remainingGoal > 0
      ? `Goal Check: Need ${dailyBeansNeeded.toLocaleString()} beans per day!`
      : `Goal reached! You are ${(currentBeanCount - monthlyBeanGoal).toLocaleString()} beans over.`;
      
    // Determine hours left to goal
    const selectedMonthlyGoalTier = regionalTiers.find(tier => tier.goal === user.monthlyBeanGoal);
    
    // Diagnostic log: Check selected tier
    console.log('  SettingsPage (goalProgress useMemo): selectedMonthlyGoalTier =', selectedMonthlyGoalTier);

    const hoursRequiredForGoal = selectedMonthlyGoalTier?.hoursRequired ?? 0;
    const hoursLeftToGoal = Math.max(0, hoursRequiredForGoal - (user.currentHours ?? 0));

    // Diagnostic log: Check final hoursLeftToGoal
    console.log('  SettingsPage (goalProgress useMemo): hoursLeftToGoal (final) =', hoursLeftToGoal);

    return { dailyBeansNeeded, remainingGoal, remainingDays: remainingDaysForDisplay, statusMessage, hoursLeftToGoal };
  }, [user, remainingDaysInMonth, regionalTiers]);

  const selectedSlots = Array.from(user.preferredSlots.entries())
    .filter(([_, pref]) => pref.isSelected)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    
  const BigoUserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  );

  const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
  );

  const TimeZoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
  );

  const LockClosedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  );

  const LockOpenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 9a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Card */}
          <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Bigo ID</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3"><BigoUserIcon/></span>
                  <input 
                    type="text" 
                    name="bigoUserId" 
                    value={user.bigoUserId} 
                    onChange={handleInputChange} 
                    readOnly={isBigoIdLocked}
                    className={`pl-10 pr-10 w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500 ${isBigoIdLocked ? 'cursor-not-allowed opacity-70' : ''}`} 
                    placeholder="Enter your Bigo ID" />
                  <button onClick={() => setIsBigoIdLocked(!isBigoIdLocked)} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label={isBigoIdLocked ? 'Unlock Bigo ID field' : 'Lock Bigo ID field'}>
                    {isBigoIdLocked ? <LockClosedIcon/> : <LockOpenIcon/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Phone Number</label>
                 <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3"><PhoneIcon/></span>
                  <input type="tel" name="phoneNumber" value={user.phoneNumber} onChange={handleInputChange} className="pl-10 w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500" placeholder="+1234567890" />
                 </div>
              </div>
              <div className="md:col-span-2">
                 <label htmlFor="timeZone" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Your Local Time Zone</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3"><TimeZoneIcon/></span>
                    <select
                      id="timeZone"
                      name="timeZone"
                      value={user.timeZone}
                      onChange={handleInputChange}
                      className="pl-10 block w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                    >
                      {timeZoneOptions.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex items-center">
                <input type="checkbox" name="enableSms" checked={user.enableSms} onChange={handleInputChange} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                <span className="ml-2 text-gray-700 dark:text-gray-300">Enable SMS Reminders</span>
              </label>
               <label className="flex items-center">
                <input type="checkbox" checked={user.timeFormat === 'standard'} onChange={handleTimeFormatToggle} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                <span className="ml-2 text-gray-700 dark:text-gray-300">Use Standard (12-hr) Time</span>
              </label>
            </div>
          </div>

          {/* Event Preferences Card */}
          <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Event Preferences</h2>
            
            {selectedSlots.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                  <h3 className="text-lg font-medium text-purple-600 dark:text-purple-400">Your Selections</h3>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-2.5 py-1 rounded-full">{selectedSlots.length} selected</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {selectedSlots.map(([identifier, pref]) => {
                        const details = slotDetailsMap.get(identifier);
                        if (!details) return null;
                        const { event, slot } = details;
                        const selectedTier = pref.rewardTierIndex < event.rewardTiers.length ? event.rewardTiers[pref.rewardTierIndex] : null;
                        const beans = selectedTier ? selectedTier.beans : 0;
                        return (
                            <div key={identifier} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-[#2a233a] rounded-md">
                                <div>
                                    <p className="text-sm">
                                        <span className="font-semibold text-purple-600 dark:text-purple-300">{event.name}</span>
                                        <span className="text-gray-500 dark:text-gray-400"> - </span>
                                        <span className="text-gray-700 dark:text-gray-300">{formatTime(slot.time, user.timeFormat, event, user.timeZone)} for {slot.duration}m</span>
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">~{beans.toLocaleString()} beans</p>
                                </div>
                                <button 
                                    onClick={() => handleSlotToggle(identifier)}
                                    className="px-2 py-1 text-xs font-medium text-red-500 dark:text-red-400 bg-transparent rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors focus:outline-none"
                                    aria-label={`Remove ${event.name} at ${formatTime(slot.time, user.timeFormat, event, user.timeZone)}`}
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
                Remove All Slots
              </button>
            </div>

            <div className="flex justify-between items-center mt-6 mb-2">
              <h3 className="text-lg font-medium text-purple-600 dark:text-purple-400">All Available Slots</h3>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700/50 px-2.5 py-1 rounded-full">{totalAvailableSlots} available</span>
            </div>
            <div className="space-y-6 max-h-96 overflow-y-auto pr-2 pb-40">
              {availableSlotsByEvent.size > 0 ? (
                (() => {
                  let slotCounter = 0;
                  return Array.from(availableSlotsByEvent.values()).map(({ event, slots }) => (
                    <div key={event.name}>
                      <h4 className="text-md font-medium text-purple-600 dark:text-purple-400 mb-2">{event.name}</h4>
                      <div className="space-y-2">
                        {slots.map(slot => {
                            slotCounter++;
                            const slotIdentifier = `${event.name}|${slot.time}|${slot.duration}`;
                            const tiers = event.rewardTiers;
                            const preference = user.preferredSlots.get(slotIdentifier);
                            const isSelected = preference?.isSelected ?? false;
                            const tierIndex = preference?.rewardTierIndex ?? tiers.length - 1;
                            const currentTier = tiers[tierIndex];
                            const currentBeans = currentTier?.beans ?? 0;
                            const currentLevel = currentTier?.level;
                            const isUpDisabled = tierIndex >= tiers.length - 1;
                            const isDownDisabled = tierIndex <= 0;

                            return (
                                <div key={slot.id} className="relative group">
                                    <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-[#2a233a] rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-colors">
                                        <div className="flex items-center">
                                            <input type="checkbox" checked={isSelected} onChange={() => handleSlotToggle(slotIdentifier)} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                                            <span className="ml-3 text-gray-700 dark:text-gray-300">
                                              <span className="inline-block w-6 text-right mr-2 text-gray-500 dark:text-gray-400">{slotCounter}.</span>
                                              {formatTime(slot.time, user.timeFormat, event, user.timeZone)} for {slot.duration}m
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                                            ~{currentBeans.toLocaleString()} beans
                                            {typeof currentLevel === 'number' && <span className="text-purple-500 dark:text-purple-300 text-xs ml-1">(Lv.{currentLevel})</span>}
                                          </span>
                                          <div className="flex flex-col">
                                            <button onClick={() => handleRewardLevelChange(slotIdentifier, 'up')} disabled={isUpDisabled} className="disabled:opacity-20 text-gray-800 dark:text-white h-4 w-4 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/20">▲</button>
                                            <button onClick={() => handleRewardLevelChange(slotIdentifier, 'down')} disabled={isDownDisabled} className="disabled:opacity-20 text-gray-800 dark:text-white h-4 w-4 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/20">▼</button>
                                          </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-xs p-3 bg-white dark:bg-[#10101a] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                        <h4 className="font-bold text-purple-600 dark:text-purple-400">Reward Structure</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">This event has {tiers.length} reward tiers.</p>
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
                })()
               ) : (
                <div className="text-center py-10">
                  <p className="text-gray-400 dark:text-gray-500">
                    {events.length > 0 ? "All available slots have been selected." : "No events have been added yet."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Goal Information Card */}
          <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Goal Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Current Bean Count</label>
                <input type="text" name="currentBeanCount" value={user.currentBeanCount.toLocaleString()} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Current Foreign Bean count</label>
                <input type="text" name="currentForeignBeanCount" value={user.currentForeignBeanCount?.toLocaleString() ?? ''} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Current Hours</label>
                <input type="text" name="currentHours" value={user.currentHours?.toLocaleString() ?? ''} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Days Remaining to Stream this Month</label>
                <div className="w-full bg-gray-200 dark:bg-[#322b44] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-700 dark:text-gray-300 cursor-not-allowed">
                  {remainingDaysInMonth}
                </div>
              </div>
              <div>
                <label htmlFor="monthlyBeanGoal" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Monthly Bean Goal</label>
                <select
                  id="monthlyBeanGoal"
                  name="monthlyBeanGoal"
                  value={user.monthlyBeanGoal}
                  onChange={handleInputChange}
                  className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                  disabled={!regionalTiers || regionalTiers.length === 0}
                >
                  {regionalTiers && regionalTiers.map(tier => (
                    <option key={tier.rank} value={tier.goal}>
                      {tier.goal.toLocaleString()} ({tier.hoursRequired} hrs)
                    </option>
                  ))}
                </select>
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Max Pathways to Goal</label>
                <input 
                  type="number" 
                  name="maxPathways" 
                  value={user.maxPathways === undefined ? '' : user.maxPathways} 
                  onChange={handleInputChange} 
                  min="0"
                  className={`w-full bg-gray-100 dark:bg-[#2a233a] border rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 ${maxPathwaysError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                  placeholder="e.g., 10 (max 20)"
                />
                {maxPathwaysError && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{maxPathwaysError}</p>}
              </div>
            </div>
          </div>

          {/* Goal Progress Card */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-lg shadow-lg text-white">
             <h2 className="text-xl font-semibold mb-4">Goal Progress</h2>
             <div className="space-y-2">
                <p className="font-bold text-lg">{goalProgress.statusMessage}</p>
                {user.monthlyBeanGoal > 0 && ( // Display progress if goal is set
                    <>
                        {goalProgress.remainingGoal > 0 && <p>Remaining Goal: {goalProgress.remainingGoal.toLocaleString()} beans</p>}
                        <p>Days Left This Month: {goalProgress.remainingDays}</p>
                        <p>Hours Left To Goal: {goalProgress.hoursLeftToGoal.toLocaleString()}</p>
                    </>
                )}
             </div>
          </div>
        </div>
      </div>
      <div className="flex justify-center mt-8 w-full max-w-lg">
        <button
          onClick={handleSaveSettings}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-indigo-500"
        >
          Save All Changes
        </button>
      </div>
      {saveMessage && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white py-3 px-6 rounded-lg shadow-xl animate-fade-in-out z-50">
          {saveMessage}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;