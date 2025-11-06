
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../App';
import { UserProfile } from '../types';

const SettingsPage: React.FC = () => {
  const { user, setUser, events } = useAppContext();
  const [formData, setFormData] = useState<UserProfile>(user);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(user.preferredSlots);

  useEffect(() => {
    setFormData(user);
    setSelectedSlots(user.preferredSlots);
  }, [user]);

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

  const handleSave = () => {
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
            <div className="mt-6">
              <label className="flex items-center">
                <input type="checkbox" name="enableSms" checked={formData.enableSms} onChange={handleInputChange} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                <span className="ml-2 text-gray-300">Enable SMS Reminders</span>
              </label>
            </div>
          </div>

          {/* Event Preferences Card */}
          <div className="bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">Event Preferences</h2>
            <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
              {events.map(event => (
                <div key={event.name}>
                  <h3 className="text-lg font-medium text-purple-400 mb-2">{event.name}</h3>
                  <div className="space-y-2">
                    {event.slots.map(slot => {
                        const slotIdentifier = `${event.name}|${slot.time}|${slot.duration}`;
                        return (
                            <label key={slot.id} className="flex items-center justify-between p-3 bg-[#2a233a] rounded-md hover:bg-purple-900/50 cursor-pointer transition-colors">
                                <div className="flex items-center">
                                    <input type="checkbox" checked={selectedSlots.has(slotIdentifier)} onChange={() => handleSlotToggle(slotIdentifier)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                                    <span className="ml-3 text-gray-300">{slot.time} PST for {slot.duration}m</span>
                                </div>
                                <span className="text-green-400 font-medium">~{slot.estimatedPayout.toLocaleString()} beans</span>
                            </label>
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
