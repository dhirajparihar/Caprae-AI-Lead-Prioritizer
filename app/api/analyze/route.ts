import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lead = body.lead;
    const thesis = body.thesis || "General B2B acquisition target.";

    if (!lead) return NextResponse.json({ error: "Lead is required" }, { status: 400 });
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reason: lead.reasons?.join("; ") || "The lead matches several target criteria.",
        signal: lead.reasons?.[0] || "Available business-fit data",
        concern: "AI analysis is not configured in this demo environment.",
        outreachAngle: "Lead with the business characteristics that best match the target profile.",
        emailDraft: "Hi team,\n\nI noticed your strong growth signals. We are interested in discussing potential partnership opportunities.\n\nBest,\nCaprae Capital"
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: `You are a B2B M&A acquisition analyst at Caprae Capital. Analyze this potential acquisition target against the following investment thesis:\n\nTHESIS: "${thesis}"\n\nTARGET DATA: ${JSON.stringify(lead)}\n\nReturn ONLY valid JSON with these keys: reason, signal, concern, outreachAngle, emailDraft. Do not invent facts. Keep reason, signal, concern, and outreachAngle under 35 words. For emailDraft, write a concise, highly personalized 3-sentence cold email to the founder based on the thesis and their data.`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        reason: text.slice(0, 300),
        signal: lead.reasons?.[0] || "Business-fit signal",
        concern: "Review available company data before outreach.",
        outreachAngle: "Use the strongest verified business-fit signal as the opening angle.",
        emailDraft: "Failed to parse AI response. Please try again."
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to analyze lead" }, { status: 500 });
  }
}
