import { useState, useMemo } from "react";
import {
  GrandStaffPractice,
  type StaffHistoryEntry,
  type BatchNoteEntry,
  TOTAL_SLOTS,
  SVG_W,
  STAFF_X2,
  resolveStyle,
  computeMaxVisibleN,
  computeScale,
} from "@/components/practice/GrandStaffPractice";

// Right padding = SVG_W - STAFF_X2
const RIGHT_PADDING = SVG_W - STAFF_X2;

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"] as const;
const FLAT_ORDER  = ["B", "E", "A", "D", "G", "C", "F"] as const;

const TREBLE_SAMPLES = ["C4", "E4", "G4", "B4", "D5", "F5", "A5"] as const;
const BASS_SAMPLES   = ["C3", "E3", "G3", "B3", "D4", "F4", "A4"] as const;

// scale preset → canonical M value for that scale
const SCALE_PRESET_M: Record<string, number> = {
  "1.0": 3, "0.85": 5, "0.75": 7, "0.65": 10, "0.55": 12,
};

const VIEWPORT_CONFIGS = {
  portrait:  { w: 375,  h: 667,  label: "375×667" },
  landscape: { w: 667,  h: 375,  label: "667×375" },
  desktop:   { w: 1440, h: 900,  label: "1440×900" },
} as const;
type ViewportKey = keyof typeof VIEWPORT_CONFIGS;

