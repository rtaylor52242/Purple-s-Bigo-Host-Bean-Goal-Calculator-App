

import { GoogleGenAI, Type } from "@google/genai";
import { OcrResult, RegionalTier } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractEventDetailsFromImage(base64Image: string): Promise<OcrResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Analyze this event screenshot. Extract: 1. The main event title. 2. The event run dates as a string (e.g., '11/08-11/11'). 3. A list of all reward tiers, including the level number and the beans rewarded. 4. All available time slots. If a time range is given (e.g., '4 PM - 6 PM'), create slots for every 30 minutes within that range. 5. The required participation duration in minutes. This duration should apply to all slots. 6. The rebate percentage if specified. Format time in HH:MM. Provide the response as JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            eventName: {
              type: Type.STRING,
              description: "The main title of the event.",
            },
            eventDates: {
              type: Type.STRING,
              description: "The dates or date range of the event, e.g., '11/08-11/11; 11/15-11/18'."
            },
            rebatePercent: {
                type: Type.NUMBER,
                description: "The rebate percentage offered for the event, if any."
            },
            rewardTiers: {
              type: Type.ARRAY,
              description: "A list of reward tiers for the event.",
              items: {
                type: Type.OBJECT,
                properties: {
                  level: {
                    type: Type.NUMBER,
                    description: "The level of the reward tier, e.g., 1."
                  },
                  beans: {
                    type: Type.NUMBER,
                    description: "The number of beans awarded for this tier."
                  },
                   description: {
                    type: Type.STRING,
                    description: "A brief description of the tier's requirements if available."
                  }
                },
                required: ["level", "beans"]
              }
            },
            slots: {
                type: Type.ARRAY,
                description: "A list of available time slots for the event.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        time: {
                            type: Type.STRING,
                            description: "The start time of the slot in HH:MM format (e.g., '16:00')."
                        },
                        duration: {
                            type: Type.NUMBER,
                            description: "The required participation duration in minutes (e.g., 20)."
                        }
                    },
                    required: ["time", "duration"],
                }
            }
          },
          required: ["eventName", "eventDates", "rewardTiers", "slots"],
        },
      },
    });

    const jsonString = response.text.trim();
    const parsedResult = JSON.parse(jsonString);

    if (
      typeof parsedResult.eventName === "string" &&
      typeof parsedResult.eventDates === "string" &&
      Array.isArray(parsedResult.rewardTiers) &&
      Array.isArray(parsedResult.slots)
    ) {
      // Sort tiers by bean count ascending
      parsedResult.rewardTiers.sort((a: any, b: any) => a.beans - b.beans);
      return parsedResult as OcrResult;
    } else {
      throw new Error("Invalid data format received from Gemini API.");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to extract event details from the image.");
  }
}

export async function extractRegionalTiersFromImage(base64Image: string): Promise<RegionalTier[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Analyze this regional tier chart screenshot. The chart has columns: 'Rank', 'Bean Goal', 'Hours Required', 'Tier Payout', '40% MAX In Agency Support', and 'Instant Wallet Profit'. Extract all rows. Provide the response as a JSON array of objects. Each object should have keys: 'rank' (string), 'goal' (number), 'hoursRequired' (number), 'payout' (number), 'agencySupport' (number), and 'walletProfit' (number). Ignore currency symbols and commas when parsing numbers.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            description: "A list of regional goal tiers and their corresponding data.",
            items: {
              type: Type.OBJECT,
              properties: {
                rank: {
                  type: Type.STRING,
                  description: "The rank for the tier, e.g., 'S20'."
                },
                goal: {
                  type: Type.NUMBER,
                  description: "The bean goal for the tier, from the 'Bean Goal' column."
                },
                hoursRequired: {
                  type: Type.NUMBER,
                  description: "The hours required for the tier."
                },
                payout: {
                  type: Type.NUMBER,
                  description: "The cash payout from the 'Tier Payout' column."
                },
                agencySupport: {
                  type: Type.NUMBER,
                  description: "The value from the '40% MAX In Agency Support' column."
                },
                walletProfit: {
                  type: Type.NUMBER,
                  description: "The value from the 'Instant Wallet Profit' column."
                }
              },
              required: ["rank", "goal", "hoursRequired", "payout", "agencySupport", "walletProfit"]
            }
        },
      },
    });

    const jsonString = response.text.trim();
    const parsedResult = JSON.parse(jsonString);

    if (Array.isArray(parsedResult)) {
        // Sort tiers by goal descending to match image
        parsedResult.sort((a: any, b: any) => b.goal - a.goal);
        return parsedResult as RegionalTier[];
    } else {
        throw new Error("Invalid data format received from Gemini API.");
    }
  } catch (error) {
    console.error("Error calling Gemini API for tier chart:", error);
    throw new Error("Failed to extract tier details from the image.");
  }
}


