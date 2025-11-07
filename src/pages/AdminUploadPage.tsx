
import React, { useState } from 'react';
import { extractEventDetailsFromImage } from '../services/geminiService';
import { Event, EventSlot } from '../types';
import { useAppContext, initialAdminUploadState } from '../App';
import { formatTime } from '../utils/time';
import { parseEventDates } from '../utils/date';
import { getRewardTier } from '../utils/rewards';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const UploadIcon = () => (
    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

interface DateTimeSlot {
  id: string; // e.g., '2025-11-08T16:00'
  date: Date;
  time: string; // HH:MM
  duration: number;
}

const AdminUploadPage: React.FC = () => {
  const { setEvents, user, adminUploadState, setAdminUploadState } = useAppContext();
  const { file, preview, isLoading, error, ocrResult, processedEvent, selectedOcrSlots } = adminUploadState;
  
  const [dateTimeSlots, setDateTimeSlots] = useState<DateTimeSlot[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      if (preview) {
        URL.revokeObjectURL(preview);
      }

      const previewUrl = URL.createObjectURL(selectedFile);
      setAdminUploadState({
        ...initialAdminUploadState,
        file: selectedFile,
        preview: previewUrl,
      });
      setDateTimeSlots([]);
    }
  };

  const removeImage = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setAdminUploadState(initialAdminUploadState);
    setDateTimeSlots([]);
  };
  
  const handleOcrSlotToggle = (slotId: string) => {
    setAdminUploadState(prev => {
        const newSet = new Set(prev.selectedOcrSlots);
        if (newSet.has(slotId)) {
            newSet.delete(slotId);
        } else {
            newSet.add(slotId);
        }
        return { ...prev, selectedOcrSlots: newSet };
    });
  };

  const handleProcess = async () => {
    if (!file) {
      setAdminUploadState(prev => ({...prev, error: 'Please upload a screenshot.'}));
      return;
    }
    setAdminUploadState(prev => ({...prev, isLoading: true, error: null}));
    
    try {
      const base64Image = await fileToBase64(file);
      const result = await extractEventDetailsFromImage(base64Image);
      
      const parsedSlots: EventSlot[] = result.slots.map((slot, index) => ({
            id: `${result.eventName.replace(/\s+/g, '-')}-${index}`,
            time: slot.time,
            duration: slot.duration,
            estimatedPayout: result.estimatedPayout,
        }));
        
      if(parsedSlots.length === 0) {
        throw new Error("No valid time slots were detected in the image. Please try another image.");
      }

      const dates = parseEventDates(result.eventDates);
      const generatedSlots: DateTimeSlot[] = [];
      dates.forEach(date => {
        result.slots.forEach(slot => {
          generatedSlots.push({
            id: `${date.toISOString().split('T')[0]}T${slot.time}`,
            date,
            time: slot.time,
            duration: slot.duration,
          });
        });
      });
      setDateTimeSlots(generatedSlots);

      setAdminUploadState(prev => ({
        ...prev,
        ocrResult: result,
        processedEvent: { name: result.eventName, eventDates: result.eventDates, slots: parsedSlots },
        selectedOcrSlots: new Set(generatedSlots.map(s => s.id)), // Pre-select all
      }));

    } catch (err: any) {
      setAdminUploadState(prev => ({ ...prev, error: err.message || 'Failed to process image. Please try again.'}));
    } finally {
      setAdminUploadState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleConfirmEvent = () => {
    if (processedEvent && dateTimeSlots.length > 0) {
      const selectedSlotsById: { [id: string]: DateTimeSlot } = {};
      dateTimeSlots.forEach(s => { selectedSlotsById[s.id] = s; });

      const selectedDateSlots = Array.from(selectedOcrSlots)
        .map(id => selectedSlotsById[id])
        // FIX: The error on line 137 was caused by `selectedOcrSlots` being `Set<unknown>`. While that's fixed in `App.tsx`,
        // this `.map` operation can produce `undefined` values. A type predicate is used here to correctly narrow the array
        // type from `(DateTimeSlot | undefined)[]` to `DateTimeSlot[]`, preventing potential errors in the `.reduce` call below.
        .filter((slot): slot is DateTimeSlot => Boolean(slot));

      if (selectedDateSlots.length === 0) {
        alert("Please select at least one time slot to create the event.");
        return;
      }

      // Group by date
      const groupedByDate = selectedDateSlots.reduce((acc, slot) => {
        const dateKey = slot.date.toISOString().split('T')[0];
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(slot);
        return acc;
      }, {} as Record<string, DateTimeSlot[]>);

      const eventsToAdd: Event[] = [];
      for (const dateKey in groupedByDate) {
        const slotsForDate = groupedByDate[dateKey];
        const formattedDate = new Date(dateKey+'T00:00:00').toLocaleDateString('en-US', { timeZone:'UTC', month: '2-digit', day: '2-digit', year: 'numeric' });
        
        const eventToAdd: Event = {
          name: `${processedEvent.name} (${formattedDate})`,
          eventDates: formattedDate,
          slots: slotsForDate.map((s, index) => ({
            id: `${processedEvent.name.replace(/\s+/g, '-')}-${dateKey}-${index}`,
            time: s.time,
            duration: s.duration,
            estimatedPayout: processedEvent.slots[0]?.estimatedPayout || 0,
          })).sort((a, b) => a.time.localeCompare(b.time)),
        };
        eventsToAdd.push(eventToAdd);
      }
      
      setEvents(prevEvents => {
        const newEvents = [...prevEvents];
        let addedCount = 0;
        let existingCount = 0;
        eventsToAdd.forEach(eventToAdd => {
          const eventExists = prevEvents.some(e => e.name === eventToAdd.name);
          if (!eventExists) {
            newEvents.push(eventToAdd);
            addedCount++;
          } else {
            existingCount++;
          }
        });

        let alertMessage = '';
        if (addedCount > 0) {
          alertMessage += `${addedCount} new event(s) have been created!`;
        }
        if (existingCount > 0) {
          alertMessage += `\n${existingCount} event(s) already existed and were not added again.`
        }
        alert(alertMessage.trim());

        return newEvents;
      });
      
      removeImage();
    }
  };

  // --- Modal and Zoom handlers ---
  const openModal = () => setIsModalOpen(true);
  
  const closeModal = () => {
    setIsModalOpen(false);
    handleResetZoom();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartDrag({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - startDrag.x,
      y: e.clientY - startDrag.y,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev * zoomFactor, 5));
    } else {
      setScale((prev) => Math.max(prev / zoomFactor, 0.5));
    }
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev / 1.2, 0.5));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };


  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-white text-center mb-8">Admin Event Upload</h1>
        <div className="bg-[#1a1625] p-8 rounded-lg shadow-md border border-gray-700 space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Event Screenshot</label>
            {!preview ? (
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <UploadIcon/>
                  <div className="flex text-sm text-gray-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-[#2a233a] rounded-md font-medium text-purple-400 hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-purple-500 px-1">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <img 
                    src={preview} 
                    alt="Event preview" 
                    className="w-auto max-h-60 mx-auto rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={openModal}
                />
                <button onClick={removeImage} className="absolute top-2 right-2 bg-red-600/80 text-white rounded-full p-1 text-xs hover:bg-red-700">
                  Remove
                </button>
              </div>
            )}
          </div>
          
          {file && (
              <button onClick={handleProcess} disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {isLoading ? 'Processing...' : (processedEvent ? 'Re-process Image' : 'Upload & Process')}
              </button>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          
          {processedEvent && ocrResult && (
            <div className="border-t border-gray-700 pt-6 space-y-4">
                 <div className="text-center">
                    <p className="text-gray-300">
                        Event detected: <span className="font-bold text-purple-400">{processedEvent.name}</span>
                    </p>
                    <p className="text-gray-300">
                        Est. payout of <span className="font-bold text-green-400">{processedEvent.slots[0].estimatedPayout.toLocaleString()} beans</span>
                    </p>
                 </div>

                <h3 className="text-lg font-medium text-white text-center pt-2">Select Available Time Slots</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {dateTimeSlots.map(slot => {
                        const formattedDate = `${slot.date.getUTCMonth() + 1}/${slot.date.getUTCDate()}/${slot.date.getUTCFullYear()}`;
                        const rewardInfo = getRewardTier(processedEvent.slots[0]?.estimatedPayout || 0);
                        return (
                            <div key={slot.id} className="relative group">
                                <label className="flex items-center justify-between p-3 bg-[#2a233a] rounded-md hover:bg-purple-900/50 cursor-pointer transition-colors">
                                <div className="flex items-center">
                                    <input 
                                        type="checkbox"
                                        checked={selectedOcrSlots.has(slot.id)}
                                        onChange={() => handleOcrSlotToggle(slot.id)}
                                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                                    <span className="ml-3 text-gray-300 text-sm">{formattedDate} - at - {formatTime(slot.time, user.timeFormat)} PST - for - {slot.duration} minutes</span>
                                </div>
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
                <button onClick={handleConfirmEvent} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300">
                    Confirm & Create Event
                </button>
            </div>
          )}
        </div>
      </div>
      
      {isModalOpen && preview && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
            onWheel={handleWheel}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview enlarged"
        >
          <div 
            className="relative w-full h-full flex items-center justify-center" 
            onClick={(e) => e.stopPropagation()}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="w-full h-full overflow-hidden">
                <img 
                    src={preview} 
                    alt="Event preview enlarged" 
                    className="absolute top-0 left-0 transition-transform duration-100"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        maxWidth: 'none',
                        maxHeight: 'none',
                    }}
                    onMouseDown={handleMouseDown}
                />
            </div>
            
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/50 rounded-full p-2 flex items-center gap-2 z-10">
                <button onClick={handleZoomOut} className="w-10 h-10 text-white text-2xl rounded-full bg-white/20 hover:bg-white/30">-</button>
                <button onClick={handleResetZoom} className="px-4 h-10 text-white text-sm rounded-full bg-white/20 hover:bg-white/30">Reset</button>
                <button onClick={handleZoomIn} className="w-10 h-10 text-white text-2xl rounded-full bg-white/20 hover:bg-white/30">+</button>
            </div>

            <button 
                onClick={closeModal}
                className="absolute top-4 right-4 bg-white text-gray-800 rounded-full h-8 w-8 flex items-center justify-center text-2xl font-bold leading-none hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white z-10"
                aria-label="Close image zoom"
            >
                &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUploadPage;
