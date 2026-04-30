import { useState, useCallback, useRef, useEffect } from "react";
import GameHeader from "./GameHeader";
import NoteButtons from "./NoteButtons";
import MissionSuccessModal from "./MissionSuccessModal";
import CountdownTimer from "./CountdownTimer";
import CountdownOverlay from "./CountdownOverlay";
import AccidentalSwipeTutorial from "./AccidentalSwipeTutorial";
import { useAuth } from "@/contexts/AuthContext";
import { playNote, playWrong, isSamplerReady, initSound } from "@/lib/sound";
import { useNoteLogger } from "@/hooks/useNoteLogger";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";
import { useRetryQueue } from "@/hooks/useRetryQueue";
// [§0.1 DEBUG] — 출시 전 제거. PENDING_BACKLOG §0.1 cleanup.
import {
  logMarkMissed,
  logMarkJustAnswered,
  logRescheduleAfterCorrect,
  logResolveRetry,
  logPrepareNextTurn,
} from "@/lib/retryQueueDebug";
import { useUserMastery, type MasteryMap } from "@/hooks/useUserMastery";
import { getNoteWeight, weightedPickIndex } from "@/lib/noteWeighting";
import {
  SUBLEVEL_CONFIGS,
  getStagesFor,
  type Sublevel,
  type GameStageConfig,
} from "@/lib/levelSystem";
import { useLevelProgress, type RecordAttemptResult } from "@/hooks/useLevelProgress";
import {
  GrandStaffPractice,
  TOTAL_SLOTS,
  type StaffHistoryEntry,
  type BatchNoteEntry,
} from "@/components/practice/GrandStaffPractice";


type NoteType = {
  name: string;
  key: string;
  y: number;
  octave: string;
  accidental?: "#" | "b";
  clef?: "treble" | "bass";
};

// ── 조성(Key Signature) 시스템 ────────────────────────────────
const SHARP_KEYS = [
  { key: "G",  abcKey: "G",  sharps: ["F"] },
  { key: "D",  abcKey: "D",  sharps: ["F","C"] },
  { key: "A",  abcKey: "A",  sharps: ["F","C","G"] },
  { key: "E",  abcKey: "E",  sharps: ["F","C","G","D"] },
  { key: "B",  abcKey: "B",  sharps: ["F","C","G","D","A"] },
  { key: "F#", abcKey: "F#", sharps: ["F","C","G","D","A","E"] },
  { key: "C#", abcKey: "C#", sharps: ["F","C","G","D","A","E","B"] },
];

const FLAT_KEYS = [
  { key: "F",  abcKey: "F",  flats: ["B"] },
  { key: "Bb", abcKey: "Bb", flats: ["B","E"] },
  { key: "Eb", abcKey: "Eb", flats: ["B","E","A"] },
  { key: "Ab", abcKey: "Ab", flats: ["B","E","A","D"] },
  { key: "Db", abcKey: "Db", flats: ["B","E","A","D","G"] },
  { key: "Gb", abcKey: "Gb", flats: ["B","E","A","D","G","C"] },
  { key: "Cb", abcKey: "Cb", flats: ["B","E","A","D","G","C","F"] },
];

type KeySignatureType = {
  key: string;
  abcKey: string;
  sharps?: string[];
  flats?: string[];
};

function getRandomKeySignature(level: number): KeySignatureType {
  if (level === 5) return SHARP_KEYS[Math.floor(Math.random() * SHARP_KEYS.length)];
  if (level === 6) return FLAT_KEYS[Math.floor(Math.random() * FLAT_KEYS.length)];
  const allKeys = [...SHARP_KEYS, ...FLAT_KEYS];
  return allKeys[Math.floor(Math.random() * allKeys.length)];
}

// ── 기본 음표 풀 ──────────────────────────────────────────────
const TREBLE_NOTES: NoteType[] = [
  { name: "도", key: "C", y: 0, octave: "6" },
  { name: "시", key: "B", y: 0, octave: "5" },
  { name: "라", key: "A", y: 0, octave: "5" },
  { name: "솔", key: "G", y: 0, octave: "5" },
  { name: "파", key: "F", y: 0, octave: "5" },
  { name: "미", key: "E", y: 0, octave: "5" },
  { name: "레", key: "D", y: 0, octave: "5" },
  { name: "도", key: "C", y: 0, octave: "5" },
  { name: "시", key: "B", y: 0, octave: "4" },
  { name: "라", key: "A", y: 0, octave: "4" },
  { name: "솔", key: "G", y: 0, octave: "4" },
  { name: "파", key: "F", y: 0, octave: "4" },
  { name: "미", key: "E", y: 0, octave: "4" },
  { name: "레", key: "D", y: 0, octave: "4" },
  { name: "도", key: "C", y: 0, octave: "4" },
];

const BASS_NOTES: NoteType[] = [
  { name: "도", key: "C", y: 0, octave: "4" },
  { name: "시", key: "B", y: 0, octave: "3" },
  { name: "라", key: "A", y: 0, octave: "3" },
  { name: "솔", key: "G", y: 0, octave: "3" },
  { name: "파", key: "F", y: 0, octave: "3" },
  { name: "미", key: "E", y: 0, octave: "3" },
  { name: "레", key: "D", y: 0, octave: "3" },
  { name: "도", key: "C", y: 0, octave: "3" },
  { name: "시", key: "B", y: 0, octave: "2" },
  { name: "라", key: "A", y: 0, octave: "2" },
  { name: "솔", key: "G", y: 0, octave: "2" },
  { name: "파", key: "F", y: 0, octave: "2" },
  { name: "미", key: "E", y: 0, octave: "2" },
];