// NoteButtons + GameHeader + CountdownTimer + stage label + padding ≈ 190px
const GAME_CHROME_H = 190;

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
  const [batchSize, setBatchSize]   = useState<1 | 2 | 3 | 5 | 7>(1);
  const [keySigType, setKeySigType] = useState<"none" | "sharps" | "flats">("none");
  const [keySigCount, setKeySigCount] = useState(2);
  const [historyCount, setHistoryCount] = useState(3);
  const [batchIndex, setBatchIndex] = useState(0);
  const [totalSets, setTotalSets]   = useState(5);
  const [showSlotIdx, setShowSlotIdx] = useState(false);

  // §S3 신규 토글
  const [staffMode, setStaffMode]     = useState<"treble" | "bass" | "grand">("treble");
  const [scalePreset, setScalePreset] = useState<"auto" | "1.0" | "0.85" | "0.75" | "0.65" | "0.55">("auto");
  const [viewport, setViewport]       = useState<"none" | ViewportKey>("none");

  // Staff mode 파생 값
  const isGrand = staffMode === "grand";
  const clef: "treble" | "bass" = staffMode === "bass" ? "bass" : "treble";
  // grand 강제 시 level≥5 보장 (resolveStyle이 bassYOff를 적용하기 위함)
  const styleLevel = isGrand ? Math.max(level, 5) : level;

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

  // §C1 M-등분 고정 슬롯
  const M = computeMaxVisibleN(false, batchSize, batchSize === 1 ? totalSets : batchSize, 0);

  // §S3 scale preset override: 선택 시 해당 scale canonical M으로 resolveStyle 호출
  const resolveM = scalePreset === "auto" ? M : SCALE_PRESET_M[scalePreset];
  const uniscale = computeScale(resolveM);

  const style = useMemo(
    () => resolveStyle(styleLevel, keySigN, batchSize, resolveM),
    [styleLevel, keySigN, batchSize, resolveM],
  );

  // Layout metrics
  const segmentWidth    = style.noteSpacing;
  const rawNoteStartX   = Math.round(style.noteStartX - segmentWidth / 2);
  const effectiveWidth  = STAFF_X2 - rawNoteStartX;
  const staffHeight     = Math.round(style.staffBot - style.staffTop);
  const staffLineGap    = Math.round((style.staffBot - style.staffTop) / 4);

  // Effective M for slot display (resolveM may differ from natural M)
  const displayM = resolveM;

  const allSlotsXArr = useMemo(
    () => Array.from({ length: displayM }, (_, i) => Math.round(style.noteStartX + i * style.noteSpacing)),
    [displayM, style.noteStartX, style.noteSpacing],
  );

  const ndivXArr = useMemo(
    () => Array.from({ length: displayM }, (_, i) => Math.round(rawNoteStartX + segmentWidth * (i + 0.5))),
    [displayM, rawNoteStartX, segmentWidth],
  );

  const visibleN = batchSize === 1 ? Math.min(historyCount + 1, displayM) : batchSize;
  const emptySlots = displayM - visibleN;

  // §S3 viewport overflow 계산
  const vpConfig = viewport !== "none" ? VIEWPORT_CONFIGS[viewport] : null;
  const contentW = vpConfig ? Math.min(vpConfig.w, 612) : null;
  const staffRenderH = contentW !== null ? Math.round(contentW * style.svgH / SVG_W) : null;
  const availH = vpConfig ? vpConfig.h - GAME_CHROME_H : null;
  const overflowStatus =
    staffRenderH !== null && availH !== null
      ? staffRenderH > availH ? "⚠️ overflow" : "✅ fits"
      : null;

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

  const clampedBatchIndex = Math.min(batchIndex, batchSize - 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Staff Preview</h1>
        <span className="text-xs font-semibold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">
          S1·S2 scale/viewport debug
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
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

          {/* §S3: Staff Mode (treble·bass·grand) — 기존 Clef 토글 대체 */}
          <ToggleGroup
            label="Staff Mode"
            options={["treble", "bass", "grand"] as const}
            value={staffMode}
            onChange={(v) => setStaffMode(v)}
            testId="staff-mode"
          />

          {/* §S3: Scale Preset — M override for scale 시각 검증 */}
          <ToggleGroup
            label="Scale (M override)"
            options={["auto", "1.0", "0.85", "0.75", "0.65", "0.55"] as const}
            value={scalePreset}
            onChange={(v) => setScalePreset(v)}
            testId="scale-preset"
          />

          {/* §S3: Viewport simulation */}
          <ToggleGroup
            label="Viewport"
            options={["none", "portrait", "landscape", "desktop"] as const}
            value={viewport}
            onChange={(v) => setViewport(v)}
            testId="viewport"
          />

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
            <>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  TotalSets (M): {totalSets}
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={totalSets}
                  onChange={(e) => setTotalSets(Number(e.target.value))}
                  className="w-full"
                  data-testid="total-sets-slider"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  History (answered): {historyCount}
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, displayM - 1)}
                  value={Math.min(historyCount, displayM - 1)}
                  onChange={(e) => setHistoryCount(Number(e.target.value))}
                  className="w-full"
                  data-testid="history-count-slider"
                />
              </div>
            </>
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

          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Debug
            </div>
            <button
              onClick={() => setShowSlotIdx((v) => !v)}
              className={`px-2.5 py-1 rounded text-sm font-medium border transition-colors ${
                showSlotIdx
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/60"
              }`}
              data-testid="toggle-slot-idx"
            >
              {showSlotIdx ? "Hide" : "Show"} slot idx
            </button>
          </div>
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
            level={styleLevel}
            batchSize={batchSize}
            maxVisibleN={displayM}
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

            {/* M·배치 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetaStat label="M (slots)" value={displayM} testId="meta-M" />
              <MetaStat label="noteStartX" value={rawNoteStartX} testId="meta-noteStartX" />
              <MetaStat label="segmentW" value={Math.round(segmentWidth)} testId="meta-noteSpacing" />
              <MetaStat label="effectiveW" value={Math.round(effectiveWidth)} testId="meta-effectiveWidth" />
            </div>

            {/* §S1 scale */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetaStatFloat label="uniscale" value={uniscale} testId="meta-uniscale" />
              <MetaStat label="staffH" value={staffHeight} testId="meta-staffH" />
              <MetaStat label="lineGap" value={staffLineGap} testId="meta-staffLineGap" />
              <MetaStat label="noteheadRX" value={Math.round(style.noteheadRX * 10) / 10} testId="meta-noteheadRX" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetaStat label="clefSize" value={Math.round(style.clefFontSize)} testId="meta-clefFontSize" />
              <MetaStat label="keySigSize" value={Math.round(style.keySigFontSize)} testId="meta-keySigFontSize" />
              <MetaStat label="svgH" value={style.svgH} testId="meta-svgH" />
              <MetaStat label="bassYOff" value={Math.round(style.bassYOff)} testId="meta-bassYOff" />
            </div>

            {/* §S3 staff mode */}
            <div className="text-[11px] text-muted-foreground">
              Staff:{" "}
              <span className="font-semibold text-foreground" data-testid="meta-staff-mode">
                {staffMode}
              </span>
              {" · "}Level:{" "}
              <span data-testid="meta-style-level">{styleLevel}</span>
            </div>

            {/* §S3 viewport */}
            {vpConfig && (
              <div
                className="text-[11px] rounded bg-background px-2 py-1 space-y-0.5"
                data-testid="meta-viewport"
              >
                <div className="font-semibold">
                  Viewport: {vpConfig.label}{" "}
                  <span
                    className={overflowStatus?.startsWith("✅") ? "text-emerald-600" : "text-red-600"}
                    data-testid="meta-overflow"
                  >
                    {overflowStatus}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  staffRenderH={staffRenderH}px / availH={availH}px (viewport-{GAME_CHROME_H}chrome)
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <MetaStat label="visibleN" value={visibleN} testId="meta-visibleN" />
              <MetaStat label="emptySlots" value={emptySlots} testId="meta-empty-slots" />
              <MetaStat label="TOTAL_SLOTS" value={TOTAL_SLOTS} testId="meta-total-slots" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted-foreground mb-1">All slot X positions (M={displayM})</div>
                <div className="bg-background rounded px-2 py-1 text-[11px]" data-testid="meta-current-x">
                  [{allSlotsXArr.join(", ")}]
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">N-div projected X</div>
                <div className="bg-background rounded px-2 py-1 text-[11px]" data-testid="meta-ndiv-x">
                  [{ndivXArr.join(", ")}]
                </div>
              </div>
            </div>

            {showSlotIdx && (
              <div data-testid="meta-slot-idx">
                <div className="text-muted-foreground mb-1">Slot indices</div>
                <div className="flex flex-wrap gap-1">
                  {allSlotsXArr.map((x, i) => (
                    <span
                      key={i}
                      className="bg-background border border-border rounded px-1.5 py-0.5 text-[11px]"
                      data-testid={`slot-idx-${i}`}
                    >
                      [{i}] x={x}
                    </span>
                  ))}
                </div>
              </div>
            )}

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

function MetaStatFloat({
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
        {value.toFixed(2)}
      </div>
    </div>
  );
}
