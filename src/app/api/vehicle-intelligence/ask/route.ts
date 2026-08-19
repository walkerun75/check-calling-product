import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to use Fleet AI." }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Fleet AI is ready but not connected. Add OPENAI_API_KEY to the server environment." }, { status: 503 });

  const body = await request.json().catch(() => null) as { question?: string } | null;
  const question = body?.question?.trim();
  if (!question || question.length > 600) return NextResponse.json({ error: "Enter a fleet question under 600 characters." }, { status: 400 });

  const { data: membership } = await supabase.from("organization_members").select("organization_id,organizations(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.organization_id) return NextResponse.json({ error: "Organization context is unavailable." }, { status: 403 });
  const { data: vehicles } = await supabase.from("vehicles").select("id,year,make,model,status,odometer,daily_rate").eq("organization_id", membership.organization_id).order("created_at");
  const organization = membership.organizations as unknown as { name?: string } | null;
  const fleet = (vehicles ?? []).map(vehicle => ({ year: vehicle.year, make: vehicle.make, model: vehicle.model, status: vehicle.status, odometer: vehicle.odometer, dailyRate: vehicle.daily_rate }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      input: [
        { role: "developer", content: "You are Check Calling Fleet AI. Answer only from the supplied organization fleet data. Be concise and operational. Clearly distinguish verified records from projections. Never invent rentals, payments, revenue, maintenance history, telemetry, or utilization. If required data is not connected, say so and recommend the next useful action." },
        { role: "user", content: `Organization: ${organization?.name ?? "Host organization"}\nFleet records: ${JSON.stringify(fleet)}\nQuestion: ${question}` },
      ],
      max_output_tokens: 350,
      safety_identifier: `fleet_${membership.organization_id}`,
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    console.error("OpenAI fleet question failed", { status: response.status, message: detail?.error?.message });
    return NextResponse.json({ error: "Fleet AI could not answer right now. Try again shortly." }, { status: 502 });
  }
  const result = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const answer = result.output?.flatMap(item => item.content ?? []).filter(item => item.type === "output_text").map(item => item.text ?? "").join("\n").trim();
  return NextResponse.json({ answer: answer || "Fleet AI returned no text. Please try a more specific question." });
}
