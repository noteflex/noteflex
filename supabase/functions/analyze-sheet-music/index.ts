import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_KEYS = new Set(["C", "D", "E", "F", "G", "A", "B"]);
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 7;

type RawNote = {
  key?: unknown;
  octave?: unknown;
  accidental?: unknown;
};

type CleanNote = {
  key: string;
  octave: string;
  accidental?: "#" | "b";
};

type ValidationSummary = {
  rawCount: number;
  validCount: number;
  droppedCount: number;
  correctedKeyCount: number;
  clampedOctaveCount: number;
  normalizedAccidentalCount: number;
  removedAccidentalCount: number;
  confidenceScore: number;
};

function toKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toUpperCase();
  if (VALID_KEYS.has(normalized)) return normalized;
  return null;
}

function toOctave(input: unknown): { value: string | null; clamped: boolean } {
  if (input === null || input === undefined) return { value: null, clamped: false };
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return { value: null, clamped: false };

  const rounded = Math.round(numeric);
  const clamped = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, rounded));
  return { value: String(clamped), clamped: clamped !== rounded };
}

function toAccidental(input: unknown): { value?: "#" | "b"; normalized: boolean; removed: boolean } {
  if (input === null || input === undefined) return { normalized: false, removed: false };
  if (typeof input !== "string") return { normalized: false, removed: true };

  const raw = input.trim();
  if (!raw) return { normalized: false, removed: true };
  if (raw === "#" || raw === "♯") return { value: "#", normalized: raw !== "#", removed: false };
  if (raw === "b" || raw === "♭") return { value: "b", normalized: raw !== "b", removed: false };
  return { normalized: false, removed: true };
}

function sanitizeNotes(rawNotes: unknown): { notes: CleanNote[]; summary: ValidationSummary } {
  const source = Array.isArray(rawNotes) ? rawNotes : [];
  let correctedKeyCount = 0;
  let clampedOctaveCount = 0;
  let normalizedAccidentalCount = 0;
  let removedAccidentalCount = 0;
  let droppedCount = 0;

  const cleaned: CleanNote[] = [];

  for (const item of source) {
    if (!item || typeof item !== "object") {
      droppedCount++;
      continue;
    }

    const raw = item as RawNote;
    const key = toKey(raw.key);
    const octave = toOctave(raw.octave);
    const accidental = toAccidental(raw.accidental);

    if (!key || !octave.value) {
      droppedCount++;
      continue;
    }

    if (typeof raw.key === "string" && raw.key.trim().toUpperCase() !== key) {
      correctedKeyCount++;
    }
    if (octave.clamped) {
      clampedOctaveCount++;
    }
    if (accidental.normalized) {
      normalizedAccidentalCount++;
    }
    if (raw.accidental !== undefined && accidental.removed) {
      removedAccidentalCount++;
    }

    cleaned.push({
      key,
      octave: octave.value,
      ...(accidental.value ? { accidental: accidental.value } : {}),
    });
  }

  const rawCount = source.length;
  const validCount = cleaned.length;
  const scoreRaw = rawCount === 0
    ? 0
    : ((validCount * 1.0) - (droppedCount * 0.35) - (clampedOctaveCount * 0.1) - (removedAccidentalCount * 0.08));
  const confidenceScore = Math.max(0, Math.min(100, Math.round((scoreRaw / Math.max(rawCount, 1)) * 100)));

  return {
    notes: cleaned,
    summary: {
      rawCount,
      validCount,
      droppedCount,
      correctedKeyCount,
      clampedOctaveCount,
      normalizedAccidentalCount,
      removedAccidentalCount,
      confidenceScore,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "인증이 필요합니다. 다시 로그인해주세요." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "인증이 유효하지 않습니다. 다시 로그인해주세요." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: quotaData, error: quotaError } = await supabase
      .from("profiles")
      .select("scan_quota")
      .eq("id", user.id)
      .single();

    if (quotaError) {
      throw new Error(`Failed to read scan quota: ${quotaError.message}`);
    }

    const currentQuota = quotaData?.scan_quota ?? 0;
    if (currentQuota <= 0) {
      return new Response(
        JSON.stringify({
          error: "스캔 횟수가 부족합니다. 충전 후 이용해주세요.",
          remainingScanQuota: 0,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a music score (sheet music) analysis AI. 
Given an image of sheet music, extract every visible note in order from left to right, top to bottom.

Return ONLY a JSON object with this exact structure:
{
  "notes": [
    { "key": "C", "octave": "4" },
    { "key": "E", "octave": "4", "accidental": "#" },
    { "key": "B", "octave": "3", "accidental": "b" }
  ]
}

Rules:
- "key" must be one of: C, D, E, F, G, A, B
- "octave" must be a string number ("1" through "7")
- "accidental" is optional: "#" for sharp, "b" for flat. Omit for natural notes.
- Use standard concert pitch octave numbering (Middle C = C4)
- Include ALL notes visible in the score, in reading order
- If you cannot identify a note clearly, make your best guess
- Do NOT include rests, time signatures, or other non-note symbols
- Return ONLY the JSON, no markdown, no explanation`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
                {
                  type: "text",
                  text: "Please analyze this sheet music and extract all the notes.",
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_notes",
                description: "Extract musical notes from sheet music image",
                parameters: {
                  type: "object",
                  properties: {
                    notes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: {
                            type: "string",
                            enum: ["C", "D", "E", "F", "G", "A", "B"],
                          },
                          octave: { type: "string" },
                          accidental: {
                            type: "string",
                            enum: ["#", "b"],
                          },
                        },
                        required: ["key", "octave"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["notes"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_notes" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Extract from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let notes: unknown;

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      notes = parsed.notes;
    } else {
      // Fallback: try parsing content as JSON
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        notes = parsed.notes;
      } else {
        throw new Error("Could not parse AI response");
      }
    }

    const { notes: cleanedNotes, summary } = sanitizeNotes(notes);

    if (cleanedNotes.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No valid notes extracted after validation",
          notes: [],
          validation: summary,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: consumeRows, error: consumeError } = await supabase.rpc("consume_scan_quota");
    if (consumeError) {
      throw new Error(`Failed to consume scan quota: ${consumeError.message}`);
    }

    const remainingScanQuota =
      Array.isArray(consumeRows) && consumeRows.length > 0
        ? Number(consumeRows[0]?.remaining_quota ?? 0)
        : 0;

    if (!Array.isArray(consumeRows) || consumeRows.length === 0) {
      return new Response(
        JSON.stringify({
          error: "스캔 횟수가 부족합니다. 충전 후 이용해주세요.",
          remainingScanQuota: 0,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        notes: cleanedNotes,
        confidenceScore: summary.confidenceScore,
        validation: summary,
        remainingScanQuota,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-sheet-music error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
