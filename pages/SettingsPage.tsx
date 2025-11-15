
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../App';
import { UserProfile, Event, EventSlot, SlotPreference, RecommendationHistoryItem } from '../types';
import { formatTime } from '../utils/time';
import { formatSelectedDatesForDisplay } from '../utils/date';
import { generateGoalPathways } from '../services/geminiService';


const SettingsPage: React.FC = () => {
  const { user, setUser, events, regionalTiers } = useAppContext();
  const [maxPathwaysError, setMaxPathwaysError] = useState('');
  const [isBigoIdLocked, setIsBigoIdLocked] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<{ key: 'name' | 'time' | 'duration', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [availableSort, setAvailableSort] = useState<{ key: 'name' | 'time' | 'duration' | 'preferred' | 'beans', direction: 'asc' | 'desc' }>({ key: 'time', direction: 'asc' });
  const [isDatesModalOpen, setIsDatesModalOpen] = useState(false);

  // New state for recommendation feature
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendationReport, setRecommendationReport] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReportModalMinimized, setIsReportModalMinimized] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [timeZoneSearch, setTimeZoneSearch] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);


  useEffect(() => {
    // This effect runs when isReportModalOpen changes.
    // If the modal is closing AND speech is active, cancel it.
    if (!isReportModalOpen && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }
  }, [isReportModalOpen]);

  useEffect(() => {
      // Cleanup function to stop speech synthesis when component unmounts
      return () => {
          if (window.speechSynthesis && window.speechSynthesis.speaking) {
              window.speechSynthesis.cancel();
          }
      };
  }, []);

  useEffect(() => {
    if (regionalTiers && regionalTiers.length > 0) {
      const availableGoals = regionalTiers.map(t => t.goal);
      if (!availableGoals.includes(user.monthlyBeanGoal)) {
        setUser(prev => ({
          ...prev,
          monthlyBeanGoal: availableGoals[0],
        }));
      }
    }
  }, [regionalTiers, user.monthlyBeanGoal, setUser]);
  
  // Filter preferred dates if the month lock is on
  const filteredPreferredDates = useMemo(() => {
    if (!user.isMonthLocked || !user.preferredDates) {
        return user.preferredDates || new Set<string>();
    }
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    return new Set(
        Array.from(user.preferredDates).filter(isoDate => {
            const date = new Date(isoDate + 'T00:00:00Z'); // Treat as UTC
            return date.getUTCMonth() === currentMonth && date.getUTCFullYear() === currentYear;
        })
    );
  }, [user.preferredDates, user.isMonthLocked]);


  const timeZoneOptions = useMemo(() => {
    try {
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
        return [
            { value: 'UTC', label: '(UTC+00:00) Coordinated Universal Time' },
            { value: 'Europe/London', label: '(UTC+01:00) London, Dublin' },
            { value: 'America/New_York', label: '(UTC-04:00) Eastern Time (US & Canada)' },
            { value: 'America/Chicago', label: '(UTC-05:00) Central Time (US & Canada)' },
            { value: 'America/Los_Angeles', label: '(UTC-07:00) Pacific Time (US & Canada)' },
        ];
    }
  }, []);
  
  const filteredTimeZoneOptions = useMemo(() => {
    if (!timeZoneSearch) {
      return timeZoneOptions;
    }
    const lowercasedSearch = timeZoneSearch.toLowerCase();
    return timeZoneOptions.filter(tz =>
      tz.label.toLowerCase().includes(lowercasedSearch)
    );
  }, [timeZoneOptions, timeZoneSearch]);


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
    return Array.from(availableSlotsByEvent.values()).reduce((count: number, eventData: { slots: EventSlot[] }) => count + eventData.slots.length, 0);
  }, [availableSlotsByEvent]);

  const remainingDaysInMonth = useMemo(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
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
  
  const handleSortChange = (
    list: 'selected' | 'available',
    newKey: 'name' | 'time' | 'duration' | 'preferred' | 'beans'
  ) => {
    const setSort = list === 'selected' ? setSelectedSort : setAvailableSort as React.Dispatch<React.SetStateAction<{ key: 'name' | 'time' | 'duration' | 'preferred' | 'beans', direction: 'asc' | 'desc' }>>;
    setSort(prevSort => {
      if (prevSort.key === newKey) {
        return { ...prevSort, direction: prevSort.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: newKey, direction: newKey === 'beans' ? 'desc' : 'asc' };
    });
  };

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
        newValue = isNaN(num) ? 0 : num;
    } else if (type === 'number') {
        const num = parseInt(value, 10);
        if (name === 'maxPathways') {
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

  const handleSelectPreferred = () => {
    if (!filteredPreferredDates || filteredPreferredDates.size === 0) {
        const alertMessage = user.isMonthLocked 
            ? "You haven't selected any preferred dates in the current month. Please go to Date Preferences to select them, or turn off 'Lock to Current Month'."
            : "You haven't selected any preferred dates. Please go to Date Preferences to select them.";
        alert(alertMessage);
        return;
    }

    setUser(prevUser => {
        const newPreferredSlots = new Map<string, SlotPreference>(prevUser.preferredSlots);
        
        slotDetailsMap.forEach((details, identifier) => {
            const { event } = details;
            const dateMatch = event.name.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
            if (dateMatch?.[1]) {
                const [month, day, year] = dateMatch[1].split('/');
                const eventDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
                const eventIsoDate = eventDate.toISOString().split('T')[0];
                
                if (filteredPreferredDates.has(eventIsoDate)) {
                    const currentPref = newPreferredSlots.get(identifier);
                    const highestTierIndex = event.rewardTiers.length - 1;
                    newPreferredSlots.set(identifier, {
                        isSelected: true,
                        rewardTierIndex: currentPref?.rewardTierIndex ?? highestTierIndex,
                    });
                }
            }
        });

        return { ...prevUser, preferredSlots: newPreferredSlots };
    });
  };

  const handleSaveSettings = () => {
    setSaveMessage("Settings saved!");
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000);
  };
  
  const handleProcessRecommendations = async () => {
    setIsGenerating(true);
    setRecommendationError(null);
    setRecommendationReport(null);
    setIsReportModalMinimized(false);

    try {
        const totalBeansFromSelected = sortedSelectedSlots.reduce((sum, slot) => {
            const tier = slot.details?.event.rewardTiers[slot.pref.rewardTierIndex];
            return sum + (tier ? tier.beans : 0);
        }, 0);

        const totalHoursFromSelected = sortedSelectedSlots.reduce((sum, slot) => {
            return sum + ((slot.details?.slot.duration || 0) / 60);
        }, 0);

        const selectedMonthlyGoalTier = regionalTiers?.find(tier => tier.goal === user.monthlyBeanGoal);
        const hoursRequiredForGoal = selectedMonthlyGoalTier?.hoursRequired ?? 0;

        const dataForApi = {
            monthlyBeanGoal: user.monthlyBeanGoal,
            currentBeanCount: user.currentBeanCount,
            remainingDays: remainingDaysInMonth,
            maxPathways: user.maxPathways,
            preferredDates: Array.from(filteredPreferredDates) as string[],
            selectedSlots: sortedSelectedSlots.map(s => ({
                name: s.details?.event.name || 'Unknown Event',
                beans: s.details?.event.rewardTiers[s.pref.rewardTierIndex]?.beans || 0,
                duration: s.details?.slot.duration || 0,
            })),
            availableSlots: sortedAvailableSlots.map(s => ({
                name: s.event.name,
                time: s.slot.time,
                duration: s.slot.duration,
                beans: s.event.rewardTiers[s.event.rewardTiers.length - 1]?.beans || 0,
            })),
            totalBeansFromSelected,
            timeFormat: user.timeFormat,
            allowEventAutoselection: user.allowEventAutoselection || false,
            model: user.recommendationModel || 'gemini-2.5-pro',
            hoursRequired: hoursRequiredForGoal,
            currentHours: user.currentHours || 0,
            totalHoursFromSelected,
        };

        const report = await generateGoalPathways(dataForApi);
        setRecommendationReport(report);
        setIsReportModalOpen(true);
        
        const newHistoryItem: RecommendationHistoryItem = {
            id: new Date().toISOString(),
            date: new Date().toISOString(),
            report: report,
        };

        setUser(prevUser => ({
            ...prevUser,
            recommendationHistory: [newHistoryItem, ...(prevUser.recommendationHistory || [])].slice(0, 10)
        }));

    } catch (err: any) {
        setRecommendationError(err.message || "An unknown error occurred while generating recommendations.");
        setIsReportModalOpen(true); // Open modal to show the error
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteRecommendation = (idToDelete: string) => {
    if (window.confirm("Are you sure you want to delete this report from your history? This action cannot be undone.")) {
        setUser(prevUser => ({
            ...prevUser,
            recommendationHistory: prevUser.recommendationHistory?.filter(item => item.id !== idToDelete) || [],
        }));
    }
  };
  
    const handlePrintReport = () => {
        const modalContent = document.getElementById('report-modal-content');
        if (modalContent) {
            const printWindow = window.open('', '', 'height=600,width=800');
            if (printWindow) {
                printWindow.document.write('<html><head><title>Goal Pathways Report</title>');
                printWindow.document.write('<style>body { font-family: sans-serif; white-space: pre-wrap; } h1, h2, h3 { color: #333; } ul { list-style-type: disc; padding-left: 20px; } code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }</style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write(modalContent.innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    const handleCopyReport = () => {
        if (recommendationReport) {
            navigator.clipboard.writeText(recommendationReport)
                .then(() => {
                    alert("Report copied to clipboard!");
                })
                .catch(err => {
                    console.error("Failed to copy report: ", err);
                    alert("Failed to copy report.");
                });
        }
    };

    const handleReadAloud = () => {
        if (!('speechSynthesis' in window)) {
            alert("Sorry, your browser doesn't support text-to-speech.");
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }
    
        if (!recommendationReport) return;
    
        // Clean the report for better speech flow (remove markdown syntax)
        const cleanedReport = recommendationReport
            .replace(/#+\s/g, '')     // Remove markdown headers (e.g., ### Title)
            .replace(/\*\*/g, '')      // Remove bold markers (**)
            .replace(/\*/g, '')       // Remove italic markers (*)
            .replace(/^- /gm, '');    // Remove list item markers
    
        const utterance = new SpeechSynthesisUtterance(cleanedReport);
    
        utterance.onstart = () => {
            setIsSpeaking(true);
        };
    
        utterance.onend = () => {
            setIsSpeaking(false);
        };
    
        utterance.onerror = (event) => {
            // The 'interrupted' error is expected when we manually cancel the speech.
            // We should not treat it as an application error.
            if (event.error === 'interrupted') {
                console.log('Speech synthesis was intentionally interrupted.');
                setIsSpeaking(false); // Ensure state is reset
                return;
            }
            console.error('SpeechSynthesisUtterance.onerror', event);
            setIsSpeaking(false);
            setRecommendationError(`An error occurred during speech synthesis: ${event.error}`);
        };
    
        window.speechSynthesis.speak(utterance);
    };


  const goalProgress = useMemo(() => {
    const { monthlyBeanGoal, currentBeanCount } = user;
    
    if (!regionalTiers || regionalTiers.length === 0) {
      return { dailyBeansNeeded: 0, remainingGoal: 0, remainingDays: 0, statusMessage: 'Regional tiers not loaded.', hoursLeftToGoal: 0 };
    }

    if (monthlyBeanGoal <= 0) {
      return { dailyBeansNeeded: 0, remainingGoal: 0, remainingDays: 0, statusMessage: 'Set a monthly goal to see your progress.', hoursLeftToGoal: 0 };
    }

    const remainingGoal = Math.max(0, monthlyBeanGoal - currentBeanCount);
    
    const remainingDaysForCalc = Math.max(1, remainingDaysInMonth);
    const remainingDaysForDisplay = remainingDaysInMonth;

    const daysToStream = remainingDaysForCalc;

    const dailyBeansNeeded = Math.ceil(remainingGoal / daysToStream);

    const statusMessage = remainingGoal > 0
      ? `Goal Check: Need ${dailyBeansNeeded.toLocaleString()} beans per day!`
      : `Goal reached! You are ${(currentBeanCount - monthlyBeanGoal).toLocaleString()} beans over.`;
      
    const selectedMonthlyGoalTier = regionalTiers.find(tier => tier.goal === user.monthlyBeanGoal);
    
    const hoursRequiredForGoal = selectedMonthlyGoalTier?.hoursRequired ?? 0;
    const hoursLeftToGoal = Math.max(0, hoursRequiredForGoal - (user.currentHours ?? 0));

    return { dailyBeansNeeded, remainingGoal, remainingDays: remainingDaysForDisplay, statusMessage, hoursLeftToGoal };
  }, [user, remainingDaysInMonth, regionalTiers]);

  const sortedSelectedSlots = useMemo(() => {
    const slots = Array.from(user.preferredSlots.entries())
      .filter(([_, pref]) => pref.isSelected)
      .map(([identifier, pref]) => ({
        identifier,
        pref,
        details: slotDetailsMap.get(identifier),
      }));

    slots.sort((a, b) => {
      if (!a.details || !b.details) return 0;
      const { event: eventA, slot: slotA } = a.details;
      const { event: eventB, slot: slotB } = b.details;

      let compareResult = 0;
      switch (selectedSort.key) {
        case 'time':
          compareResult = slotA.time.localeCompare(slotB.time);
          if (compareResult === 0) compareResult = eventA.name.localeCompare(eventB.name);
          break;
        case 'duration':
          compareResult = slotA.duration - slotB.duration;
          if (compareResult === 0) compareResult = eventA.name.localeCompare(eventB.name);
          break;
        case 'name':
        default:
          compareResult = eventA.name.localeCompare(eventB.name);
          if (compareResult === 0) compareResult = slotA.time.localeCompare(slotB.time);
          break;
      }
      return selectedSort.direction === 'asc' ? compareResult : -compareResult;
    });

    return slots;
  }, [user.preferredSlots, selectedSort, slotDetailsMap]);

  const sortedAvailableSlots = useMemo(() => {
    const allSlots = Array.from(availableSlotsByEvent.values()).flatMap(({ event, slots }) =>
      slots.map(slot => ({ event, slot }))
    );

    const isPreferred = (event: Event) => {
        if (!filteredPreferredDates || filteredPreferredDates.size === 0) return false;
        const dateMatch = event.name.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
        if (!dateMatch?.[1]) return false;
        const [month, day, year] = dateMatch[1].split('/');
        const eventDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        const eventIsoDate = eventDate.toISOString().split('T')[0];
        return filteredPreferredDates.has(eventIsoDate);
    };

    allSlots.sort((a, b) => {
      const { event: eventA, slot: slotA } = a;
      const { event: eventB, slot: slotB } = b;

      let compareResult = 0;
      switch (availableSort.key) {
        case 'preferred':
          const preferredA = isPreferred(eventA);
          const preferredB = isPreferred(eventB);
          compareResult = (preferredB ? 1 : 0) - (preferredA ? 1 : 0);
          if (compareResult === 0) compareResult = slotA.time.localeCompare(slotB.time); // secondary sort by time
          break;
        case 'beans':
          const beansA = eventA.rewardTiers[eventA.rewardTiers.length - 1]?.beans || 0;
          const beansB = eventB.rewardTiers[eventB.rewardTiers.length - 1]?.beans || 0;
          compareResult = beansB - beansA;
          if (compareResult === 0) compareResult = eventA.name.localeCompare(eventB.name);
          break;
        case 'time':
          compareResult = slotA.time.localeCompare(slotB.time);
          if (compareResult === 0) compareResult = eventA.name.localeCompare(eventB.name);
          break;
        case 'duration':
          compareResult = slotA.duration - slotB.duration;
          if (compareResult === 0) compareResult = eventA.name.localeCompare(eventB.name);
          break;
        case 'name':
        default:
          compareResult = eventA.name.localeCompare(eventB.name);
          if (compareResult === 0) compareResult = slotA.time.localeCompare(slotB.time);
          break;
      }
      return availableSort.direction === 'asc' ? compareResult : -compareResult;
    });

    return allSlots;
  }, [availableSlotsByEvent, availableSort, filteredPreferredDates]);
  
  const formattedPreferredDates = useMemo(() => formatSelectedDatesForDisplay(filteredPreferredDates), [filteredPreferredDates]);
    
  const BigoUserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
  );

  const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
  );

  const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
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

  const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const SortIcon = ({ direction }: { direction: 'asc' | 'desc' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      {direction === 'asc' ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
    </svg>
  );

  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const SpeakerPlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );

  const SpeakerStopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l4-4m0 0l-4-4m4 4H7" />
    </svg>
  );

  const MinimizeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
    </svg>
  );

  const MaximizeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4" />
    </svg>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Schedule Preferences</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Card */}
          <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile</h2>
                <button 
                onClick={() => setIsDatesModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Show preferred dates reminder"
                >
                <CalendarIcon />
                <span>Preferred Dates Reminder</span>
                </button>
            </div>
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
              <div className="md:col-span-2 space-y-2">
                <label htmlFor="timeZoneSearch" className="block text-sm font-medium text-gray-600 dark:text-gray-400">Your Local Time Zone</label>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3"><SearchIcon /></span>
                    <input
                        id="timeZoneSearch"
                        type="text"
                        placeholder="Search time zones..."
                        value={timeZoneSearch}
                        onChange={(e) => setTimeZoneSearch(e.target.value)}
                        className="pl-10 w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                    />
                </div>
                <select
                    id="timeZone"
                    name="timeZone"
                    value={user.timeZone}
                    onChange={handleInputChange}
                    className="block w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                    size={5}
                >
                    {filteredTimeZoneOptions.length > 0 ? (
                        filteredTimeZoneOptions.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)
                    ) : (
                        <option disabled>No matching time zones found.</option>
                    )}
                </select>
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
            
            {user.isMonthLocked && (
              <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-700 rounded-md text-sm text-purple-800 dark:text-purple-200">
                <p>
                  <span className="font-semibold">Month Lock is ON.</span> Only preferred dates within the current month are being used for sorting and recommendations.
                </p>
              </div>
            )}

            {sortedSelectedSlots.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <h3 className="text-lg font-medium text-purple-600 dark:text-purple-400">Your Selections ({sortedSelectedSlots.length})</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>Sort by:</span>
                        {(['name', 'time', 'duration'] as const).map(key => (
                        <button key={key} onClick={() => handleSortChange('selected', key)} className={`px-2 py-1 rounded capitalize ${selectedSort.key === key ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                            {key}
                            {selectedSort.key === key && <SortIcon direction={selectedSort.direction} />}
                        </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {sortedSelectedSlots.map(({ identifier, pref, details }, index) => {
                        if (!details) return null;
                        const { event, slot } = details;
                        const selectedTier = pref.rewardTierIndex < event.rewardTiers.length ? event.rewardTiers[pref.rewardTierIndex] : null;
                        const beans = selectedTier ? selectedTier.beans : 0;
                        
                        const dateMatch = event.name.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
                        let isPreferred = false;
                        if (dateMatch?.[1] && filteredPreferredDates) {
                            const [month, day, year] = dateMatch[1].split('/');
                            const eventDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
                            const eventIsoDate = eventDate.toISOString().split('T')[0];
                            if (filteredPreferredDates.has(eventIsoDate)) {
                                isPreferred = true;
                            }
                        }

                        return (
                            <div key={identifier} className={`flex items-center justify-between p-2 bg-gray-100 dark:bg-[#2a233a] rounded-md ${isPreferred ? 'ring-2 ring-green-500' : ''}`}>
                                <div>
                                    <p className="text-sm flex items-baseline">
                                        <span className="font-semibold text-gray-500 dark:text-gray-400 mr-2 w-6 text-right">{index + 1}.</span>
                                        <span>
                                            <span className="font-semibold text-purple-600 dark:text-purple-300">{event.name}</span>
                                            <span className="text-gray-500 dark:text-gray-400"> - </span>
                                            <span className="text-gray-700 dark:text-gray-300">{formatTime(slot.time, user.timeFormat, event, user.timeZone)} for {slot.duration}m</span>
                                        </span>
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 pl-8">~{beans.toLocaleString()} beans</p>
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
                Select All
              </button>
              <button onClick={handleSelectPreferred} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500" disabled={!filteredPreferredDates || filteredPreferredDates.size === 0}>
                Add Preferred Dates
              </button>
              <button onClick={handleClearAll} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500" disabled={sortedSelectedSlots.length === 0}>
                Remove All
              </button>
            </div>

            <div className="flex justify-between items-center mt-6 mb-2">
                <h3 className="text-lg font-medium text-purple-600 dark:text-purple-400">All Available Slots ({sortedAvailableSlots.length})</h3>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>Sort by:</span>
                    {(['time', 'name', 'duration', 'preferred', 'beans'] as const).map(key => (
                    <button key={key} onClick={() => handleSortChange('available', key)} className={`px-2 py-1 rounded capitalize ${availableSort.key === key ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                        {key}
                        {availableSort.key === key && <SortIcon direction={availableSort.direction} />}
                    </button>
                    ))}
                </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2 pb-40">
              {sortedAvailableSlots.length > 0 ? (
                sortedAvailableSlots.map(({ event, slot }, index) => {
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

                    const dateMatch = event.name.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
                    let isPreferred = false;
                    if (dateMatch?.[1] && filteredPreferredDates) {
                        const [month, day, year] = dateMatch[1].split('/');
                        const eventDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
                        const eventIsoDate = eventDate.toISOString().split('T')[0];
                        if (filteredPreferredDates.has(eventIsoDate)) {
                            isPreferred = true;
                        }
                    }

                    return (
                        <div key={slotIdentifier} className="relative group">
                            <div className={`flex items-center justify-between p-3 bg-gray-100 dark:bg-[#2a233a] rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-colors ${isPreferred ? 'ring-2 ring-green-500' : ''}`}>
                                <div className="flex items-center">
                                    <input type="checkbox" checked={isSelected} onChange={() => handleSlotToggle(slotIdentifier)} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                                    <span className="ml-3 text-gray-700 dark:text-gray-300 text-sm flex items-baseline">
                                        <span className="font-semibold text-gray-500 dark:text-gray-400 mr-2 w-6 text-right">{index + 1}.</span>
                                        <span>
                                            <span className="font-semibold text-purple-600 dark:text-purple-400">{event.name}</span>
                                            <span className="text-gray-500 dark:text-gray-400 mx-1">-</span>
                                            {formatTime(slot.time, user.timeFormat, event, user.timeZone)} for {slot.duration}m
                                        </span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600 dark:text-green-400 font-medium text-sm">
                                    ~{currentBeans.toLocaleString()}
                                    {typeof currentLevel === 'number' && <span className="text-purple-500 dark:text-purple-300 text-xs ml-1">(Lv.{currentLevel})</span>}
                                    </span>
                                    <div className="flex flex-col">
                                    <button onClick={() => handleRewardLevelChange(slotIdentifier, 'up')} disabled={isUpDisabled} className="disabled:opacity-20 text-gray-800 dark:text-white h-4 w-4 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/20">▲</button>
                                    <button onClick={() => handleRewardLevelChange(slotIdentifier, 'down')} disabled={isDownDisabled} className="disabled:opacity-20 text-gray-800 dark:text-white h-4 w-4 flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/20">▼</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })
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
               <div>
                <label htmlFor="recommendationModel" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Recommendation AI Model</label>
                <select
                  id="recommendationModel"
                  name="recommendationModel"
                  value={user.recommendationModel || 'gemini-2.5-pro'}
                  onChange={handleInputChange}
                  className="w-full bg-gray-100 dark:bg-[#2a233a] border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (High Quality)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                </select>
              </div>
              <div>
                <label className="flex items-center mt-2">
                  <input type="checkbox" name="allowEventAutoselection" checked={user.allowEventAutoselection || false} onChange={handleInputChange} className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500" />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Allow Event Autoselection in Pathways</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">When checked, pathways will suggest specific events to add. When unchecked, pathways will provide more generalized advice.</p>
              </div>
            </div>
          </div>

          {/* Goal Progress Card */}
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-lg shadow-lg text-white">
             <h2 className="text-xl font-semibold mb-4">Goal Progress</h2>
             <div className="space-y-2">
                <p className="font-bold text-lg">{goalProgress.statusMessage}</p>
                {user.monthlyBeanGoal > 0 && (
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
       <div className="mt-8 w-full max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveSettings}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-indigo-500"
          >
            Save All Changes
          </button>
          <button
              onClick={handleProcessRecommendations}
              disabled={isGenerating}
              className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-green-600 hover:to-teal-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
          {isGenerating && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
          {isGenerating ? 'Analyzing...' : 'Process Recommendations'}
          </button>
        </div>

        <div className="bg-white dark:bg-[#1a1625] p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="w-full flex justify-between items-center text-left"
                aria-expanded={isHistoryExpanded}
            >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recommendation History</h2>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transform transition-transform text-gray-500 dark:text-gray-400 ${isHistoryExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isHistoryExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {user.recommendationHistory && user.recommendationHistory.length > 0 ? (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {user.recommendationHistory.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-[#2a233a] rounded-md">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate pr-4">
                                        Report from {new Date(item.date).toLocaleString()}
                                    </p>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => {
                                                setRecommendationReport(item.report);
                                                setIsReportModalOpen(true);
                                                setIsReportModalMinimized(false);
                                            }}
                                            className="px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRecommendation(item.id)}
                                            className="p-1.5 text-xs font-medium text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                                            aria-label="Delete recommendation"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No past recommendations found.</p>
                    )}
                </div>
            )}
        </div>
      </div>
      {saveMessage && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white py-3 px-6 rounded-lg shadow-xl animate-fade-in-out z-50">
          {saveMessage}
        </div>
      )}

      {isDatesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setIsDatesModalOpen(false)}>
          <div className="bg-white dark:bg-[#1a1625] rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Preferred Dates Reminder</h3>
            {user.isMonthLocked && (
              <div className="mb-4 p-2 bg-purple-100 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-700 rounded-md text-xs text-purple-800 dark:text-purple-200">
                <p>
                  <span className="font-semibold">Month Lock is ON.</span> Only dates in the current month are shown.
                </p>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto bg-gray-100 dark:bg-[#2a233a] p-4 rounded-md">
              {formattedPreferredDates.length > 0 ? (
                formattedPreferredDates.map(group => (
                  <div key={group.id} className="text-sm py-1 text-gray-800 dark:text-gray-200">
                    {group.displayString}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">You haven't selected any preferred dates.</p>
              )}
            </div>
            <div className="mt-6 text-right">
              <button
                onClick={() => setIsDatesModalOpen(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

        {isReportModalOpen && (
            <div 
              className={`fixed ${isReportModalMinimized ? 'bottom-4 right-4 w-96' : 'inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4'} z-50 transition-all duration-300`}
              onClick={!isReportModalMinimized ? () => setIsReportModalOpen(false) : undefined}
            >
                <div className={`bg-white dark:bg-[#1a1625] rounded-lg shadow-xl flex flex-col ${isReportModalMinimized ? '' : 'w-full max-w-3xl'}`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Goal Achievement Pathways</h3>
                        <div className="flex items-center gap-2">
                           <button
                                onClick={() => setIsReportModalMinimized(!isReportModalMinimized)}
                                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                                aria-label={isReportModalMinimized ? "Maximize report" : "Minimize report"}
                            >
                                {isReportModalMinimized ? <MaximizeIcon /> : <MinimizeIcon />}
                            </button>
                            <button
                                onClick={() => setIsReportModalOpen(false)}
                                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none text-2xl leading-none"
                                aria-label="Close report"
                            >
                                &times;
                            </button>
                        </div>
                    </div>
                    {!isReportModalMinimized && (
                        <>
                            <div id="report-modal-content" className="flex-grow max-h-[70vh] overflow-y-auto p-6 text-gray-800 dark:text-gray-200">
                                {recommendationError ? (
                                    <div className="text-red-500 dark:text-red-400">
                                        <h4 className="font-bold">Error</h4>
                                        <p>{recommendationError}</p>
                                    </div>
                                ) : recommendationReport ? (
                                    <pre className="whitespace-pre-wrap font-sans">{recommendationReport}</pre>
                                ) : (
                                    <p>No report generated.</p>
                                )}
                            </div>
                            <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end items-center flex-wrap gap-3">
                                <button
                                    onClick={handleReadAloud}
                                    disabled={!recommendationReport}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 flex items-center gap-2"
                                    aria-label={isSpeaking ? "Stop reading report" : "Read report aloud"}
                                >
                                    {isSpeaking ? <SpeakerStopIcon /> : <SpeakerPlayIcon />}
                                    <span>{isSpeaking ? 'Stop' : 'Read Aloud'}</span>
                                </button>
                                <button
                                    onClick={handleCopyReport}
                                    disabled={!recommendationReport}
                                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                                >
                                    Copy Text
                                </button>
                                <button
                                    onClick={handlePrintReport}
                                    disabled={!recommendationReport}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    Print
                                </button>
                                <button
                                    onClick={() => setIsReportModalOpen(false)}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default SettingsPage;