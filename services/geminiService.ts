
import { GoogleGenAI, Type } from "@google/genai";
import { OcrResult } from "../types";

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
            text: "Analyze this event screenshot. Extract: 1. The main event title. 2. The event run dates as a string (e.g., '11/08-11/11'). 3. A list of all reward tiers, including the level number and the beans rewarded. 4. All available time slots. If a time range is given (e.g., '4 PM - 6 PM'), create slots for every 30 minutes within that range. 5. The required participation duration in minutes. This duration should apply to all slots. Format time in HH:MM. Provide the response as JSON.",
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