function buildNoteRange(startOct: number, endOct: number): NoteType[] {
  const names = ["도","레","미","파","솔","라","시"];
  const keys  = ["C","D","E","F","G","A","B"];
  const notes: NoteType[] = [];
  notes.push({ name: "도", key: "C", y: 0, octave: String(endOct) });
  for (let oct = endOct - 1; oct >= startOct; oct--) {
    for (let i = keys.length - 1; i >= 0; i--) {
      notes.push({ name: names[i], key: keys[i], y: 0, octave: String(oct) });
    }
  }
  return notes;
}

const ADV_TREBLE_NOTES = buildNoteRange(3, 7);
const ADV_BASS_NOTES   = buildNoteRange(1, 5);

const GRAND_TREBLE_NOTES = ADV_TREBLE_NOTES;
const GRAND_BASS_NOTES   = ADV_BASS_NOTES;

// simulator/테스트에서 재사용 (Lv1~4 풀)
export function getNotesForLevel(level: number): NoteType[] {
  switch (level) {
    case 1: return TREBLE_NOTES;
    case 2: return BASS_NOTES;
    case 3: return ADV_TREBLE_NOTES;
    case 4: return ADV_BASS_NOTES;
    default: return TREBLE_NOTES;
  }
}

export function getClefForLevel(level: number): "treble" | "bass" {
  if (level === 2 || level === 4) return "bass";
  return "treble";
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickBalancedCount(size: number): number {
  if (size <= 1) return 1;
  if (size >= 4) return Math.floor(Math.random() * (size - 3)) + 2;
  return Math.floor(Math.random() * (size - 1)) + 1;
}

/** §0.2: batchSize별 조표 음표 목표 비율 */
function getAccidentalRatio(batchSize: number): number {
  if (batchSize <= 1) return 0.30; // 7:3
  if (batchSize <= 3) return 0.40; // 6:4
  if (batchSize <= 5) return 0.60; // 4:6
  return 0.70;                     // 3:7 (batchSize=7)
}

export function generateKeyBatch(
  _level: number,
  size: number,
  keySig: KeySignatureType,
  masteryMap: MasteryMap = new Map(),
  lastShownNote?: NoteType | null,
): { notes: NoteType[] } {
  const accidentalLetters = new Set<string>([
    ...(keySig.sharps || []),
    ...(keySig.flats || []),
  ]);
  const hasAccidentals = accidentalLetters.size > 0;

  const getAccidental = (letter: string): "#" | "b" | undefined => {
    if (keySig.sharps?.includes(letter)) return "#";
    if (keySig.flats?.includes(letter))  return "b";
    return undefined;
  };

  // §0.2 clef 분배:
  //   batchSize=1 → set 단위 50% coin flip
  //   batchSize>1 → pickBalancedCount (1~size-1 treble 보장, 평균 50%)
  let clefSlots: Array<"treble" | "bass">;
  if (size <= 1) {
    clefSlots = [Math.random() < 0.5 ? "treble" : "bass"];
  } else {
    const trebleCount = pickBalancedCount(size);
    clefSlots = [
      ...Array(trebleCount).fill("treble"),
      ...Array(size - trebleCount).fill("bass"),
    ] as Array<"treble" | "bass">;
    shuffleArray(clefSlots);
  }

  // §0.2 조표 비율: batchSize별 목표 비율로 per-note 확률 적용 (size > 1 하드게이트 제거)
  let accSlots: boolean[];
  if (hasAccidentals) {
    const accRatio = getAccidentalRatio(size);
    accSlots = Array.from({ length: size }, () => Math.random() < accRatio);
  } else {
    accSlots = Array(size).fill(false);
  }

  const batch: NoteType[] = [];
  for (let i = 0; i < size; i++) {
    const clef = clefSlots[i];
    const wantAcc = accSlots[i];
    const basePool = clef === "treble" ? GRAND_TREBLE_NOTES : GRAND_BASS_NOTES;
    const filtered = wantAcc
      ? basePool.filter(n =>  accidentalLetters.has(n.key))
      : basePool.filter(n => !accidentalLetters.has(n.key));
    const candidates = filtered.length > 0 ? filtered : basePool;

    let picked: NoteType;
    let attempts = 0;
    do {
      const weights = candidates.map(n => {
        const acc = getAccidental(n.key);
        return getNoteWeight(masteryMap, clef, n.key, n.octave, acc);
      });
      const idx = weightedPickIndex(weights);
      picked = candidates[idx >= 0 ? idx : 0];
      attempts++;
      if (attempts > 200) break;
    } while (
      // batch 내부 인접 중복 방지
      (batch.length > 0 &&
        batch[batch.length - 1].key === picked.key &&
        batch[batch.length - 1].octave === picked.octave) ||
      // 옵션 D: cross-batch dedup — batch[0]이 직전 정답 음표와 같은 것 방지 (clef까지 일치할 때만)
      (batch.length === 0 &&
        lastShownNote != null &&
        lastShownNote.clef === clef &&
        lastShownNote.key === picked.key &&
        lastShownNote.octave === picked.octave)
    );

    const acc = getAccidental(picked.key);

    // [TEMP DEBUG] computedAcc=undefined인 모순 케이스만 출력
    const sharpsHas = keySig.sharps ? keySig.sharps.includes(picked.key) : false;
    const flatsHas = keySig.flats ? keySig.flats.includes(picked.key) : false;
    const expectedAcc = sharpsHas ? "#" : flatsHas ? "b" : undefined;
    if (acc !== expectedAcc) {
      console.log("[KEYBATCH MISMATCH]", {
        pickedKey: picked.key,
        keySigKey: keySig.key,
        sharps: keySig.sharps,
        flats: keySig.flats,
        sharpsIncludes: sharpsHas,
        flatsIncludes: flatsHas,
        getAccidentalReturned: acc,
        expectedAcc,
      });
    } else if (acc === undefined && (sharpsHas || flatsHas)) {
      console.log("[KEYBATCH BUG]", {
        pickedKey: picked.key,
        keySigKey: keySig.key,
        sharps: keySig.sharps,
        flats: keySig.flats,
      });
    }

    batch.push({
      ...picked,
      accidental: acc,
      clef,
    });
  }

  return { notes: batch };
}


export function generateBatch(
  pool: NoteType[],
  size: number,
  clef: "treble" | "bass",
  masteryMap: MasteryMap = new Map(),
  lastShownNote?: NoteType | null,
): NoteType[] {
  const batch: NoteType[] = [];
  for (let i = 0; i < size; i++) {
    let n: NoteType;
    let attempts = 0;
    do {
      const weights = pool.map(note =>
        getNoteWeight(masteryMap, clef, note.key, note.octave, note.accidental)
      );
      const idx = weightedPickIndex(weights);
      n = pool[idx >= 0 ? idx : Math.floor(Math.random() * pool.length)];
      attempts++;
      if (attempts > 200) break;
    } while (
      // batch 내부 인접 중복 방지
      (batch.length > 0 &&
        batch[batch.length - 1].key === n.key &&
        batch[batch.length - 1].octave === n.octave) ||
      // 옵션 D: cross-batch dedup — batch[0]이 직전 정답 음표와 같은 것 방지 (clef까지 일치할 때만)
      (batch.length === 0 &&
        lastShownNote != null &&
        lastShownNote.clef === clef &&
        lastShownNote.key === n.key &&
        lastShownNote.octave === n.octave)
    );
    batch.push({ ...n, clef });
  }
  return batch;
}

function getNoteAnswer(note: NoteType): string {
  return note.accidental ? `${note.key}${note.accidental}` : note.key;
}

function getSoundKey(note: NoteType): string {
  if (note.accidental === "#") return `${note.key}#${note.octave}`;
  if (note.accidental === "b") return `${note.key}b${note.octave}`;
  return `${note.key}${note.octave}`;
}

// [§0.1 DEBUG] — admin/dev에서만 retry queue 패널 노출. 출시 전 false로 원복 (또는 panel 전체 제거).
const SHOW_RETRY_DEBUG_FOR_ADMIN_OR_DEV = true;

interface NoteGameProps {
  onReset?: () => void;
  onLevelSelect?: () => void;
  onNextLevel?: () => void;
  level?: number;
  sublevel?: Sublevel;
  customNotes?: NoteType[];
  skipCountdown?: boolean;
  onAttemptRecorded?: (
    result: RecordAttemptResult & {
      level: number;
      sublevel: Sublevel;
      totalAttempts: number;
      totalCorrect: number;
      bestStreak: number;
      gameStatus: "success" | "gameover";
    }
  ) => void;
  useExternalDialogs?: boolean;
}

export default function NoteGame({
  onReset,
  onLevelSelect,
  onNextLevel,
  level = 1,
  sublevel = 1,
  customNotes,
  skipCountdown = false,
  onAttemptRecorded,
  useExternalDialogs = false,
}: NoteGameProps) {
  const sublevelConfig = SUBLEVEL_CONFIGS[sublevel];
  const MAX_LIVES      = sublevelConfig.lives;
  const TIMER_SECONDS  = sublevelConfig.timeLimit;

  const { logNote }   = useNoteLogger();
  const recorder      = useSessionRecorder();
  const retryQueue    = useRetryQueue();
  const { masteryMap } = useUserMastery();
  const { recordAttempt } = useLevelProgress();
  const { profile }   = useAuth();
  const isAdminOrDev  = profile?.role === "admin" || import.meta.env.DEV;
  const noteStartTime = useRef<number>(Date.now());
  const turnCounterRef = useRef<number>(0);
  // [§0.1 DEBUG] — 마지막 retry pop 추적 (admin/dev 패널 표시용). 출시 전 제거.
  const lastRetryPopRef = useRef<{ note: NoteType; turn: number } | null>(null);
  // §0.1 전역 dedup — 직전에 화면에 떠 있던 음표 (정답·오답 모두 갱신).
  // popDueOrNull에 전달해 같은 ID retry pop을 1턴 지연시킨다.
  const lastShownNoteRef = useRef<NoteType | null>(null);

  const totalAttemptsRef  = useRef(0);
  const totalCorrectRef   = useRef(0);
  const currentStreakRef  = useRef(0);
  const bestStreakRef     = useRef(0);
  const isCustom      = level === 0 && !!customNotes;
  const NOTES         = isCustom ? customNotes : getNotesForLevel(level);
  const needsKeySig   = level >= 5;
  const showSharps    = level === 5 || level === 7 || (isCustom && customNotes.some(n => n.accidental === "#"));
  const showFlats     = level === 6 || level === 7 || (isCustom && customNotes.some(n => n.accidental === "b"));

  const customClef = isCustom
    ? (customNotes.some(n => parseInt(n.octave) >= 4) ? "treble" as const : "bass" as const)
    : "treble" as const;

  const stages: readonly GameStageConfig[] = getStagesFor(sublevel, isCustom, level);

  const [initResult] = useState(() => {
    const firstBatchSize = stages[0].batchSize;

    if (isCustom) {
      const slice = customNotes.slice(0, Math.min(customNotes.length, firstBatchSize))
        .map(n => ({ ...n, clef: customClef }));
      return { notes: slice, keySig: { key: "C", abcKey: "C" } as KeySignatureType };
    }
    if (level >= 5) {
      const keySig = getRandomKeySignature(level);
      const result = generateKeyBatch(level, firstBatchSize, keySig, masteryMap);
      return { notes: result.notes, keySig };
    }
    const lvClef = getClefForLevel(level);
    return {
      notes: generateBatch(NOTES, firstBatchSize, lvClef, masteryMap),
      keySig: { key: "C", abcKey: "C" } as KeySignatureType,
    };
  });

  const [batchAndKey, setBatchAndKey] = useState<{
    batch: NoteType[];
    keySig: KeySignatureType;
  }>({ batch: initResult.notes, keySig: initResult.keySig });

  const currentBatch        = batchAndKey.batch;
  const currentKeySignature = batchAndKey.keySig;

  const [currentIndex,        setCurrentIndex]        = useState(0);
  const [lives,               setLives]               = useState(MAX_LIVES);
  const [phase,               setPhase]               = useState<"playing" | "gameover" | "success">("playing");
  const [disabledNotes,       setDisabledNotes]       = useState<Set<string>>(new Set());
  const [timerKey,            setTimerKey]            = useState(0);
  const [individualStreak,    setIndividualStreak]    = useState(0);
  const [lifeRecovered,       setLifeRecovered]       = useState(false);
  const [answeredNotes,       setAnsweredNotes]       = useState<StaffHistoryEntry[]>([]);
  const [score,               setScore]               = useState(0);
  const [sessionResult, setSessionResult] = useState<Awaited<ReturnType<typeof recorder.endSession>>>(null);

  const [stageIdx,   setStageIdx]   = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [setProgress,setSetProgress]= useState(0);

  const [retryOverride, setRetryOverride] = useState<NoteType | null>(null);

  const currentStageConfig = stages[stageIdx];
  const isBatchDisplay = currentStageConfig.batchSize > 1;

  const currentTarget = retryOverride ?? currentBatch[currentIndex] ?? null;

  const currentClef: "treble" | "bass" =
    currentTarget?.clef ??
    (isCustom ? customClef : getClefForLevel(level));

  const targetNoteStr    = currentTarget ? `${currentTarget.key}${currentTarget.octave}` : null;
  const targetAccidental = currentTarget?.accidental ?? null;

  // [TEMP DEBUG] 매 렌더마다 batch ↔ keySig 정합성 캡처
  if (level >= 5 && currentBatch.length > 0) {
    const keyLetters = new Set([
      ...(currentKeySignature.sharps || []),
      ...(currentKeySignature.flats || []),
    ]);
    for (const note of currentBatch) {
      if (keyLetters.has(note.key) && note.accidental === undefined) {
        console.log("[RENDER MISMATCH]", {
          renderTime: Date.now(),
          batchNotes: currentBatch.map(n => `${n.key}${n.octave}${n.accidental ?? ""}`),
          keySigKey: currentKeySignature.key,
          sharps: currentKeySignature.sharps,
          flats: currentKeySignature.flats,
          stageIdx,
          currentSet,
          turnCounter: turnCounterRef.current,
        });
        break;
      }
    }
  }



  const batchNotesForDisplay: BatchNoteEntry[] | undefined =
    isBatchDisplay && !retryOverride
      ? currentBatch.map(n => ({
          note: `${n.key}${n.octave}`,
          accidental: n.accidental,
          clef: n.clef,
        }))
      : undefined;

  const stageLabel = `Stage ${currentStageConfig.stage}: ${
    currentStageConfig.batchSize === 1
      ? `음표 ${currentStageConfig.notesPerSet}개 순차`
      : `음표 ${currentStageConfig.batchSize}개 동시`
  } (${currentSet}/${currentStageConfig.totalSets} 세트)`;

  useEffect(() => {
    const sessionType: "regular" | "custom_score" = isCustom ? "custom_score" : "regular";
    recorder.startSession(level, sessionType);
    turnCounterRef.current = 0;
    lastShownNoteRef.current = null;
    retryQueue.reset();
    return () => {
      if (recorder.isRecording) {
        recorder.cancelSession();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "success" || phase === "gameover") {
      const reason     = phase === "success" ? "completed" : "gameover";
      const gameStatus: "success" | "gameover" = phase === "success" ? "success" : "gameover";

      recorder.endSession(reason).then((result) => {
        if (result) setSessionResult(result);
      });

      recordAttempt(
        level,
        sublevel,
        totalAttemptsRef.current,
        totalCorrectRef.current,
        bestStreakRef.current,
        gameStatus,
      ).then((result) => {
        if (result) {
          onAttemptRecorded?.({
            ...result,
            level,
            sublevel,
            totalAttempts: totalAttemptsRef.current,
            totalCorrect: totalCorrectRef.current,
            bestStreak: bestStreakRef.current,
            gameStatus,
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

// [TEMP DEBUG] keySig + currentBatch 일관성 체크
useEffect(() => {
  if (level >= 5 && currentBatch.length > 0) {
    const keyLetters = new Set([
      ...(currentKeySignature.sharps || []),
      ...(currentKeySignature.flats || []),
    ]);
    for (const note of currentBatch) {
      const letterInKey = keyLetters.has(note.key);
      if (letterInKey && note.accidental === undefined) {
        console.log("[INCONSISTENCY]", {
          note: `${note.key}${note.octave}`,
          accidental: note.accidental,
          keySigKey: currentKeySignature.key,
          keySharps: currentKeySignature.sharps,
          keyFlats: currentKeySignature.flats,
        });
      }
    }
  }
}, [currentBatch, currentKeySignature, level]);

  // forceNewKeySig=true이면 Lv5+에서 새 keySig 생성 (stage 전환·리플레이 시).
  // false(기본)면 currentKeySignature 재사용 → 같은 stage 안에서 키사인 고정 유지.
  // lastShownNote: 직전 화면에 떠 있던 음표 — 새 batch[0]이 이것과 같은 음표가 되지 않도록 회피 (옵션 D).
  const generateNewBatch = useCallback((
    batchSize: number,
    forceNewKeySig: boolean = false,
    lastShownNote?: NoteType | null,
  ): {
    batch: NoteType[];
    keySig: KeySignatureType;
  } => {
    if (isCustom) {
      return {
        batch: generateBatch(customNotes, batchSize, customClef, masteryMap, lastShownNote),
        keySig: currentKeySignature,
      };
    }
    if (level >= 5) {
      const keySig = forceNewKeySig ? getRandomKeySignature(level) : currentKeySignature;
      return {
        batch: generateKeyBatch(level, batchSize, keySig, masteryMap, lastShownNote).notes,
        keySig,
      };
    }
    const lvClef = getClefForLevel(level);
    return {
      batch: generateBatch(NOTES, batchSize, lvClef, masteryMap, lastShownNote),
      keySig: { key: "C", abcKey: "C" } as KeySignatureType,
    };
  }, [NOTES, isCustom, customNotes, level, customClef, masteryMap, currentKeySignature]);

  const prepareNextTurn = useCallback((lastShownNote?: NoteType | null) => {
    turnCounterRef.current += 1;
    // [§0.1 DEBUG] — pop 직전 queue size 캡처
    const qsizeBefore = retryQueue.size;
    // §0.1 전역 dedup: lastShownNote 인자 우선, 없으면 ref 폴백 (handleAnswer에서 갱신됨).
    const lastShown = lastShownNote ?? lastShownNoteRef.current;
    const lastShownKey = lastShown
      ? {
          key: lastShown.key,
          octave: lastShown.octave,
          accidental: lastShown.accidental,
          clef: lastShown.clef ?? (isCustom ? customClef : getClefForLevel(level)),
        }
      : null;
    const due = retryQueue.popDueOrNull(turnCounterRef.current, lastShownKey);
    if (due) {
      const retryNote: NoteType = {
        name: due.key,
        key: due.key,
        y: 0,
        octave: due.octave,
        accidental: due.accidental,
        clef: due.clef,
      };
      setRetryOverride(retryNote);
      // [§0.1 DEBUG]
      logPrepareNextTurn(turnCounterRef.current, qsizeBefore, due, retryNote, null);
      // [§0.1 DEBUG] — 마지막 pop 추적
      lastRetryPopRef.current = { note: retryNote, turn: turnCounterRef.current };
      return retryNote;
    }
    setRetryOverride(null);
    // [§0.1 DEBUG] — fallback은 caller가 결정하므로 displayed=null로 로깅
    logPrepareNextTurn(turnCounterRef.current, qsizeBefore, null, null, null);
    return null;
  }, [retryQueue, isCustom, customClef, level]);

  const handleSetComplete = useCallback((
    currentStageIdx: number,
    currentSetNum: number,
    lastShownNote?: NoteType | null,
  ) => {
    const stagesRef = stages;
    const stageConfig = stagesRef[currentStageIdx];

    if (currentSetNum >= stageConfig.totalSets) {
      const nextStageIdx = currentStageIdx + 1;
      if (nextStageIdx >= stagesRef.length) {
        setPhase("success");
        return;
      }
      const nextStage = stagesRef[nextStageIdx];
      setStageIdx(nextStageIdx);
      setCurrentSet(1);
      setSetProgress(0);
      setAnsweredNotes([]);

      // §0-1.6: Lv5+에서 미답 retry ≥2이면 다음 stage도 같은 조표 유지
      const keepKeySig = level >= 5 && retryQueue.size >= 2;
      const result = generateNewBatch(nextStage.batchSize, !keepKeySig, lastShownNote);
      setBatchAndKey(result);
      const notes = result.batch;
      setCurrentIndex(0);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);

      // 조표가 바뀌면 이전 retry는 의미 없음 → 큐 초기화 (Lv5+)
      if (level >= 5 && !keepKeySig) {
        retryQueue.reset();
      }

      const retryNote = prepareNextTurn(lastShownNote);
      const toPlay = retryNote ?? notes[0];
      playNote(getSoundKey(toPlay));
    } else {
      const nextSet = currentSetNum + 1;
      setCurrentSet(nextSet);
      setSetProgress(0);
      setAnsweredNotes([]);

      const result = generateNewBatch(stageConfig.batchSize, false, lastShownNote);
      setBatchAndKey(result);
      const notes = result.batch;
      setCurrentIndex(0);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);

      // 같은 stage 내 set 전환은 retry queue 유지 (사용자 지시).
      const retryNote = prepareNextTurn(lastShownNote);
      const toPlay = retryNote ?? notes[0];
      playNote(getSoundKey(toPlay));
    }
  }, [generateNewBatch, stages, prepareNextTurn, level, retryQueue]);

  const advanceToNextTurn = useCallback((wasRetry: boolean) => {
    const stagesRef = stages;
    const stageConfig = stagesRef[stageIdx];

    if (wasRetry) {
      // wasRetry: 직전 표시 = retryOverride 음표 (lastShownNoteRef에서 가져옴).
      // markJustAnswered가 이미 그 ID skip하므로 이중 안전장치.
      const retryNote = prepareNextTurn(lastShownNoteRef.current);
      if (retryNote) {
        playNote(getSoundKey(retryNote));
      } else if (currentBatch[currentIndex]) {
        playNote(getSoundKey(currentBatch[currentIndex]));
      }
      return;
    }

    const nextIndex = currentIndex + 1;
    // 옵션 D: 직전에 화면에 떠 있던 음표 (cross-batch dedup용)
    const lastShownNote = currentBatch[currentIndex] ?? null;

    if (nextIndex >= currentBatch.length) {
      const newProgress = setProgress + currentBatch.length;

      if (newProgress >= stageConfig.notesPerSet) {
        handleSetComplete(stageIdx, currentSet, lastShownNote);
      } else {
        setSetProgress(newProgress);
        const result = generateNewBatch(stageConfig.batchSize, false, lastShownNote);
        setBatchAndKey(result);
        const notes = result.batch;
        setCurrentIndex(0);
        setDisabledNotes(new Set());
        setTimerKey(prev => prev + 1);
        noteStartTime.current = Date.now();

        // 같은 set 안 batch 갈이는 retry queue 유지 (사용자 지시).
        const retryNote = prepareNextTurn(lastShownNote);
        const toPlay = retryNote ?? notes[0];
        playNote(getSoundKey(toPlay));
      }
    } else {
      setCurrentIndex(nextIndex);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);
      noteStartTime.current = Date.now();

      const retryNote = prepareNextTurn(lastShownNote);
      const toPlay = retryNote ?? currentBatch[nextIndex];
      playNote(getSoundKey(toPlay));
    }
  }, [stages, stageIdx, currentIndex, currentBatch, setProgress, currentSet, generateNewBatch, handleSetComplete, prepareNextTurn, level, retryQueue]);
  
  const [showCountdown, setShowCountdown] = useState(!skipCountdown);

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    if (currentBatch.length > 0) {
      if (isSamplerReady()) {
        playNote(getSoundKey(currentBatch[0]));
      } else {
        initSound().then(() => {
          playNote(getSoundKey(currentBatch[0]));
        });
      }
    }
    noteStartTime.current = Date.now();
  }, [currentBatch]);

  const handleAnswer = useCallback((answer: string) => {
    if (phase !== "playing" || !currentTarget) return;

    // §0.1 전역 dedup: 직전 표시 음표 추적 (정답·오답 모두 갱신).
    // popDueOrNull에 전달되어 같은 ID retry pop을 1턴 지연시킨다.
    lastShownNoteRef.current = currentTarget;

    const correctAnswer = getNoteAnswer(currentTarget);
    const responseTimeMs = Date.now() - noteStartTime.current;
    const responseTime   = +(responseTimeMs / 1000).toFixed(2);
    const clefForLog = currentTarget.clef ?? (isCustom ? customClef : getClefForLevel(level));
    const wasRetry = retryOverride !== null;

    const retryKey = {
      key: currentTarget.key,
      octave: currentTarget.octave,
      accidental: currentTarget.accidental,
      clef: clefForLog,
    };

    if (answer === correctAnswer) {
      setAnsweredNotes(prev => [
        ...prev.slice(-(TOTAL_SLOTS - 2)),
        {
          id: Date.now(),
          note: `${currentTarget.key}${currentTarget.octave}`,
          accidental: currentTarget.accidental,
          clef: clefForLog,
        },
      ]);

      logNote({
        note_key: correctAnswer,
        octave: parseInt(currentTarget.octave),
        clef: clefForLog,
        is_correct: true,
        response_time: responseTime,
        error_type: null,
        level,
      });

      recorder.recordNote({
        note: `${currentTarget.key}${currentTarget.octave}`,
        correct: true,
        reactionMs: responseTimeMs,
        clef: clefForLog,
        accidental: currentTarget.accidental === "#" ? "sharp"
                  : currentTarget.accidental === "b" ? "flat"
                  : null,
      });

      setScore(prev => prev + 1);

      totalAttemptsRef.current += 1;
      totalCorrectRef.current  += 1;
      currentStreakRef.current += 1;
      if (currentStreakRef.current > bestStreakRef.current) {
        bestStreakRef.current = currentStreakRef.current;
      }

      const newStreak = individualStreak + 1;
      setIndividualStreak(newStreak);
      if (newStreak >= 3) {
        if (lives < MAX_LIVES) {
          setLives(prev => Math.min(prev + 1, MAX_LIVES));
          setLifeRecovered(true);
          setTimeout(() => setLifeRecovered(false), 1500);
        }
        setIndividualStreak(0);
      }

      // 신규 정책: 재출제(wasRetry) 정답 → 영구 제거 (12=P).
      // 일반 정답 → 진행 후 큐 마커 있던 경우만 N+2 후 재출제로 갱신 (11=X, 마커 없으면 no-op).
      // 옵션 B: advance 직전에 markJustAnswered → 그 안의 popDueOrNull(N+1)이 같은 음표를 안 뽑음.
      retryQueue.markJustAnswered(retryKey, turnCounterRef.current);
      logMarkJustAnswered(turnCounterRef.current, retryKey); // [§0.1 DEBUG]
      if (wasRetry) {
        retryQueue.resolve(retryKey);
        logResolveRetry(turnCounterRef.current, retryKey); // [§0.1 DEBUG]
        // §0.1 사각지대: retry 답한 음표가 currentBatch[currentIndex]와 같으면
        // 그 batch 음표는 이미 retry로 답한 셈 → 일반 advance로 진행 (batch 1음표 자동 통과).
        // 이렇게 하지 않으면 retry 직후 같은 음표가 또 화면에 떠 사용자가 같은 음표 두 번 본다.
        const cur = currentBatch[currentIndex];
        const sameAsBatchCurrent =
          cur != null &&
          cur.key === retryKey.key &&
          cur.octave === retryKey.octave &&
          (cur.accidental ?? null) === (retryKey.accidental ?? null) &&
          (cur.clef ?? clefForLog) === retryKey.clef;
        advanceToNextTurn(sameAsBatchCurrent ? false : true);
      } else {
        // §0.1 N+2 정책: due = 정답turn + 2가 되도록 advance 전에 reschedule.
        // 순서가 반대면 advance 안에서 turnCounterRef +1 → due = (정답turn+1)+2 = N+3 발생.
        retryQueue.rescheduleAfterCorrect(retryKey, turnCounterRef.current);
        // [§0.1 DEBUG] — rescheduleAfterCorrect의 결과 due 값을 snapshot에서 찾기
        {
          const updated = retryQueue.snapshot.find((e) => e.id === `${retryKey.clef}:${retryKey.key}${retryKey.accidental ?? ""}${retryKey.octave}`);
          if (updated) {
            logRescheduleAfterCorrect(turnCounterRef.current, retryKey, updated.scheduledAtTurn, retryQueue.snapshot);
          }
        }
        advanceToNextTurn(false);
      }
    } else {
      logNote({
        note_key: getNoteAnswer(currentTarget),
        octave: parseInt(currentTarget.octave),
        clef: clefForLog,
        is_correct: false,
        response_time: responseTime,
        error_type: "wrong_button",
        level,
      });

      recorder.recordNote({
        note: `${currentTarget.key}${currentTarget.octave}`,
        correct: false,
        reactionMs: responseTimeMs,
        clef: clefForLog,
        accidental: currentTarget.accidental === "#" ? "sharp"
                  : currentTarget.accidental === "b" ? "flat"
                  : null,
      });

      // 신규 정책: 오답 시 같은 자리 유지 (currentIndex/turn 변동 X).
      // 큐에는 마커만 등록 (해석 10=A, due=MAX → 정답 시 갱신).
      retryQueue.markMissed(retryKey);
      logMarkMissed(turnCounterRef.current, retryKey, retryQueue.snapshot); // [§0.1 DEBUG]

      playWrong();
      setIndividualStreak(0);

      totalAttemptsRef.current += 1;
      currentStreakRef.current = 0;

      const newLives = lives - 1;
      setLives(newLives);

      if (newLives <= 0) {
        setPhase("gameover");
        return;
      }

      // 같은 자리 유지하되 사용자가 다시 풀 시간을 줘야 하므로 타이머만 리셋.
      setTimerKey(prev => prev + 1);
      noteStartTime.current = Date.now();
    }
  }, [phase, currentTarget, retryOverride, lives, individualStreak, logNote, recorder, level, isCustom, customClef, retryQueue, advanceToNextTurn]);

  const handleTimerExpire = useCallback(() => {
    if (phase !== "playing" || !currentTarget) return;
    // §0.1 전역 dedup: 타이머 만료도 직전 표시 음표 갱신 (오답과 동일 처리).
    lastShownNoteRef.current = currentTarget;
    const clefForLog = currentTarget.clef ?? (isCustom ? customClef : getClefForLevel(level));

    logNote({
      note_key: getNoteAnswer(currentTarget),
      octave: parseInt(currentTarget.octave),
      clef: clefForLog,
      is_correct: false,
      response_time: TIMER_SECONDS,
      error_type: "timeout",
      level,
    });

    recorder.recordNote({
      note: `${currentTarget.key}${currentTarget.octave}`,
      correct: false,
      reactionMs: TIMER_SECONDS * 1000,
      clef: clefForLog,
      accidental: currentTarget.accidental === "#" ? "sharp"
                : currentTarget.accidental === "b" ? "flat"
                : null,
    });

    // 신규 정책: 타이머 만료 = 오답과 동일 처리. 같은 자리 유지 + 마커 등록.
    {
      const timeoutKey = {
        key: currentTarget.key,
        octave: currentTarget.octave,
        accidental: currentTarget.accidental,
        clef: clefForLog,
      };
      retryQueue.markMissed(timeoutKey);
      logMarkMissed(turnCounterRef.current, timeoutKey, retryQueue.snapshot); // [§0.1 DEBUG] (timeout)
    }

    playWrong();
    setIndividualStreak(0);

    totalAttemptsRef.current += 1;
    currentStreakRef.current = 0;

    const newLives = lives - 1;
    setLives(newLives);

    if (newLives <= 0) {
      setPhase("gameover");
      return;
    }

    // 타이머만 리셋해서 사용자가 같은 음표를 다시 풀 시간 확보.
    setTimerKey(prev => prev + 1);
    noteStartTime.current = Date.now();
  }, [phase, lives, currentTarget, logNote, recorder, level, isCustom, customClef, retryQueue]);

  const handleReplay = () => {
    setLives(MAX_LIVES);
    setPhase("playing");
    setDisabledNotes(new Set());
    setCurrentIndex(0);
    setTimerKey(prev => prev + 1);
    setIndividualStreak(0);
    setLifeRecovered(false);
    setAnsweredNotes([]);
    setScore(0);
    setStageIdx(0);
    setCurrentSet(1);
    setSetProgress(0);
    setSessionResult(null);
    setRetryOverride(null);

    retryQueue.reset();
    turnCounterRef.current  = 0;
    lastShownNoteRef.current = null;
    totalAttemptsRef.current = 0;
    totalCorrectRef.current  = 0;
    currentStreakRef.current = 0;
    bestStreakRef.current    = 0;

    const sessionType: "regular" | "custom_score" = isCustom ? "custom_score" : "regular";
    recorder.startSession(level, sessionType);

    const firstStage = stages[0];
    // 리플레이는 새 게임 시작이므로 Lv5+ 새 keySig 생성
    const result = generateNewBatch(firstStage.batchSize, true);
    setBatchAndKey(result);
    const notes = result.batch;

    setShowCountdown(!skipCountdown);
    if (skipCountdown) {
      if (isSamplerReady()) {
        playNote(getSoundKey(notes[0]));
      }
      noteStartTime.current = Date.now();
    }
  };

  if (phase === "gameover") {
    if (useExternalDialogs) {
      return <div className="flex flex-col items-center gap-6 animate-fade-up" aria-label="game over" />;
    }
    return (
      <div className="flex flex-col items-center gap-6 animate-fade-up">
        <div className="text-6xl">🎹</div>
        <h2 className="text-2xl font-bold text-foreground">게임 오버</h2>
        <p className="text-lg text-muted-foreground">
          정답 수: <span className="font-bold text-foreground tabular-nums">{score}</span>
        </p>
        {sessionResult && (
          <p className="text-sm text-primary font-semibold">
            +{sessionResult.xpEarned} XP 획득!
          </p>
        )}
        <p className="text-muted-foreground">다시 도전해 주세요!</p>
        <button
          onClick={onReset}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
        >
          메인으로 돌아가기 🔥
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full animate-fade-up">

      {showCountdown && (
        <CountdownOverlay seconds={3} onComplete={handleCountdownComplete} />
      )}

      <AccidentalSwipeTutorial level={level} triggerOpen={!showCountdown} />

      <span className="sr-only">
        현재 정답: {targetNoteStr ?? "(없음)"}
        {targetAccidental ? ` ${targetAccidental}` : ""}
      </span>


      <div className="w-full max-w-[490px] flex flex-col gap-3">

        {onLevelSelect && (
          <div className="w-full flex justify-start">
            <button
              onClick={onLevelSelect}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              ← 레벨 선택
            </button>
          </div>
        )}

        {isAdminOrDev && currentTarget && (
          <div className="w-full flex justify-center mt-1">
            <div className="px-4 py-1.5 rounded-lg bg-yellow-100 border border-yellow-300 text-yellow-900 text-sm font-mono font-bold shadow-sm">
              💡 정답: {getNoteAnswer(currentTarget)}
              {/* [§0.1 DEBUG] — turn/queue 요약 인라인 표시. 출시 전 제거. */}
              <span className="ml-3 text-xs font-sans font-normal text-yellow-800">
                · turn {turnCounterRef.current} · queue {retryQueue.size}
                {lastRetryPopRef.current && (
                  <> · last retry: {lastRetryPopRef.current.note.key}{lastRetryPopRef.current.note.accidental ?? ""}{lastRetryPopRef.current.note.octave} @ turn {lastRetryPopRef.current.turn}</>
                )}
              </span>
              <span className="ml-2 text-xs font-sans font-normal text-yellow-700">
                (admin/dev only)
              </span>
            </div>
          </div>
        )}

        <div className="w-full">
          <GameHeader
            score={score}
            lives={lives}
            maxLives={MAX_LIVES}
            level={level}
            perfectStreak={individualStreak}
            streakTarget={3}
            lifeRecovered={lifeRecovered}
          />
        </div>

        <div className="w-full flex items-center justify-center gap-3 mt-1">
          <span className="text-sm font-medium text-muted-foreground">{stageLabel}</span>
        </div>

        <div className="w-full">
          <CountdownTimer
            duration={TIMER_SECONDS}
            resetKey={timerKey}
            onExpire={handleTimerExpire}
            paused={phase !== "playing" || showCountdown}
          />
        </div>

        <div className="w-full max-w-[490px] mx-auto">
          <GrandStaffPractice
            targetNote={targetNoteStr}
            targetAccidental={targetAccidental}
            noteHistory={answeredNotes}
            batchNotes={batchNotesForDisplay}
            batchIndex={isBatchDisplay ? currentIndex : undefined}
            clef={currentClef}
            level={level}
            keySignature={currentKeySignature.abcKey}
            keySharps={needsKeySig ? currentKeySignature.sharps : undefined}
            keyFlats={needsKeySig ? currentKeySignature.flats : undefined}
          />
        </div>

        <div className="w-full mt-1">
          <p className="text-center text-sm text-muted-foreground mb-3">
            {isBatchDisplay
              ? `${currentIndex + 1}/${currentBatch.length}번째 음표의 이름은?`
              : `${currentIndex + 1}번째 음표의 이름은?`}
          </p>

          {(() => {
            if (level >= 5 && currentBatch.length > 0 && currentTarget) {
              const sharpsToButton = needsKeySig ? currentKeySignature.sharps : undefined;
              const flatsToButton = needsKeySig ? currentKeySignature.flats : undefined;
              const keyLetters = new Set([
                ...(sharpsToButton || []),
                ...(flatsToButton || []),
              ]);
              if (keyLetters.has(currentTarget.key) && currentTarget.accidental === undefined) {
                console.log("[BUTTON-NOTE MISMATCH]", {
                  noteKey: currentTarget.key,
                  noteAccidental: currentTarget.accidental,
                  buttonSharps: sharpsToButton,
                  buttonFlats: flatsToButton,
                  batchAndKeySigKey: currentKeySignature.key,
                  batchNotes: currentBatch.map(n => `${n.key}${n.octave}${n.accidental ?? ""}`),
                });
              }
            }
            return null;
          })()}

          <NoteButtons
            onNoteClick={handleAnswer}
            disabled={phase !== "playing" || showCountdown}
            disabledNotes={disabledNotes}
            keySharps={needsKeySig ? currentKeySignature.sharps : undefined}
            keyFlats={needsKeySig ? currentKeySignature.flats : undefined}
            swipeEnabled={level >= 5}
          />
        </div>

      </div>

      <button
        onClick={() => { if (currentTarget) playNote(getSoundKey(currentTarget)); }}
        disabled={phase !== "playing"}
        className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 active:scale-95 disabled:opacity-40"
      >
        🔊 다시 듣기
      </button>

      <span className="sr-only">
        turn: {turnCounterRef.current} · size: {retryQueue.size}
      </span>

      {SHOW_RETRY_DEBUG_FOR_ADMIN_OR_DEV && isAdminOrDev && (
        <div className="mt-4 w-full max-w-[490px] rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-amber-700">
              🔧 Retry Queue 디버그
            </span>
          </div>
          {retryQueue.snapshot.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">(비어있음)</p>
          ) : (
            <ul className="space-y-0.5">
              {retryQueue.snapshot.map((e) => (
                <li key={e.id} className="text-[10px] font-mono">
                  <span className="text-amber-700">{e.id}</span>
                  <span className="text-muted-foreground">
                    {" "}· miss×{e.missCount} · due@turn {e.scheduledAtTurn}
                    {e.scheduledAtTurn <= turnCounterRef.current ? (
                      <span className="ml-1 text-red-600 font-bold">DUE</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <MissionSuccessModal
        open={phase === "success" && !useExternalDialogs}
        score={score}
        onNextLevel={
          level >= 7 || !onNextLevel
            ? undefined
            : () => onNextLevel()
        }
        onReplay={handleReplay}
        onLevelSelect={onLevelSelect}
        isFinalLevel={level >= 7}
      />

      {import.meta.env.DEV && currentTarget && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={() => alert(`정답: ${getNoteAnswer(currentTarget)}`)}
            className="px-3 py-1 bg-yellow-200 text-yellow-900 text-xs rounded shadow"
            aria-label="dev-hint"
          >
            💡 정답 보기 (DEV)
          </button>
        </div>
      )}
    </div>
  );
}