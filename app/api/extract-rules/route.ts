import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const thesis = body.thesis;

    if (!thesis) return NextResponse.json({ error: "Thesis is required" }, { status: 400 });
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: `You are an AI assistant that configures deterministic scoring engines for PE firms. Extract the target parameters from the user's investment thesis.
THESIS: "${thesis}"
Return ONLY valid JSON matching this schema:
{
  "targetIndustries": string[], // lowercased array of target industries (e.g. ["software", "healthcare"]). If none mentioned, use empty array.
  "targetLocations": string[], // lowercased array of target locations/states (e.g. ["texas", "new york"]). If none mentioned, use empty array.
  "minRevenue": number, // minimum revenue in dollars. If none mentioned, use 0.
  "maxRevenue": number, // maximum revenue in dollars. If none mentioned, use 1000000000.
  "minEmployees": number, // minimum employees. If none mentioned, use 0.
  "maxEmployees": number // maximum employees. If none mentioned, use 100000.
}`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const rules = JSON.parse(text);
    return NextResponse.json(rules);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to extract rules" }, { status: 500 });
  }
}
