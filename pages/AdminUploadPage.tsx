import React, { useState, useMemo } from 'react';
import { extractEventDetailsFromImage } from '../services/geminiService';
import { Event, UploadHistoryItem, OcrResult, EventSlot } from '../types';
import { useAppContext } from '../App';
import { formatTime } from '../utils/time';
import { parseEventDates } from '../utils/date';

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

const ZoomIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6" />
    </svg>
);

interface DateTimeSlot {
  id: string; 
  date: Date;
  time: string;
  duration: number;
}

interface UploadItem {
  id: string;
  file: File | null;
  preview: string;
  isLoading: boolean;
  error: string | null;
  ocrResult: OcrResult | null;
  processedEvent: Omit<Event, 'slots'> & { slots: Omit<EventSlot, 'id'|'estimatedPayout'>[] } | null;
  selectedOcrSlots: Set<string>;
  dateTimeSlots: DateTimeSlot[];
  base64Image?: string;
  excludedDates?: Date[];
}

const AdminUploadPage: React.FC = () => {
  const { setEvents, user, uploadHistory, setUploadHistory } = useAppContext();
  
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageForModal, setImageForModal] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  
  const handleDeleteHistoryItem = (id: string) => {
    setUploadHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        // FIX: Add explicit type `File` to the `file` parameter to resolve type inference issues.
        const newItems: UploadItem[] = Array.from(e.target.files).map((file: File) => {
            const previewUrl = URL.createObjectURL(file);
            return {
                id: `${file.name}-${file.lastModified}`,
                file,
                preview: previewUrl,
                isLoading: false,
                error: null,
                ocrResult: null,
                processedEvent: null,
                selectedOcrSlots: new Set(),
                dateTimeSlots: [],
            };
        });
        setUploadItems(prev => [...prev, ...newItems]);
    }
  };

  const handleRemoveItem = (id: string) => {
    const itemToRemove = uploadItems.find(item => item.id === id);
    if(itemToRemove && itemToRemove.preview.startsWith('blob:')) {
        URL.revokeObjectURL(itemToRemove.preview);
    }
    setUploadItems(prev => prev.filter(item => item.id !== id));
  };
  
  const handleClearBatch = () => {
    uploadItems.forEach(item => {
        if (item.preview.startsWith('blob:')) {
            URL.revokeObjectURL(item.preview);
        }
    });
    setUploadItems([]);
  };

  const handleHistoryClick = (item: UploadHistoryItem) => {
    if (item.ocrResult) {
        const { validDates, excludedPastDates } = parseEventDates(item.ocrResult.eventDates);

        const generatedSlots: DateTimeSlot[] = [];
        validDates.forEach(date => {
            item.ocrResult!.slots.forEach(slot => {
            generatedSlots.push({
                id: `${date.toISOString().split('T')[0]}T${slot.time}`,
                date,
                time: slot.time,
                duration: slot.duration,
            });
            });
        });
        
        const newUploadItem: UploadItem = {
            id: item.id,
            file: null, // No file object from history
            preview: item.preview,
            isLoading: false,
            error: null,
            ocrResult: item.ocrResult,
            processedEvent: {
                name: item.ocrResult.eventName,
                eventDates: item.ocrResult.eventDates,
                slots: item.ocrResult.slots,
                rewardTiers: item.ocrResult.rewardTiers,
            },
            selectedOcrSlots: new Set(generatedSlots.map(s => s.id)),
            dateTimeSlots: generatedSlots,
            base64Image: item.preview.startsWith('data:') ? item.preview.split(',')[1] : undefined,
            excludedDates: excludedPastDates,
        };
        setUploadItems([newUploadItem]); // Replace current batch with this history item
    }
  }
  
  const handleOcrSlotToggle = (itemId: string, slotId: string) => {
    setUploadItems(prevItems => prevItems.map(item => {
        if (item.id === itemId) {
            const newSet = new Set(item.selectedOcrSlots);
            if (newSet.has(slotId)) newSet.delete(slotId);
            else newSet.add(slotId);
            return { ...item, selectedOcrSlots: newSet };
        }
        return item;
    }));
  };

  const handleProcessBatch = async () => {
    setIsProcessingBatch(true);
    // Mark all unprocessed items as loading
    setUploadItems(prev => prev.map(item => 
        (!item.ocrResult && !item.error && item.file) ? { ...item, isLoading: true } : item
    ));

    // Filter to get only the items that need processing
    const itemsToProcess = uploadItems.filter(item => item.file && !item.ocrResult && !item.error);

    // Process items sequentially to avoid rate limiting
    for (const item of itemsToProcess) {
        try {
            const base64Image = await fileToBase64(item.file);
            const result = await extractEventDetailsFromImage(base64Image);
            
            if (result.slots.length === 0) {
                throw new Error("No valid time slots were detected in the image.");
            }
            
            const { validDates, excludedPastDates } = parseEventDates(result.eventDates);

            if (validDates.length === 0 && excludedPastDates.length > 0) {
                const formattedExcluded = excludedPastDates.map(d => d.toLocaleDateString('en-US', { timeZone: 'UTC' })).join(', ');
                throw new Error(`All detected dates (${formattedExcluded}) are in the past and were excluded.`);
            }

            const generatedSlots: DateTimeSlot[] = [];
            validDates.forEach(date => {
                result.slots.forEach(slot => {
                generatedSlots.push({
                    id: `${date.toISOString().split('T')[0]}T${slot.time}`,
                    date,
                    time: slot.time,
                    duration: slot.duration,
                });
                });
            });

            // Update state for the successfully processed item
            setUploadItems(prev => prev.map(i => i.id === item.id ? {
                ...i,
                isLoading: false,
                ocrResult: result,
                processedEvent: {
                    name: result.eventName,
                    eventDates: result.eventDates,
                    rewardTiers: result.rewardTiers,
                    slots: result.slots,
                },
                dateTimeSlots: generatedSlots,
                selectedOcrSlots: new Set(generatedSlots.map(s => s.id)),
                base64Image,
                excludedDates: excludedPastDates,
            } : i));

        } catch (err: any) {
            // Update state for the failed item
            setUploadItems(prev => prev.map(i => i.id === item.id ? {
                ...i,
                isLoading: false,
                error: err.message || 'Failed to process image.',
            } : i));
        }
    }

    setIsProcessingBatch(false);
  };

  const handleConfirmAllEvents = () => {
    const allEventsToAdd: Event[] = [];
    const allHistoryItemsToAdd: UploadHistoryItem[] = [];

    uploadItems.forEach(item => {
        if (!item.processedEvent || item.dateTimeSlots.length === 0) return;
        
        const { processedEvent, dateTimeSlots, selectedOcrSlots, base64Image, ocrResult } = item;
        const selectedSlotsById: { [id: string]: DateTimeSlot } = {};
        dateTimeSlots.forEach(s => { selectedSlotsById[s.id] = s; });

        // FIX: Add explicit type `string` to the `id` parameter to resolve type inference issues.
        const selectedDateSlots = Array.from(selectedOcrSlots)
            .map((id: string) => selectedSlotsById[id])
            .filter((slot): slot is DateTimeSlot => Boolean(slot));
        
        if(selectedDateSlots.length === 0) return;

        if (base64Image && ocrResult) {
            const now = new Date();
            allHistoryItemsToAdd.push({
                id: now.toISOString() + Math.random(),
                preview: `data:image/jpeg;base64,${base64Image}`,
                date: now,
                ocrResult,
            });
        }

        const groupedByDate = selectedDateSlots.reduce((acc, slot) => {
            const dateKey = slot.date.toISOString().split('T')[0];
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(slot);
            return acc;
        }, {} as Record<string, DateTimeSlot[]>);
        
        for (const dateKey in groupedByDate) {
            const slotsForDate = groupedByDate[dateKey];
            const formattedDate = new Date(dateKey+'T00:00:00').toLocaleDateString('en-US', { timeZone:'UTC', month: '2-digit', day: '2-digit', year: 'numeric' });
            
            allEventsToAdd.push({
                name: `${processedEvent.name} (${formattedDate})`,
                eventDates: formattedDate,
                rewardTiers: processedEvent.rewardTiers,
                slots: slotsForDate.map((s, index) => ({
                    id: `${processedEvent.name.replace(/\s+/g, '-')}-${dateKey}-${index}`,
                    time: s.time,
                    duration: s.duration,
                })).sort((a, b) => a.time.localeCompare(b.time)),
            });
        }
    });

    if (allEventsToAdd.length === 0) {
        alert("No valid slots were selected to create events.");
        return;
    }

    setEvents(prevEvents => {
        const newEvents = [...prevEvents];
        let addedCount = 0, existingCount = 0;
        allEventsToAdd.forEach(eventToAdd => {
            if (!prevEvents.some(e => e.name === eventToAdd.name)) {
                newEvents.push(eventToAdd);
                addedCount++;
            } else {
                existingCount++;
            }
        });

        let alertMessage = '';
        if (addedCount > 0) alertMessage += `${addedCount} new event(s) have been created!`;
        if (existingCount > 0) alertMessage += `\n${existingCount} event(s) already existed and were not added again.`;
        alert(alertMessage.trim());

        return newEvents.sort((a,b) => a.name.localeCompare(b.name));
    });
    
    setUploadHistory(prev => [...allHistoryItemsToAdd, ...prev].slice(0, 10));
    handleClearBatch();
  };

  // --- Modal and Zoom handlers ---
  const openModal = (imageUrl: string) => { setImageForModal(imageUrl); setIsModalOpen(true); };
  const closeModal = () => { setIsModalOpen(false); setImageForModal(null); handleResetZoom(); };
  const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); setIsDragging(true); setStartDrag({ x: e.clientX - position.x, y: e.clientY - position.y }); };
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging) return; e.preventDefault(); setPosition({ x: e.clientX - startDrag.x, y: e.clientY - startDrag.y }); };
  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); const z = 1.1; if (e.deltaY < 0) setScale(p => Math.min(p * z, 5)); else setScale(p => Math.max(p / z, 0.5)); };
  const handleZoomIn = () => setScale(p => Math.min(p * 1.2, 5));
  const handleZoomOut = () => setScale(p => Math.max(p / 1.2, 0.5));
  const handleResetZoom = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const unprocessedItems = useMemo(() => uploadItems.filter(item => !item.ocrResult && !item.error), [uploadItems]);
  const processedItems = useMemo(() => uploadItems.filter(item => item.ocrResult || item.error), [uploadItems]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-8">Event Uploads</h1>
        
        {/* Event Upload Section */}
        <div className="bg-white dark:bg-[#1a1625] p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Event Schedule Upload</h2>
          {uploadItems.length === 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Event Screenshots</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <UploadIcon/>
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-100 dark:bg-[#2a233a] rounded-md font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 dark:focus-within:ring-offset-gray-900 focus-within:ring-purple-500 px-1">
                      <span>Upload file(s)</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" multiple />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Upload multiple PNG, JPG files</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
                <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mb-3">Pending Uploads</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-6 p-4 bg-gray-100 dark:bg-[#2a233a]/50 rounded-lg">
                    {unprocessedItems.map(item => (
                        <div key={item.id} className="relative group">
                            <img src={item.preview} alt="preview" className="rounded-md aspect-square object-cover w-full h-full"/>
                            <button onClick={() => handleRemoveItem(item.id)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 text-xs h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-opacity">
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <button onClick={handleProcessBatch} disabled={isProcessingBatch || unprocessedItems.length === 0} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                        {isProcessingBatch && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {isProcessingBatch ? 'Processing...' : `Process Batch (${unprocessedItems.length})`}
                    </button>
                    <label htmlFor="file-upload" className="cursor-pointer text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 py-3 px-4">
                        Add More Files...
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" multiple />
                    </label>
                     <button onClick={handleClearBatch} className="text-sm font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 py-3 px-4">Clear All</button>
                </div>
            </div>
          )}

          {processedItems.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6 space-y-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-4">Processing Results</h2>
                {processedItems.map((item, itemIndex) => (
                    <div key={item.id} className="bg-gray-100 dark:bg-[#2a233a] p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="w-full md:w-1/4">
                                <img src={item.preview} alt="processed preview" className="rounded-md w-full cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openModal(item.preview)} />
                                {item.isLoading && <p className="text-center text-purple-600 dark:text-purple-400 text-sm mt-2">Processing...</p>}
                            </div>
                            <div className="w-full md:w-3/4">
                                {item.error && <p className="text-red-500 dark:text-red-400 text-sm">{item.error}</p>}
                                {item.excludedDates && item.excludedDates.length > 0 && (
                                    <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 text-xs rounded-r-md">
                                        <p>
                                            <span className="font-bold">Note:</span> The following dates were in the past and have been excluded: {item.excludedDates.map(d => d.toLocaleDateString('en-US', { timeZone: 'UTC' })).join(', ')}
                                        </p>
                                    </div>
                                )}
                                {item.ocrResult && item.processedEvent && (
                                    <div>
                                        <p className="font-bold text-purple-600 dark:text-purple-400">{item.processedEvent.name}</p>
                                        <h3 className="text-md font-medium text-gray-900 dark:text-white mt-3 mb-2">Select Available Time Slots</h3>
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 text-sm">
                                            {item.dateTimeSlots.map((slot, index) => (
                                                <label key={slot.id} className="flex items-center p-2 bg-white dark:bg-[#1a1625] rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/50 cursor-pointer">
                                                    <input type="checkbox" checked={item.selectedOcrSlots.has(slot.id)} onChange={() => handleOcrSlotToggle(item.id, slot.id)} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                                                    <span className="ml-3 text-gray-700 dark:text-gray-300 flex items-baseline">
                                                        <span className="font-semibold text-gray-500 dark:text-gray-400 mr-2 w-6 text-right">{index + 1}.</span>
                                                        <span>{`${slot.date.getUTCMonth() + 1}/${slot.date.getUTCDate()}`} - {formatTime(slot.time, user.timeFormat)} PST - {slot.duration}m</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <button onClick={handleConfirmAllEvents} disabled={isProcessingBatch} className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-green-700 hover:to-teal-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                    Confirm & Create All Valid Events
                </button>
            </div>
          )}
        </div>

        {uploadHistory.length > 0 && (
             <div className="mt-8">
                <div className="flex justify-center items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">Upload History</h2>
                  <button
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="ml-4 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-expanded={isHistoryExpanded}
                    aria-controls="upload-history-grid"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-6 w-6 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div
                  id="upload-history-grid" 
                  className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 overflow-hidden transition-all ease-in-out duration-500 ${isHistoryExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    {uploadHistory.map(item => (
                        <div key={item.id} className="relative group cursor-pointer" onClick={() => handleHistoryClick(item)}>
                            <img src={item.preview} alt={`Upload from ${item.date.toLocaleString()}`} className="rounded-md aspect-square object-cover w-full h-full"/>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-center p-2">
                                <p className="text-xs text-white">
                                    Imported:<br/>
                                    {item.date.toLocaleDateString(undefined, { dateStyle: 'short' })}
                                    <br/>
                                    {item.date.toLocaleTimeString(undefined, { timeStyle: 'short' })}
                                </p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); openModal(item.preview); }} className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 focus:outline-none" aria-label="Zoom image">
                                <ZoomIcon />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteHistoryItem(item.id);
                                }}
                                className="absolute top-2 left-2 bg-red-600 text-white rounded-full p-1 h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-opacity z-10"
                                aria-label="Delete history item"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
      
      {isModalOpen && imageForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={closeModal} onWheel={handleWheel} role="dialog" aria-modal="true" aria-label="Image preview enlarged">
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="w-full h-full overflow-hidden">
                <img src={imageForModal} alt="Event preview enlarged" className="absolute top-0 left-0 transition-transform duration-100" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, cursor: isDragging ? 'grabbing' : 'grab', maxWidth: 'none', maxHeight: 'none' }} onMouseDown={handleMouseDown} />
            </div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/50 rounded-full p-2 flex items-center gap-2 z-10">
                <button onClick={handleZoomOut} className="w-10 h-10 text-white text-2xl rounded-full bg-white/20 hover:bg-white/30">-</button>
                <button onClick={handleResetZoom} className="px-4 h-10 text-white text-sm rounded-full bg-white/20 hover:bg-white/30">Reset</button>
                <button onClick={handleZoomIn} className="w-10 h-10 text-white text-2xl rounded-full bg-white/20 hover:bg-white/30">+</button>
            </div>
            <button onClick={closeModal} className="absolute top-4 right-4 bg-white text-gray-800 rounded-full h-8 w-8 flex items-center justify-center text-2xl font-bold leading-none hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white z-10" aria-label="Close image zoom">
                &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUploadPage;