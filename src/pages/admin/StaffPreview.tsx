import { useState, useMemo } from "react";
import {
  GrandStaffPractice,
  type StaffHistoryEntry,
  type BatchNoteEntry,
  TOTAL_SLOTS,
  SVG_W,
  STAFF_X2,
  resolveStyle,
} from "@/components/practice/GrandStaffPractice";

// Right padding = SVG_W - STAFF_X2
const RIGHT_PADDING = SVG_W - STAFF_X2;

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"] as const;
const FLAT_ORDER  = ["B", "E", "A", "D", "G", "C", "F"] as const;

const TREBLE_SAMPLES = ["C4", "E4", "G4", "B4", "D5", "F5", "A5"] as const;
const BASS_SAMPLES   = ["C3", "E3", "G3", "B3", "D4", "F4", "A4"] as const;

function buildBatchNotes(
  batchSize: number,
  clef: "treble" | "bass",
  isGrand: boolean,
): BatchNoteEntry[] {
  return Array.from({ length: batchSize }, (_, i) => {
    if (isGrand) {
      const c = i % 2 === 0 ? "treble" : "bass";
      return {
        note: c === "treble" ? TREBLE_SAMPLES[i % 7] : BASS_SAMPLES[i % 7],
        clef: c,
      };
    }
    const arr = clef === "treble" ? TREBLE_SAMPLES : BASS_SAMPLES;
    return { note: arr[i % 7], clef };
  });
}

function buildHistory(
  historyCount: number,
  clef: "treble" | "bass",
  isGrand: boolean,
): StaffHistoryEntry[] {
  return Array.from({ length: historyCount }, (_, i) => {
    if (isGrand) {
      const c = i % 2 === 0 ? "treble" : "bass";
      return {
        id: i,
        note: c === "treble" ? TREBLE_SAMPLES[i % 7] : BASS_SAMPLES[i % 7],
        clef: c,
      };
    }
    const arr = clef === "treble" ? TREBLE_SAMPLES : BASS_SAMPLES;
    return { id: i, note: arr[i % 7], clef };
  });
}

function ToggleGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  testId?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="flex flex-wrap gap-1" data-testid={testId}>
        {options.map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded text-sm font-medium border transition-colors ${
              value === opt
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary/60"
            }`}
            data-testid={`toggle-${testId}-${opt}`}
          >
            {String(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StaffPreview() {
  const [level, setLevel]           = useState(1);
  const [batchSize, setBatchSize]   = useState<1 | 3 | 5 | 7>(1);
  const [clef, setClef]             = useState<"treble" | "bass">("treble");
  const [keySigType, setKeySigType] = useState<"none" | "sharps" | "flats">("none");
  const [keySigCount, setKeySigCount] = useState(2);
  const [historyCount, setHistoryCount] = useState(3);
  const [batchIndex, setBatchIndex] = useState(0);

  const isGrand = level >= 5;

  const { keySharps, keyFlats, keySigN } = useMemo(() => {
    if (keySigType === "none" || keySigCount === 0) {
      return { keySharps: undefined, keyFlats: undefined, keySigN: 0 };
    }
    const n = keySigCount;
    if (keySigType === "sharps") {
      return { keySharps: [...SHARP_ORDER].slice(0, n), keyFlats: undefined, keySigN: n };
    }
    return { keySharps: undefined, keyFlats: [...FLAT_ORDER].slice(0, n), keySigN: n };
  }, [keySigType, keySigCount]);

  const style = useMemo(
    () => resolveStyle(level, keySigN, batchSize),
    [level, keySigN, batchSize],
  );

  // Visible note count N
  const N = batchSize === 1 ? Math.min(historyCount + 1, TOTAL_SLOTS) : batchSize;

  // Current layout X positions
  const currentXArr = useMemo(
    () => Array.from({ length: N }, (_, i) => Math.round(style.noteStartX + i * style.noteSpacing)),
    [N, style.noteStartX, style.noteSpacing],
  );

  // N-equal-division projected X positions
  const effectiveWidth = SVG_W - style.noteStartX - RIGHT_PADDING;
  const segmentWidth   = effectiveWidth / N;
  const ndivXArr = useMemo(
    () => Array.from({ length: N }, (_, i) => Math.round(style.noteStartX + segmentWidth * (i + 0.5))),
    [N, style.noteStartX, segmentWidth],
  );

  // Sample notes
  const batchNotes = useMemo(
    () => (batchSize > 1 ? buildBatchNotes(batchSize, clef, isGrand) : undefined),
    [batchSize, clef, isGrand],
  );
  const noteHistory = useMemo(
    () => (batchSize === 1 ? buildHistory(historyCount, clef, isGrand) : undefined),
    [batchSize, historyCount, clef, isGrand],
  );
  const targetNote = batchSize === 1
    ? (isGrand
        ? (historyCount % 2 === 0 ? TREBLE_SAMPLES[historyCount % 7] : BASS_SAMPLES[historyCount % 7])
        : (clef === "treble" ? TREBLE_SAMPLES[historyCount % 7] : BASS_SAMPLES[historyCount % 7]))
    : undefined;
  const targetClef = batchSize === 1 && isGrand
    ? (historyCount % 2 === 0 ? "treble" : "bass")
    : clef;

  // batchIndex clamp
  const clampedBatchIndex = Math.min(batchIndex, batchSize - 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Staff Preview</h1>
        <span className="text-xs font-semibold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">
          N-div debug
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Controls */}
        <div className="space-y-5 bg-card border border-border rounded-xl p-4" data-testid="controls-panel">
          <ToggleGroup
            label="Level"
            options={[1, 2, 3, 4, 5, 6, 7] as const}
            value={level}
            onChange={(v) => setLevel(v)}
            testId="level"
          />

          <ToggleGroup
            label="BatchSize"
            options={[1, 3, 5, 7] as const}
            value={batchSize}
            onChange={(v) => {
              setBatchSize(v);
              setBatchIndex(0);
            }}
            testId="batchsize"
          />

          {!isGrand && (
            <ToggleGroup
              label="Clef"
              options={["treble", "bass"] as const}
              value={clef}
              onChange={(v) => setClef(v)}
              testId="clef"
            />
          )}

          <ToggleGroup
            label="Key Sig"
            options={["none", "sharps", "flats"] as const}
            value={keySigType}
            onChange={(v) => setKeySigType(v)}
            testId="keysig-type"
          />

          {keySigType !== "none" && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Key count: {keySigCount}
              </div>
              <input
                type="range"
                min={1}
                max={7}
                value={keySigCount}
                onChange={(e) => setKeySigCount(Number(e.target.value))}
                className="w-full"
                data-testid="keysig-count-slider"
              />
            </div>
          )}

          {batchSize === 1 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                History: {historyCount}
              </div>
              <input
                type="range"
                min={0}
                max={TOTAL_SLOTS - 1}
                value={historyCount}
                onChange={(e) => setHistoryCount(Number(e.target.value))}
                className="w-full"
                data-testid="history-count-slider"
              />
            </div>
          )}

          {batchSize > 1 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                BatchIndex: {clampedBatchIndex}
              </div>
              <input
                type="range"
                min={0}
                max={batchSize - 1}
                value={clampedBatchIndex}
                onChange={(e) => setBatchIndex(Number(e.target.value))}
                className="w-full"
                data-testid="batch-index-slider"
              />
            </div>
          )}
        </div>

        {/* Preview + Meta */}
        <div className="space-y-4">
          <GrandStaffPractice
            targetNote={targetNote}
            targetAccidental={null}
            noteHistory={batchSize === 1 ? noteHistory : undefined}
            batchNotes={batchSize > 1 ? batchNotes : undefined}
            batchIndex={batchSize > 1 ? clampedBatchIndex : undefined}
            clef={targetClef}
            level={level}
            batchSize={batchSize}
            keySharps={keySharps}
            keyFlats={keyFlats}
            className="max-w-2xl"
          />

          {/* Meta panel */}
          <div
            className="bg-card border border-border rounded-xl p-4 font-mono text-xs space-y-3"
            data-testid="meta-panel"
          >
            <div className="font-semibold text-sm font-sans">Layout Metrics</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetaStat label="N (visible)" value={N} testId="meta-N" />
              <MetaStat label="noteStartX" value={Math.round(style.noteStartX)} testId="meta-noteStartX" />
              <MetaStat label="noteSpacing" value={Math.round(style.noteSpacing)} testId="meta-noteSpacing" />
              <MetaStat label="effectiveW" value={Math.round(effectiveWidth)} testId="meta-effectiveWidth" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground mb-1">Current X positions</div>
                <div className="bg-background rounded px-2 py-1 text-[11px]" data-testid="meta-current-x">
                  [{currentXArr.join(", ")}]
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">N-div projected X</div>
                <div className="bg-background rounded px-2 py-1 text-[11px]" data-testid="meta-ndiv-x">
                  [{ndivXArr.join(", ")}]
                </div>
              </div>
            </div>

            <div className="text-muted-foreground text-[11px] grid grid-cols-2 sm:grid-cols-3 gap-x-4">
              <span>segmentW = <span data-testid="meta-segmentWidth">{segmentWidth.toFixed(1)}</span></span>
              <span>rightPad = {RIGHT_PADDING}</span>
              <span>SVG_W = {SVG_W}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div className="bg-background rounded px-2 py-1.5 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-bold text-sm" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}
