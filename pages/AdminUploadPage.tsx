
import React, { useState, useCallback } from 'react';
import { extractEventDetailsFromImage } from '../services/geminiService';
import { Event, EventSlot, OcrResult } from '../types';
import { useAppContext } from '../App';

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


const AdminUploadPage: React.FC = () => {
  const { setEvents } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState('');
  const [duration, setDuration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [processedEvent, setProcessedEvent] = useState<Event | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setPreview(previewUrl);
      resetResultState();
    }
  };

  const removeImage = () => {
    setFile(null);
    setPreview(null);
    resetResultState();
  };
  
  const resetResultState = () => {
    setOcrResult(null);
    setProcessedEvent(null);
    setError(null);
  }

  const handleProcess = async () => {
    if (!file || !timeSlots || !duration) {
      setError('Please fill all fields and upload a screenshot.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const base64Image = await fileToBase64(file);
      const result = await extractEventDetailsFromImage(base64Image);
      setOcrResult(result);
      
      const parsedSlots: EventSlot[] = timeSlots.split(',')
        .map(t => t.trim())
        .filter(t => t.match(/^\d{2}:\d{2}$/))
        .map((time, index) => ({
            id: `${result.eventName.replace(/\s+/g, '-')}-${index}`,
            time: time,
            duration: parseInt(duration, 10),
            estimatedPayout: result.estimatedPayout,
        }));
        
      if(parsedSlots.length === 0) {
        throw new Error("Invalid time slot format. Use comma-separated HH:MM format.");
      }

      setProcessedEvent({ name: result.eventName, slots: parsedSlots });
    } catch (err: any) {
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEvent = () => {
    if (processedEvent) {
      setEvents(prevEvents => {
        // Simple duplicate check by name
        const eventExists = prevEvents.some(e => e.name === processedEvent.name);
        if(eventExists) {
            alert(`Event "${processedEvent.name}" already exists. For this demo, it won't be added again.`);
            return prevEvents;
        }
        return [...prevEvents, processedEvent];
      });
      alert(`Event "${processedEvent.name}" has been added!`);
      // Reset form
      setFile(null);
      setPreview(null);
      setTimeSlots('');
      setDuration('');
      resetResultState();
    }
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
                <img src={preview} alt="Event preview" className="w-auto max-h-60 mx-auto rounded-md" />
                <button onClick={removeImage} className="absolute top-2 right-2 bg-red-600/80 text-white rounded-full p-1 text-xs hover:bg-red-700">
                  Remove
                </button>
              </div>
            )}
          </div>
          
          {!ocrResult && (
            <>
              <div>
                <label htmlFor="time-slots" className="block text-sm font-medium text-gray-400 mb-2">Time Slots (comma-separated, 24hr PST)</label>
                <input type="text" id="time-slots" value={timeSlots} onChange={(e) => setTimeSlots(e.target.value)} placeholder="e.g., 10:00, 11:00, 13:00" className="w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-400 mb-2">Duration (minutes)</label>
                <input type="number" id="duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g., 60" className="w-full bg-[#2a233a] border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500" />
              </div>

              <button onClick={handleProcess} disabled={isLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {isLoading ? 'Processing...' : 'Upload & Process'}
              </button>
            </>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          
          {processedEvent && (
            <div className="border-t border-gray-700 pt-6 space-y-4">
                 <p className="text-center text-gray-300">
                    Event detected: <span className="font-bold text-purple-400">{processedEvent.name}</span> with est. payout of <span className="font-bold text-green-400">{processedEvent.slots[0].estimatedPayout.toLocaleString()} beans</span>.
                </p>
                <h3 className="text-lg font-medium text-white text-center">Select Available Time Slots</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {processedEvent.slots.map(slot => (
                        <div key={slot.id} className="flex items-center justify-between p-3 bg-[#2a233a] rounded-md">
                           <div className="flex items-center">
                              <input type="checkbox" defaultChecked className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                              <span className="ml-3 text-gray-300">{slot.time} PST</span>
                           </div>
                           <span className="text-gray-400">{slot.duration} minutes</span>
                        </div>
                    ))}
                </div>
                <button onClick={handleConfirmEvent} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300">
                    Confirm & Create Event
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUploadPage;
