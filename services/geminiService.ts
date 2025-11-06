
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
        eventName: "Bigo Champions League",
        estimatedPayout: 4638
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
            text: "Analyze this screenshot from a mobile app event page. Extract the main event title or name, and the estimated reward or payout in 'beans'. The bean amount might be a single number or a range, if it's a range, provide the lowest number. Provide the response in JSON format.",
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
            estimatedPayout: {
              type: Type.NUMBER,
              description: "The estimated reward in beans. If it's a range like '500-1000', use the lower value (500).",
            },
          },
          required: ["eventName", "estimatedPayout"],
        },
      },
    });

    const jsonString = response.text.trim();
    const parsedResult = JSON.parse(jsonString);

    if (
      typeof parsedResult.eventName === "string" &&
      typeof parsedResult.estimatedPayout === "number"
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
