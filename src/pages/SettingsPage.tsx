
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../App';
import { UserProfile, Event, EventSlot } from '../types';
import { formatTime } from '../utils/time';
import { getRewardTier } from '../utils/rewards';

const SettingsPage: React.FC = () => {
  const { user, setUser, events } = useAppContext();
  const [formData, setFormData] = useState<UserProfile>(user);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(user.preferredSlots);

  useEffect(() => {
    setFormData(user);
    setSelectedSlots(user.preferredSlots);
  }, [user]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };
  
  const handleSlotToggle = (slotIdentifier: string) => {
    const newSelectedSlots = new Set(selectedSlots);
    if (newSelectedSlots.has(slotIdentifier)) {
      newSelectedSlots.delete(slotIdentifier);
    } else {
      newSelectedSlots.add(slotIdentifier);
    }
    setSelectedSlots(newSelectedSlots);
  };

  const handleTimeFormatToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isStandard = e.target.checked;
    const newFormat = isStandard ? 'standard' : 'military';
    setUser(prev => ({...prev, timeFormat: newFormat}));
    setFormData(prev => ({...prev, timeFormat: newFormat}));
  }
  
  const handleSelectAll = () => {
    const allSlotIdentifiers = new Set<string>(Array.from(slotDetailsMap.keys()));
    setSelectedSlots(allSlotIdentifiers);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all your selected event preferences?')) {
      // FIX: Explicitly specify the generic type for new Set() to avoid it being inferred as Set<unknown>.
      // When an empty Set was used, the type of `selectedSlots` became `Set<unknown>`, causing a type error on line 157 when using its items as map keys.
      setSelectedSlots(new Set<string>());
    }
  };

  const handleSave = () => {
    // The use of a Set for `selectedSlots` inherently prevents duplicates.
    setUser({ ...formData, preferredSlots: selectedSlots });
    alert('Settings saved!');
  };

  const goalProgress = useMemo(() => {
    const { monthlyBeanGoal, currentBeanCount } = formData;
    if (monthlyBeanGoal <= 0) return { dailyBeansNeeded: 0, remainingGoal: 0, remainingDays: 0, statusMessage: 'Set a monthly goal to see your progress.' };

    const remainingGoal = Math.max(0, monthlyBeanGoal - currentBeanCount);
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const remainingDays = Math.max(1, lastDayOfMonth.getDate() - today.getDate() + 1);
    const dailyBeansNeeded = Math.ceil(remainingGoal / remainingDays);

    const statusMessage = remainingGoal > 0
      ? `Goal Check: Need ${dailyBeansNeeded.toLocaleString()} beans today!`
      : `Goal reached! You are ${(currentBeanCount - monthlyBeanGoal).toLocaleString()} beans over.`;
      
    return { dailyBeansNeeded, remainingGoal, remainingDays, statusMessage };
  }, [formData.monthlyBeanGoal, formData.currentBeanCount]);

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
                  <input type="text" name="bigoUserId" value={formData.bigoUserId} onChange={handleInputChange} className="pl-10 w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Phone Number (PST)</label>
                 <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3"><PhoneIcon/></span>
                  <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="pl-10 w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
                 </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex items-center">
                <input type="checkbox" name="enableSms" checked={formData.enableSms} onChange={handleInputChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                <span className="ml-2 text-gray-300">Enable SMS Reminders</span>
              </label>
               <label className="flex items-center">
                <input type="checkbox" checked={formData.timeFormat === 'standard'} onChange={handleTimeFormatToggle} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                <span className="ml-2 text-gray-300">Use Standard (12-hr) Time</span>
              </label>
            </div>
          </div>

          {/* Event Preferences Card */}
          <div className="bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">Event Preferences</h2>
            
            {selectedSlots.size > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-purple-400 mb-3 border-b border-gray-700 pb-2">Your Selections</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mt-3">
                    {Array.from(selectedSlots).sort().map(identifier => {
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
                Select All
              </button>
              <button onClick={handleClearAll} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500" disabled={selectedSlots.size === 0}>
                Clear All
              </button>
            </div>

            <h3 className="text-lg font-medium text-purple-400 mt-6 mb-2">All Available Slots</h3>
            <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
              {events.map(event => (
                <div key={event.name}>
                  <h4 className="text-md font-medium text-purple-400 mb-2">{event.name}</h4>
                  <div className="space-y-2">
                    {event.slots.map(slot => {
                        const slotIdentifier = `${event.name}|${slot.time}|${slot.duration}`;
                        const rewardInfo = getRewardTier(slot.estimatedPayout);
                        return (
                            <div key={slot.id} className="relative group">
                                <label className="flex items-center justify-between p-3 bg-[#2a233a] rounded-md hover:bg-purple-900/50 cursor-pointer transition-colors">
                                    <div className="flex items-center">
                                        <input type="checkbox" checked={selectedSlots.has(slotIdentifier)} onChange={() => handleSlotToggle(slotIdentifier)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                                        <span className="ml-3 text-gray-300">{formatTime(slot.time, user.timeFormat)} PST for {slot.duration}m</span>
                                    </div>
                                    <span className="text-green-400 font-medium">~{slot.estimatedPayout.toLocaleString()} beans</span>
                                </label>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 bg-[#10101a] border border-gray-700 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    <h4 className="font-bold text-purple-400">{rewardInfo.tier}</h4>
                                    <p className="text-xs text-gray-300 mb-2">{rewardInfo.description}</p>
                                    <ul className="list-disc list-inside text-xs space-y-1">
                                        {rewardInfo.rewards.map((reward, i) => <li key={i}>{reward}</li>)}
                                    </ul>
                                </div>
                            </div>
                        )
                    })}
                  </div>
                </div>
              ))}
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
                <input type="number" name="currentBeanCount" value={formData.currentBeanCount} onChange={handleInputChange} className="w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Monthly Bean Goal</label>
                <input type="number" name="monthlyBeanGoal" value={formData.monthlyBeanGoal} onChange={handleInputChange} className="w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>
            </div>
          </div>

          {/* Goal Progress Card */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-lg shadow-lg text-white">
             <h2 className="text-xl font-semibold mb-4">Goal Progress</h2>
             <div className="space-y-2">
                <p className="font-bold text-lg">{goalProgress.statusMessage}</p>
                {formData.monthlyBeanGoal > 0 && goalProgress.remainingGoal > 0 && (
                    <>
                        <p>Remaining Goal: {goalProgress.remainingGoal.toLocaleString()} beans</p>
                        <p>Days Left This Month: {goalProgress.remainingDays}</p>
                    </>
                )}
             </div>
          </div>

          <button onClick={handleSave} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;