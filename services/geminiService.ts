import { GoogleGenAI, Type } from "@google/genai";
import { OcrResult } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // This is a fallback for development. In a real environment, the key should be set.
  console.warn("Gemini API key not found. Using a placeholder. Please set process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "YOUR_API_KEY_HERE" });

export async function extractEventDetailsFromImage(base64Image: string): Promise<OcrResult> {
  if (!API_KEY) {
    console.log("Using mock data because API key is not available.");
    // Return mock data if API key is not available
    return new Promise(resolve => setTimeout(() => resolve({
        eventName: "55% Auto Rebate",
        eventDates: "11/08-11/11; 11/15-11/18",
        estimatedPayout: 38500,
        slots: [
            { time: "16:00", duration: 20 },
            { time: "17:00", duration: 20 },
        ]
    }), 1500));
  }

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
            text: "Analyze this event screenshot. Extract: 1. The main event title. 2. The event run dates as a string (e.g., '11/08-11/11'). 3. The maximum reward or payout in 'beans'. 4. All available time slots. If a time range is given (e.g., '4 PM - 6 PM'), create hourly slots within that range (4 PM, 5 PM). 5. The required participation duration in minutes (e.g., 'at least 20 mins'). This duration should be applied to all extracted time slots. Format time in HH:MM. Provide the response as JSON.",
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
            estimatedPayout: {
              type: Type.NUMBER,
              description: "The estimated reward in beans. Use the maximum value if multiple are listed.",
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
          required: ["eventName", "eventDates", "estimatedPayout", "slots"],
        },
      },
    });

    const jsonString = response.text.trim();
    const parsedResult = JSON.parse(jsonString);

    if (
      typeof parsedResult.eventName === "string" &&
      typeof parsedResult.eventDates === "string" &&
      typeof parsedResult.estimatedPayout === "number" &&
      Array.isArray(parsedResult.slots)
    ) {
      return parsedResult as OcrResult;
    } else {
      throw new Error("Invalid data format received from Gemini API.");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to extract event details from the image.");
  }
}