export async function generateGoalPathways(data: {
  monthlyBeanGoal: number;
  currentBeanCount: number;
  remainingDays: number;
  maxPathways?: number;
  preferredDates: string[];
  selectedSlots: { name: string; beans: number; duration: number }[];
  availableSlots: { name: string; time: string; duration: number; beans: number; }[];
  totalBeansFromSelected: number;
  timeFormat: 'standard' | 'military';
  allowEventAutoselection: boolean;
  model: string;
  hoursRequired: number;
  currentHours: number;
  totalHoursFromSelected: number;
}): Promise<string> {
  const beansStillNeeded = data.monthlyBeanGoal - data.currentBeanCount;
  const hoursStillNeeded = data.hoursRequired - data.currentHours;

  const pathwayInstructions = data.allowEventAutoselection
    ? `**Important Formatting for Pathways:**
- For each pathway, list the specific events to select (Name, Time, Duration, Beans).
- Conclude each pathway with a summary: Total additional beans, total additional hours, and total additional days required.`
    : `**Important Formatting for Pathways:**
- For each pathway, provide a generalized strategy. DO NOT list specific events to select. Instead, describe the *types* of events the user should look for (e.g., "Select 3 high-bean weekend events," or "Choose about 5 events with a high bean-per-minute ratio.").
- Conclude each pathway with a summary: Estimated additional beans, estimated hours, and estimated days required to fulfill the strategy.`;

  const prompt = `
You are an expert strategic advisor for Bigo Live hosts. Your task is to analyze the user's current situation and recommend several distinct pathways to achieve their monthly bean and hour goals.

**User's Current Situation:**
- Monthly Bean Goal: ${data.monthlyBeanGoal.toLocaleString()} beans
- Required Hours for Goal: ${data.hoursRequired} hours
- Current Bean Count: ${data.currentBeanCount.toLocaleString()} beans
- Current Hours Logged: ${data.currentHours} hours
- **Total Beans Still Needed:** ${beansStillNeeded.toLocaleString()} beans
- **Total Hours Still Needed:** ${hoursStillNeeded.toLocaleString(undefined, {maximumFractionDigits: 2})} hours
- Days Remaining this Month: ${data.remainingDays}
- Maximum number of pathways to suggest: ${data.maxPathways || 6}
- User's Preferred Streaming Dates: [${data.preferredDates.join(', ') || 'None specified'}]
- **User's Preferred Time Format:** ${data.timeFormat === 'standard' ? '12-hour AM/PM' : '24-hour military'}. All times in your response MUST be in this format.

**Events Already Selected by the User (These are fixed and must be included in calculations):**
${data.selectedSlots.length > 0 ? data.selectedSlots.map(s => `- ${s.name}: ${s.beans.toLocaleString()} beans (${s.duration} minutes)`).join('\n') : '- None'}
Total beans from selected events: ${data.totalBeansFromSelected.toLocaleString()} beans
Total hours from selected events: ${data.totalHoursFromSelected.toLocaleString(undefined, {maximumFractionDigits: 2})} hours

**Available Event Slots the User Can Still Choose From:**
${data.availableSlots.map(s => `- ${s.name} at ${s.time} for ${s.duration}m: ${s.beans.toLocaleString()} beans`).join('\n')}

**Your Task:**

Generate a comprehensive report in Markdown format. The report must include the following sections. All titles and headings MUST be bold.

1.  **Executive Summary:** Briefly summarize the user's goal (both beans and hours), their current progress, and the total beans and hours they still need to acquire after accounting for their already selected events. Explain the different strategies you will outline.

2.  **Recommended Pathways:**
    Based on the available slots, generate up to ${data.maxPathways || 6} distinct, sequential plans to meet or exceed BOTH the remaining bean and hour goals. Each pathway must satisfy the minimum required hours. For each pathway, provide a clear, **bold** title.

    Generate a pathway for each of the following strategies:
    a. **The "Fastest Hours" Pathway:** Achieve the goals using the combination of events that requires the minimum total additional streaming time.
    b. **The "Time-Efficient" Pathway:** Achieve the goals using the fewest number of days, prioritizing packing more events into fewer days if possible.
    c. **The "Minimalist" Pathway:** Achieve the goals by selecting the fewest number of additional events.
    d. **The "Bean Maximizer" Pathway:** Achieve the goals by selecting events with the highest bean-per-minute ratio first. This is about efficiency.
    e. **The "Preferred Days" Pathway:** Achieve the goals while prioritizing events that fall on the user's preferred dates. Only use non-preferred dates if absolutely necessary.
    f. **The "Consistent Streamer" Pathway:** Achieve the goals by selecting events that spread the work out, aiming for a consistent daily stream time of around 2 hours, if possible.

    ${pathwayInstructions}

3.  **Best Pathway Summary:**
    After generating the pathways, add a final section with the bold title: **Best Pathway Summary**. In this section, analyze your own recommendations. For each of the 6 strategies you were asked to generate (Fastest Hours, Time-Efficient, etc.), explicitly state which of your generated pathways is the best fit and provide a one-sentence justification.

**Constraint Checklist & Final Analysis:**
- All times MUST be formatted in the user's preferred format: ${data.timeFormat === 'standard' ? '12-hour AM/PM' : '24-hour military'}.
- Ensure all calculations for both beans and hours are accurate.
- All pathways must meet or slightly exceed BOTH the required bean goal AND the required hour goal.
- The tone should be encouraging and strategic.
- Structure your response clearly with Markdown headings, lists, and bold text for readability.
- ${data.allowEventAutoselection ? 'Do not invent events; only use the ones from the "Available Event Slots" list.' : 'Base your generalized advice on the types of events available in the "Available Event Slots" list.'}
`;

  try {
    const response = await ai.models.generateContent({
      model: data.model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for goal pathways:", error);
    throw new Error("Failed to generate goal recommendations.");
  }
}
