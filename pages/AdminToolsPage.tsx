import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractRegionalTiersFromImage } from '../services/geminiService';
import { useAppContext } from '../App';
import { defaultRegionalTiers } from '../data/defaultTiers';
import Calendar from '../components/Calendar'; // Import the new Calendar component
import { formatSelectedDatesForDisplay } from '../utils/date'; // Import the new utility

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

const AdminToolsPage: React.FC = () => {
  const { regionalTiers, setRegionalTiers, user, setUser } = useAppContext();
  const navigate = useNavigate();

  const [tierChartFile, setTierChartFile] = useState<File | null>(null);
  const [tierChartPreview, setTierChartPreview] = useState<string | null>(null);
  const [isProcessingTierChart, setIsProcessingTierChart] = useState(false);
  const [tierChartError, setTierChartError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageForModal, setImageForModal] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });

  // Handler for when calendar dates change (Calendar is now a controlled component)
  const handleCalendarDatesChange = useCallback((newSelectedDates: Set<string>) => {
    setUser(prevUser => ({
      ...prevUser,
      preferredDates: newSelectedDates,
    }));
  }, [setUser]);

  const handleDeleteSelectedDateGroup = useCallback((datesToDelete: string[]) => {
    setUser(prevUser => {
      const newPreferredDates = new Set(prevUser.preferredDates || []); // Use existing or new Set
      datesToDelete.forEach(dateIso => newPreferredDates.delete(dateIso));
      return { ...prevUser, preferredDates: newPreferredDates };
    });
  }, [setUser]);

  const handleTierChartFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTierChartFile(file);
      if (tierChartPreview) {
        URL.revokeObjectURL(tierChartPreview);
      }
      setTierChartPreview(URL.createObjectURL(file));
      setTierChartError(null);
    }
  };

  const handleProcessTierChart = async () => {
    if (!tierChartFile) return;

    setIsProcessingTierChart(true);
    setTierChartError(null);
    
    try {
      const base64Image = await fileToBase64(tierChartFile);
      const result = await extractRegionalTiersFromImage(base64Image);
      if (result.length === 0) {
        throw new Error("No tier data could be extracted from the image.");
      }
      setRegionalTiers(result);
    } catch (err: any) {
      setTierChartError(err.message || "Failed to process tier chart.");
    } finally {
      setIsProcessingTierChart(false);
    }
  };

  const handleExportToCsv = () => {
    if (!regionalTiers || regionalTiers.length === 0) {
      alert("No tier data to export.");
      return;
    }

    const headers = ["Rank", "Bean Goal", "Hours Required", "Tier Payout", "Agency Support", "Wallet Profit"];
    const csvContent = [
      headers.join(','),
      ...regionalTiers.map(tier => 
        [
          `"${tier.rank}"`,
          tier.goal,
          tier.hoursRequired,
          tier.payout,
          tier.agencySupport,
          tier.walletProfit
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "regional_tier_chart.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  const handleResetTiers = () => {
    setRegionalTiers(defaultRegionalTiers);
    if (tierChartPreview) {
      URL.revokeObjectURL(tierChartPreview);
    }
    setTierChartFile(null);
    setTierChartPreview(null);
    setTierChartError(null);
  };
  
  const handleSetMonthlyGoal = (goal: number) => {
    if (window.confirm(`Would you like to set ${goal.toLocaleString()} as your Monthly Bean Goal?`)) {
        setUser(prevUser => {
            const updatedUser = {
                ...prevUser,
                monthlyBeanGoal: goal,
            };
            // The auto-save useEffect in App.tsx will handle persistence
            return updatedUser;
        });
        navigate('/settings');
    }
  };

  const handleSaveAllChanges = () => {
    // The auto-save useEffect in App.tsx already saves user changes.
    // This button primarily provides visual feedback.
    setSaveMessage("Settings saved!");
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000); // Message disappears after 3 seconds
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

  const formattedSelectedDates = formatSelectedDatesForDisplay(user.preferredDates || new Set());
  
  const uniqueDaysCount = useMemo(() => {
    return user.preferredDates?.size || 0;
  }, [user.preferredDates]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-8">Admin Tools</h1>
        
        {/* Calendar Component */}
        <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Select Preferred Dates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start"> {/* New Grid Layout, items-start for top alignment */}
            <div>
              <Calendar selectedDates={user.preferredDates || new Set()} onDatesChange={handleCalendarDatesChange} />
            </div>
            <div className="flex flex-col h-full min-h-[350px]"> {/* Adjusted to h-full for better vertical alignment, set a min-height */}
              <label htmlFor="selected-dates-display" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Selected Dates:</label>
              <div className="mb-2">
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2.5 py-1 rounded-full">
                  Total Unique Days: {uniqueDaysCount}
                </span>
              </div>
              <div 
                id="selected-dates-display" 
                className="flex-grow w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white overflow-y-auto"
                aria-label="Selected dates from calendar"
              >
                {formattedSelectedDates.length > 0 ? (
                  formattedSelectedDates.map(group => (
                    <div key={group.id} className="flex items-center justify-between text-sm py-1">
                      <span>{group.displayString}</span>
                      <button 
                        onClick={() => handleDeleteSelectedDateGroup(group.datesInGroup)}
                        className="ml-2 p-1 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                        aria-label={`Delete ${group.displayString}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 dark:text-gray-500">No dates selected.</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-8 w-full max-w-lg mx-auto">
            <button
              onClick={handleSaveAllChanges}
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

        <div className="bg-white dark:bg-[#1a1625] p-8 mt-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Regional Tier Chart</h2>
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Upload New Tier Chart (Optional)</label>
                {!tierChartPreview ? (
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                      <UploadIcon/>
                      <div className="flex text-sm text-gray-600 dark:text-gray-400">
                          <label htmlFor="tier-chart-upload" className="relative cursor-pointer bg-gray-100 dark:bg-[#2a233a] rounded-md font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 dark:focus-within:ring-offset-gray-900 focus-within:ring-purple-500 px-1">
                          <span>Upload a file</span>
                          <input id="tier-chart-upload" name="tier-chart-upload" type="file" className="sr-only" onChange={handleTierChartFileChange} accept="image/png, image/jpeg" />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG</p>
                      </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                      <div className="relative">
                          <img src={tierChartPreview} alt="Tier chart preview" className="w-auto max-h-60 mx-auto rounded-md cursor-pointer hover:opacity-80 transition-opacity" onClick={() => tierChartPreview && openModal(tierChartPreview)}/>
                      </div>
                      <button onClick={handleProcessTierChart} disabled={isProcessingTierChart} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                          {isProcessingTierChart && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                          {isProcessingTierChart ? 'Processing...' : 'Process & Use New Chart'}
                      </button>
                  </div>
                )}
            </div>
            {tierChartError && <p className="text-red-500 dark:text-red-400 text-sm text-center">{tierChartError}</p>}
            
            {regionalTiers && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center">Current Regional Tiers</h3>
                    <div className="flex gap-2">
                        <button onClick={handleExportToCsv} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500">
                          Export to CSV
                        </button>
                        <button onClick={handleResetTiers} className="px-3 py-1.5 text-xs font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                          Reset to Default
                        </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bean Goal</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Hours Req.</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tier Payout</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Agency Support</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Wallet Profit</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-[#1a1625] divide-y divide-gray-200 dark:divide-gray-700">
                          {regionalTiers.map((tier) => (
                          <tr key={tier.rank}>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{tier.rank}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                <button onClick={() => handleSetMonthlyGoal(tier.goal)} className="text-purple-600 dark:text-purple-400 hover:underline focus:outline-none font-medium">
                                  {tier.goal.toLocaleString()}
                                </button>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{tier.hoursRequired}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">${tier.payout.toLocaleString()}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${tier.agencySupport.toLocaleString()}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-semibold">${tier.walletProfit.toLocaleString()}</td>
                          </tr>
                          ))}
                      </tbody>
                      </table>
                  </div>
                </div>
            )}
        </div>

        {isModalOpen && imageForModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={closeModal} onWheel={handleWheel} role="dialog" aria-modal="true" aria-label="Image preview enlarged">
            <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
              <div className="w-full h-full overflow-hidden">
                  <img src={imageForModal} alt="Tier chart preview enlarged" className="absolute top-0 left-0 transition-transform duration-100" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, cursor: isDragging ? 'grabbing' : 'grab', maxWidth: 'none', maxHeight: 'none' }} onMouseDown={handleMouseDown} />
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
    </div>
  );
};

export default AdminToolsPage;