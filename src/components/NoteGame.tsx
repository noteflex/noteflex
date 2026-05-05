import { useState, useCallback, useRef, useEffect } from "react";
import GameHeader from "./GameHeader";
import NoteButtons from "./NoteButtons";
import MissionSuccessModal from "./MissionSuccessModal";
import CountdownTimer from "./CountdownTimer";
import CountdownOverlay from "./CountdownOverlay";
import AccidentalSwipeTutorial, {
  hasSeenSwipeTutorial,
  markSwipeTutorialSeen,
} from "./AccidentalSwipeTutorial";
import CalibrationModal from "./CalibrationModal";
import { useUserEnvOffset } from "@/hooks/useUserEnvOffset";
import { useAuth } from "@/contexts/AuthContext";
import { playNote, playWrong, isSamplerReady, initSound, ensureAudioReady } from "@/lib/sound";
import { useNoteLogger } from "@/hooks/useNoteLogger";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";
import { useRetryQueue } from "@/hooks/useRetryQueue";
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
  const {
    needsCalibration,
    isLoading: calibrationLoading,
    canSkip: calibrationCanSkip,
    setOffset: setCalibrationOffset,
    skipCalibration,
  } = useUserEnvOffset();
  const isAdminOrDev  = profile?.role === "admin" || import.meta.env.DEV;
  const noteStartTime = useRef<number>(performance.now());
  const turnCounterRef = useRef<number>(0);
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
    /** §4 (2026-05-01): batch[0..retryCount-1]은 retry 큐에서 pop된 음표. */
    retryCount: number;
  }>({ batch: initResult.notes, keySig: initResult.keySig, retryCount: 0 });

  const currentBatch        = batchAndKey.batch;
  const currentKeySignature = batchAndKey.keySig;

  const [currentIndex,        setCurrentIndex]        = useState(0);
  const [lives,               setLives]               = useState(MAX_LIVES);
  const [phase,               setPhase]               = useState<"playing" | "final-retry" | "gameover" | "success">("playing");
  /**
   * §4 (2026-05-01) — sublevel 전체에서 끝까지 못 푼 음표.
   * markMissed 호출 시마다 추가 (중복 자동 제거 — Map by composeId).
   * retry 정답 시 제거 (학습 완료, 옵션 2).
   * 모든 stage 끝났을 때 size > 0 이면 final-retry phase 진입.
   */
  const [missedNotes, setMissedNotes] = useState<Map<string, NoteType>>(new Map());
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

  // §4 (2026-05-01): retryOverride state 제거 — retry 음표가 batch 안에 통합됨.
  // wasRetry 판단은 currentIndex < batchAndKey.retryCount.

  const currentStageConfig = stages[stageIdx];
  // §4: final-retry phase도 batch mode (batchSize 동적 3·5·7).
  // currentBatch 길이 기준으로 판단 — final-retry는 currentStageConfig 무관.
  const isBatchDisplay = phase === "final-retry"
    ? currentBatch.length > 1
    : currentStageConfig.batchSize > 1;

  const currentTarget = currentBatch[currentIndex] ?? null;

  // §4: missedNotes 헬퍼.
  const missedNoteIdOf = useCallback((note: NoteType, clefForLog: "treble" | "bass"): string => {
    const acc = note.accidental ?? "";
    const c = note.clef ?? clefForLog;
    return `${c}:${note.key}${acc}${note.octave}`;
  }, []);

  const addMissedNote = useCallback((note: NoteType, clefForLog: "treble" | "bass") => {
    const id = missedNoteIdOf(note, clefForLog);
    setMissedNotes(prev => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, { ...note, clef: note.clef ?? clefForLog });
      return next;
    });
  }, [missedNoteIdOf]);

  const removeMissedNote = useCallback((note: NoteType, clefForLog: "treble" | "bass") => {
    const id = missedNoteIdOf(note, clefForLog);
    setMissedNotes(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, [missedNoteIdOf]);

  const currentClef: "treble" | "bass" =
    currentTarget?.clef ??
    (isCustom ? customClef : getClefForLevel(level));

  const targetNoteStr    = currentTarget ? `${currentTarget.key}${currentTarget.octave}` : null;
  const targetAccidental = currentTarget?.accidental ?? null;

  const batchNotesForDisplay: BatchNoteEntry[] | undefined =
    isBatchDisplay
      ? currentBatch.map(n => ({
          note: `${n.key}${n.octave}`,
          accidental: n.accidental,
          clef: n.clef,
        }))
      : undefined;

  const stageLabel = phase === "final-retry"
    ? `마무리 단계 — ${missedNotes.size}개 남음`
    : `Stage ${currentStageConfig.stage}: ${
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

  // §1 (2026-05-01): mount 시 sampler 백그라운드 로딩 + audio context 활성화.
  // 카운트다운 3초 동안 로딩 → handleCountdownComplete 시점엔 거의 항상 준비 완료.
  useEffect(() => {
    if (!isSamplerReady()) {
      initSound().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[§1] initSound failed:", err);
      });
    }
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
        // 비로그인 시 result=null — fake payload 박음 (DB unlock X, 모달 노출 영역 보장).
        // just_passed=false 고정 → AdInterstitial 박지 X (메모리 #1 일관).
        const payload: RecordAttemptResult = result ?? {
          level,
          sublevel,
          play_count: 0,
          total_attempts: totalAttemptsRef.current,
          total_correct: totalCorrectRef.current,
          accuracy:
            totalAttemptsRef.current > 0
              ? totalCorrectRef.current / totalAttemptsRef.current
              : 0,
          best_streak: bestStreakRef.current,
          passed: gameStatus === "success",
          just_passed: false,
        };
        onAttemptRecorded?.({
          ...payload,
          level,
          sublevel,
          totalAttempts: totalAttemptsRef.current,
          totalCorrect: totalCorrectRef.current,
          bestStreak: bestStreakRef.current,
          gameStatus,
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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

  /**
   * §4 (2026-05-01) — final-retry phase 배치 크기 동적 결정.
   *  - missedCount 1~2 → batchSize 3
   *  - missedCount 3~4 → batchSize 5
   *  - missedCount 5+  → batchSize 7
   */
  const getFinalRetryBatchSize = useCallback((missedCount: number): number => {
    if (missedCount <= 2) return 3;
    if (missedCount <= 4) return 5;
    return 7;
  }, []);

  /**
   * §4 (2026-05-01) — Batch 구성 공식:
   *   (stage batchSize) - (retry 큐 pop 수) = 새 음표 수
   *
   * 1. retry 큐에서 due 도달한 음표 pop (max batchSize까지, §0.1 인접 dedup 적용)
   * 2. 부족분 = batchSize - retryNotes.length, 새 음표 generateNewBatch
   * 3. batch = [retry 음표..., 새 음표...] 합성
   * 4. retryCount = retry 음표 개수 → handleAnswer wasRetry 판단에 사용
   */
  const composeBatch = useCallback((
    batchSize: number,
    forceNewKeySig: boolean = false,
    lastShownNote?: NoteType | null,
  ): {
    batch: NoteType[];
    keySig: KeySignatureType;
    retryCount: number;
  } => {
    const retryNotes: NoteType[] = [];
    let prev: NoteType | null = lastShownNote ?? null;

    while (retryNotes.length < batchSize) {
      const lastShownKey = prev
        ? {
            key: prev.key,
            octave: prev.octave,
            accidental: prev.accidental,
            clef: prev.clef ?? (isCustom ? customClef : getClefForLevel(level)),
          }
        : null;
      const due = retryQueue.popDueOrNull(turnCounterRef.current, lastShownKey);
      if (!due) break;
      const retryNote: NoteType = {
        name: due.key,
        key: due.key,
        y: 0,
        octave: due.octave,
        accidental: due.accidental,
        clef: due.clef,
      };
      retryNotes.push(retryNote);
      prev = retryNote;
    }

    const newCount = batchSize - retryNotes.length;
    if (newCount === 0) {
      // batch 전체가 retry — keySig은 현재 유지.
      return { batch: retryNotes, keySig: currentKeySignature, retryCount: retryNotes.length };
    }

    const newResult = generateNewBatch(newCount, forceNewKeySig, prev);
    return {
      batch: [...retryNotes, ...newResult.batch],
      keySig: newResult.keySig,
      retryCount: retryNotes.length,
    };
  }, [generateNewBatch, retryQueue, isCustom, customClef, level, currentKeySignature]);

  /**
   * §4 (2026-05-01) — final-retry phase batch 구성:
   *  1. missedNotes Map에서 가능한 만큼 retry 음표 가져옴 (max getFinalRetryBatchSize)
   *  2. 부족분 = batchSize - retryCount, 새 음표 generateNewBatch (학습 보조)
   *  3. retry 음표 idx<retryCount, 새 음표 idx>=retryCount
   *
   * §0.1 dedup (2026-05-01 검증 + 박힘):
   *  - 옵션 5: lastShown과 다른 ID retry 우선 정렬 (batch[0] dedup 보장)
   *  - 옵션 7: missedArray 모두 lastShown 같은 ID인 좁은 케이스 → retry skip + 새 음표만 batch
   *    (다음 batch에서 lastShown 변경 후 retry 정상 처리)
   *
   * 큐(useRetryQueue)는 사용 X — final-retry는 N+2 알고리즘 외부.
   * missedMap을 인자로 받아 stale state 회피.
   */
  const composeFinalRetryBatch = useCallback((
    missedMap: Map<string, NoteType>,
    lastShownNote?: NoteType | null,
  ): {
    batch: NoteType[];
    keySig: KeySignatureType;
    retryCount: number;
  } | null => {
    const missedArray = Array.from(missedMap.values());
    if (missedArray.length === 0) return null;

    const targetBatchSize = getFinalRetryBatchSize(missedArray.length);

    // §0.1 dedup (옵션 5): lastShown과 다른 ID retry 우선.
    const lastShownId = lastShownNote ? missedNoteIdOf(lastShownNote, currentClef) : null;
    const sortedMissed = lastShownId
      ? [
          ...missedArray.filter(n => missedNoteIdOf(n, currentClef) !== lastShownId),
          ...missedArray.filter(n => missedNoteIdOf(n, currentClef) === lastShownId),
        ]
      : missedArray;

    const retryCount = Math.min(sortedMissed.length, targetBatchSize);
    const retryNotes = sortedMissed.slice(0, retryCount);

    // §0.1 dedup (옵션 7): retry[0]이 lastShown과 같으면 (missedArray 모두 lastShown 케이스) retry skip.
    if (
      retryCount > 0 &&
      lastShownId &&
      missedNoteIdOf(retryNotes[0], currentClef) === lastShownId
    ) {
      const newResult = generateNewBatch(targetBatchSize, false, lastShownNote);
      return { batch: newResult.batch, keySig: newResult.keySig, retryCount: 0 };
    }

    const newCount = targetBatchSize - retryCount;
    if (newCount === 0) {
      return { batch: retryNotes, keySig: currentKeySignature, retryCount };
    }
    const lastShownForNew = retryNotes[retryNotes.length - 1] ?? lastShownNote ?? null;
    const newResult = generateNewBatch(newCount, false, lastShownForNew);
    return {
      batch: [...retryNotes, ...newResult.batch],
      keySig: newResult.keySig,
      retryCount,
    };
  }, [getFinalRetryBatchSize, generateNewBatch, currentKeySignature, missedNoteIdOf, currentClef]);

  /**
   * §4 (2026-05-01) — 단순화: turnCounter += 1만.
   * retry pop은 composeBatch가 새 batch 생성 시 한 번에 처리.
   * batch 내 다음 음표 갈 때(같은 batch 안)도 turnCounter는 +1.
   */
  const prepareNextTurn = useCallback(() => {
    turnCounterRef.current += 1;
  }, []);

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
        // §4 (2026-05-01): 모든 stage 끝 — missedNotes 남으면 final-retry phase 진입.
        // batchSize 동적 (3·5·7), batch mode 유지 (history mode X).
        if (missedNotes.size > 0) {
          const result = composeFinalRetryBatch(missedNotes, lastShownNote ?? null);
          if (result) {
            setPhase("final-retry");
            setBatchAndKey(result);
            setCurrentIndex(0);
            setDisabledNotes(new Set());
            setAnsweredNotes([]);
            setTimerKey(prev => prev + 1);
            noteStartTime.current = performance.now();
            playNote(getSoundKey(result.batch[0]));
            return;
          }
        }
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
      // 조표가 바뀌면 이전 retry는 의미 없음 → 큐 초기화 (Lv5+)
      if (level >= 5 && !keepKeySig) {
        retryQueue.reset();
      }

      // §4 (2026-05-01): composeBatch가 retry 큐 통합 batch 생성.
      prepareNextTurn();
      const result = composeBatch(nextStage.batchSize, !keepKeySig, lastShownNote);
      setBatchAndKey(result);
      setCurrentIndex(0);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);

      playNote(getSoundKey(result.batch[0]));
    } else {
      const nextSet = currentSetNum + 1;
      setCurrentSet(nextSet);
      setSetProgress(0);
      // §0.4.1: batchSize=1 stage는 history 누적 유지 (정답 처리에서 7개 도달 시 자체 리셋).
      if (stageConfig.batchSize > 1) {
        setAnsweredNotes([]);
      }

      // §4 (2026-05-01): composeBatch — retry 큐 통합.
      prepareNextTurn();
      const result = composeBatch(stageConfig.batchSize, false, lastShownNote);
      setBatchAndKey(result);
      setCurrentIndex(0);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);

      playNote(getSoundKey(result.batch[0]));
    }
  }, [composeBatch, stages, prepareNextTurn, level, retryQueue, missedNotes, composeFinalRetryBatch]);

  /**
   * §4 (2026-05-01) — wasRetry 인자 제거.
   * retry 음표가 batch 안에 통합돼서 일반 advance와 동일 흐름.
   * resolve/reschedule 처리는 handleAnswer에서.
   */
  const advanceToNextTurn = useCallback(() => {
    const stagesRef = stages;
    const stageConfig = stagesRef[stageIdx];

    const nextIndex = currentIndex + 1;
    const lastShownNote = currentBatch[currentIndex] ?? null;

    if (nextIndex >= currentBatch.length) {
      const newProgress = setProgress + currentBatch.length;

      if (newProgress >= stageConfig.notesPerSet) {
        handleSetComplete(stageIdx, currentSet, lastShownNote);
      } else {
        setSetProgress(newProgress);
        prepareNextTurn();
        const result = composeBatch(stageConfig.batchSize, false, lastShownNote);
        setBatchAndKey(result);
        setCurrentIndex(0);
        setDisabledNotes(new Set());
        setTimerKey(prev => prev + 1);
        noteStartTime.current = performance.now();

        playNote(getSoundKey(result.batch[0]));
      }
    } else {
      setCurrentIndex(nextIndex);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);
      noteStartTime.current = performance.now();

      prepareNextTurn();
      playNote(getSoundKey(currentBatch[nextIndex]));
    }
  }, [stages, stageIdx, currentIndex, currentBatch, setProgress, currentSet, composeBatch, handleSetComplete, prepareNextTurn]);
  
  // §calibration + §swipe-modal (메모리 #18): calibration → swipe → 카운트다운 → 첫 음표.
  // isLoading 중 모달 X (메모리 #19 깜박임 방지 — Option A race condition fix 2026-05-04).
  const [showCalibration, setShowCalibration] = useState(false);
  const [showSwipeTutorial, setShowSwipeTutorial] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);

  // 1회 초기화 guard — isLoading 완료 후 modal 흐름 결정
  const calibrationInitRef = useRef(false);

  useEffect(() => {
    if (calibrationLoading || calibrationInitRef.current) return;
    calibrationInitRef.current = true;
    if (needsCalibration) {
      setShowCalibration(true);
    } else if (level >= 5 && !hasSeenSwipeTutorial(level)) {
      setShowSwipeTutorial(true);
    } else if (!skipCountdown) {
      setShowCountdown(true);
    }
  }, [calibrationLoading, needsCalibration, level, skipCountdown]);

  // 안전망: 로드 완료 후 needsCalibration이 false로 바뀌면 모달 닫기
  useEffect(() => {
    if (calibrationLoading) return;
    if (!needsCalibration && showCalibration) {
      setShowCalibration(false);
      if (level >= 5 && !hasSeenSwipeTutorial(level)) {
        setShowSwipeTutorial(true);
      } else if (!skipCountdown) {
        setShowCountdown(true);
      }
    }
  }, [calibrationLoading, needsCalibration, showCalibration, level, skipCountdown]);

  const handleCalibrationComplete = useCallback(async (offsetMs: number) => {
    await setCalibrationOffset(offsetMs);
    setShowCalibration(false);
    if (level >= 5 && !hasSeenSwipeTutorial(level)) {
      setShowSwipeTutorial(true);
    } else if (!skipCountdown) {
      setShowCountdown(true);
    }
  }, [level, skipCountdown, setCalibrationOffset]);

  const handleCalibrationSkip = useCallback(() => {
    skipCalibration();
    setShowCalibration(false);
    if (level >= 5 && !hasSeenSwipeTutorial(level)) {
      setShowSwipeTutorial(true);
    } else if (!skipCountdown) {
      setShowCountdown(true);
    }
  }, [level, skipCountdown, skipCalibration]);

  const handleSwipeTutorialClose = useCallback((markAsSeen: boolean) => {
    if (markAsSeen) markSwipeTutorialSeen(level);
    setShowSwipeTutorial(false);
    if (!skipCountdown) setShowCountdown(true);
  }, [level, skipCountdown]);

  const handleCountdownComplete = useCallback(() => {
    // §0.3 (개정 2026-05-01): grace setTimeout 제거 — setTimerKey가 startRef를 동기 리셋해 Sub3 안전 보장.
    setShowCountdown(false);
    setTimerKey(prev => prev + 1);
    noteStartTime.current = performance.now();
    if (currentBatch.length === 0) return;
    // §1 (2026-05-01): audio context 활성화 보장 후 playNote.
    //  - sampler 미준비 시 initSound 완료 대기
    //  - audio context suspended 시 명시적 resume (다른 탭 갔다 온 케이스)
    ensureAudioReady().then(() => {
      playNote(getSoundKey(currentBatch[0]));
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[§1] ensureAudioReady failed:", err);
      // fallback — synth로라도 시도
      playNote(getSoundKey(currentBatch[0]));
    });
  }, [currentBatch]);

  /**
   * §4 (2026-05-01) — final-retry phase 다음 음표 진행.
   *  - wasRetryNote=true 시 missedNotes에서 제거 (학습 완료/포기)
   *  - 같은 batch 내 다음 음표 있으면 진행 (currentIndex+1)
   *  - batch 끝나면 missedNotes 남았는지 확인 → 다음 batch (batchSize 동적 재계산) 또는 success
   */
  const advanceFinalRetry = useCallback((
    wasRetryNote: boolean,
    currentMissedId: string | null,
  ) => {
    const nextIndex = currentIndex + 1;
    const lastShownNote = currentBatch[currentIndex] ?? null;

    if (nextIndex < currentBatch.length) {
      // 같은 batch 내 다음 음표
      if (wasRetryNote && currentMissedId) {
        setMissedNotes(prev => {
          if (!prev.has(currentMissedId)) return prev;
          const next = new Map(prev);
          next.delete(currentMissedId);
          return next;
        });
      }
      setCurrentIndex(nextIndex);
      setDisabledNotes(new Set());
      setTimerKey(prevKey => prevKey + 1);
      noteStartTime.current = performance.now();
      playNote(getSoundKey(currentBatch[nextIndex]));
      return;
    }

    // batch 끝 — missedNotes 갱신 + 다음 batch 또는 success
    setMissedNotes(prev => {
      const next = new Map(prev);
      if (wasRetryNote && currentMissedId) next.delete(currentMissedId);

      if (next.size === 0) {
        setPhase("success");
        return next;
      }

      const result = composeFinalRetryBatch(next, lastShownNote);
      if (result) {
        setBatchAndKey(result);
        setCurrentIndex(0);
        setDisabledNotes(new Set());
        // §0.4.1: final-retry 새 batch — batchSize > 1이면 history 클리어.
        if (result.batch.length > 1) {
          setAnsweredNotes([]);
        }
        setTimerKey(prevKey => prevKey + 1);
        noteStartTime.current = performance.now();
        playNote(getSoundKey(result.batch[0]));
      }
      return next;
    });
  }, [currentIndex, currentBatch, composeFinalRetryBatch]);

  const handleAnswer = useCallback((answer: string) => {
    if ((phase !== "playing" && phase !== "final-retry") || !currentTarget) return;

    // §0.1 전역 dedup: 직전 표시 음표 추적 (정답·오답 모두 갱신).
    // popDueOrNull에 전달되어 같은 ID retry pop을 1턴 지연시킨다.
    lastShownNoteRef.current = currentTarget;

    const correctAnswer = getNoteAnswer(currentTarget);
    const responseTimeMs = performance.now() - noteStartTime.current;
    const responseTime   = +(responseTimeMs / 1000).toFixed(2);
    const clefForLog = currentTarget.clef ?? (isCustom ? customClef : getClefForLevel(level));

    const retryKey = {
      key: currentTarget.key,
      octave: currentTarget.octave,
      accidental: currentTarget.accidental,
      clef: clefForLog,
    };

    if (answer === correctAnswer) {
      const stageBatchSize = currentStageConfig.batchSize;
      const newEntry = {
        id: performance.now(),
        note: `${currentTarget.key}${currentTarget.octave}`,
        accidental: currentTarget.accidental,
        clef: clefForLog,
      };
      setAnsweredNotes(prev => {
        if (stageBatchSize === 1) {
          // §0.4.1: batchSize=1 — 답한 음표 회색으로 누적, MAX_HISTORY(7) 도달 시 화면 리셋.
          if (prev.length >= TOTAL_SLOTS - 1) {
            return [];
          }
          return [...prev, newEntry];
        }
        // batchSize > 1 (batch mode) — set 전환 시 클리어되므로 안전망으로만 capping.
        return [...prev.slice(-(TOTAL_SLOTS - 2)), newEntry];
      });

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

      // §4 (2026-05-01): final-retry phase 정답.
      //  - retry 음표(idx<retryCount): missedNotes에서 제거 + advance
      //  - 새 음표(idx>=retryCount): missedNotes 변동 X + advance (학습 보조)
      if (phase === "final-retry") {
        const wasRetryNote = currentIndex < batchAndKey.retryCount;
        const id = wasRetryNote ? missedNoteIdOf(currentTarget, clefForLog) : null;
        advanceFinalRetry(wasRetryNote, id);
        return;
      }

      // §4 (2026-05-01): wasRetry = 답한 음표가 batch 안 retry 음표였는지.
      // batch[0..retryCount-1]은 retry 음표, batch[retryCount..]은 새 음표.
      const wasRetry = currentIndex < batchAndKey.retryCount;

      retryQueue.markJustAnswered(retryKey, turnCounterRef.current);
      if (wasRetry) {
        // retry 음표 정답 → 영구 제거 (큐 + missedNotes 모두).
        retryQueue.resolve(retryKey);
        removeMissedNote(currentTarget, clefForLog);
      } else {
        // 일반 음표 정답 → 큐 마커 있던 경우만 N+2 후 재출제로 갱신 (마커 없으면 no-op).
        retryQueue.rescheduleAfterCorrect(retryKey, turnCounterRef.current);
      }
      advanceToNextTurn();
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

      // §4 (2026-05-01): markMissed → missedNotes에도 add (final-retry phase에서 사용).
      // 단 final-retry phase에서는 큐에 등록 X (이미 마지막 단계).
      if (phase !== "final-retry") {
        retryQueue.markMissed(retryKey);
        addMissedNote(currentTarget, clefForLog);
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

      // §4: final-retry phase 오답 — lives 차감 + advance.
      //  - retry 음표: missedNotes 제거 (학습 포기, 큐 X)
      //  - 새 음표: missedNotes 변동 X (학습 보조용)
      if (phase === "final-retry") {
        const wasRetryNote = currentIndex < batchAndKey.retryCount;
        const id = wasRetryNote ? missedNoteIdOf(currentTarget, clefForLog) : null;
        advanceFinalRetry(wasRetryNote, id);
        return;
      }

      // 같은 자리 유지하되 사용자가 다시 풀 시간을 줘야 하므로 타이머만 리셋.
      setTimerKey(prev => prev + 1);
      noteStartTime.current = performance.now();
    }
  }, [phase, currentTarget, currentIndex, batchAndKey.retryCount, currentStageConfig.batchSize, lives, individualStreak, logNote, recorder, level, isCustom, customClef, retryQueue, advanceToNextTurn, addMissedNote, removeMissedNote, missedNoteIdOf, advanceFinalRetry]);

  const handleTimerExpire = useCallback(() => {
    if ((phase !== "playing" && phase !== "final-retry") || !currentTarget) return;

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

    // §4 (2026-05-01): 타이머 만료 = 오답과 동일. final-retry phase에선 큐 등록 X.
    if (phase !== "final-retry") {
      const timeoutKey = {
        key: currentTarget.key,
        octave: currentTarget.octave,
        accidental: currentTarget.accidental,
        clef: clefForLog,
      };
      retryQueue.markMissed(timeoutKey);
      addMissedNote(currentTarget, clefForLog);
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

    // §4: final-retry phase timeout — lives 차감 + advance.
    if (phase === "final-retry") {
      const wasRetryNote = currentIndex < batchAndKey.retryCount;
      const id = wasRetryNote ? missedNoteIdOf(currentTarget, clefForLog) : null;
      advanceFinalRetry(wasRetryNote, id);
      return;
    }

    // 타이머만 리셋해서 사용자가 같은 음표를 다시 풀 시간 확보.
    setTimerKey(prev => prev + 1);
    noteStartTime.current = performance.now();
  }, [phase, lives, currentTarget, currentIndex, batchAndKey.retryCount, logNote, recorder, level, isCustom, customClef, retryQueue, addMissedNote, missedNoteIdOf, advanceFinalRetry]);

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
    setMissedNotes(new Map());

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
    // 리플레이는 새 게임 시작 — 큐 reset된 상태이므로 retry 0개. composeBatch=새 batch.
    const result = composeBatch(firstStage.batchSize, true);
    setBatchAndKey(result);
    const notes = result.batch;

    // §swipe-modal (2026-05-02): replay 시에는 swipe 모달 X (이미 한 판 진행했으므로).
    setShowSwipeTutorial(false);
    setShowCountdown(!skipCountdown);
    if (skipCountdown) {
      if (isSamplerReady()) {
        playNote(getSoundKey(notes[0]));
      }
      noteStartTime.current = performance.now();
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

      <CalibrationModal
        isOpen={showCalibration}
        canSkip={calibrationCanSkip}
        onComplete={handleCalibrationComplete}
        onSkip={handleCalibrationSkip}
      />
      <AccidentalSwipeTutorial isOpen={showSwipeTutorial} onClose={handleSwipeTutorialClose} />

      <span className="sr-only">
        현재 정답: {targetNoteStr ?? "(없음)"}
        {targetAccidental ? ` ${targetAccidental}` : ""}
      </span>


      <div className="w-full max-w-[612px] flex flex-col gap-3">

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
            paused={(phase !== "playing" && phase !== "final-retry") || showCountdown || showSwipeTutorial || showCalibration}
          />
        </div>

        <div className="w-full max-w-[612px] mx-auto">
          <GrandStaffPractice
            // §2 (2026-05-01): 카운트다운 중 음표·조표 숨김 (clef·오선만 표시).
            // §swipe-modal-perf (2026-05-02): swipe 모달 동안에도 동일하게 음표·조표 숨김.
            targetNote={(showCountdown || showSwipeTutorial || showCalibration) ? null : targetNoteStr}
            targetAccidental={(showCountdown || showSwipeTutorial || showCalibration) ? null : targetAccidental}
            noteHistory={(showCountdown || showSwipeTutorial || showCalibration) ? [] : answeredNotes}
            batchNotes={(showCountdown || showSwipeTutorial || showCalibration) ? undefined : batchNotesForDisplay}
            batchIndex={!showCountdown && !showSwipeTutorial && !showCalibration && isBatchDisplay ? currentIndex : undefined}
            clef={currentClef}
            level={level}
            batchSize={currentStageConfig.batchSize}
            keySignature={currentKeySignature.abcKey}
            keySharps={needsKeySig && !(showCountdown || showSwipeTutorial || showCalibration) ? currentKeySignature.sharps : undefined}
            keyFlats={needsKeySig && !(showCountdown || showSwipeTutorial || showCalibration) ? currentKeySignature.flats : undefined}
          />
        </div>

        <div className={`w-full mt-1 ${(showCountdown || showSwipeTutorial || showCalibration) ? "invisible" : ""}`}>
          <p className="text-center text-sm text-muted-foreground mb-3">
            {isBatchDisplay
              ? `${currentIndex + 1}/${currentBatch.length}번째 음표의 이름은?`
              : `${currentIndex + 1}번째 음표의 이름은?`}
          </p>

          <NoteButtons
            onNoteClick={handleAnswer}
            disabled={(phase !== "playing" && phase !== "final-retry") || showCountdown || showSwipeTutorial || showCalibration}
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
      <span className="sr-only" data-testid="game-debug-state">
        turn: {turnCounterRef.current} size: {retryQueue.size}
      </span>
    </div>
  );
}