import { useState, useCallback, useRef, useEffect } from "react";
import GameHeader from "./GameHeader";
import NoteButtons from "./NoteButtons";
import MissionSuccessModal from "./MissionSuccessModal";
import CountdownTimer from "./CountdownTimer";
import CountdownOverlay from "./CountdownOverlay";
import { playNote, playWrong, isSamplerReady, initSound } from "@/lib/sound";
import { useNoteLogger } from "@/hooks/useNoteLogger";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";
import { useRetryQueue } from "@/hooks/useRetryQueue";
import { useUserMastery, type MasteryMap } from "@/hooks/useUserMastery";
import { getNoteWeight, weightedPickIndex } from "@/lib/noteWeighting";
import {
  GrandStaffPractice,
  TOTAL_SLOTS,
  type StaffHistoryEntry,
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

// ═════════════════════════════════════════════════════════════
// 게임 단계 설계 — 레벨별로 다름
// ═════════════════════════════════════════════════════════════
type GameStageConfig = {
  readonly stage: number;
  readonly batchSize: number;
  readonly totalSets: number;
  readonly notesPerSet: number;
};


// Lv1-4: 점진적 난이도
const GAME_STAGES_BASIC: readonly GameStageConfig[] = [
  { stage: 1, batchSize: 1, totalSets: 3, notesPerSet: 3 },
  { stage: 2, batchSize: 1, totalSets: 3, notesPerSet: 5 },
  { stage: 3, batchSize: 3, totalSets: 3, notesPerSet: 3 },
  { stage: 4, batchSize: 5, totalSets: 3, notesPerSet: 5 },
] as const;

// Lv5-7: 처음부터 7개씩, 7세트
const GAME_STAGES_ADVANCED: readonly GameStageConfig[] = [
  { stage: 1, batchSize: 7, totalSets: 7, notesPerSet: 7 },
] as const;

function getStagesForLevel(level: number, isCustom: boolean): readonly GameStageConfig[] {
  if (!isCustom && level >= 5) return GAME_STAGES_ADVANCED;
  return GAME_STAGES_BASIC;
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

function getNotesForLevel(level: number): NoteType[] {
  switch (level) {
    case 1: return TREBLE_NOTES;
    case 2: return BASS_NOTES;
    case 3: return ADV_TREBLE_NOTES;
    case 4: return ADV_BASS_NOTES;
    default: return TREBLE_NOTES;
  }
}

function getClefForLevel(level: number): "treble" | "bass" {
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

function generateKeyBatch(
  _level: number,
  size: number,
  keySig: KeySignatureType,
  masteryMap: MasteryMap = new Map(),
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

  const trebleCount = pickBalancedCount(size);
  const clefSlots: Array<"treble" | "bass"> = [
    ...Array(trebleCount).fill("treble"),
    ...Array(size - trebleCount).fill("bass"),
  ];
  shuffleArray(clefSlots);

  let accSlots: boolean[];
  if (hasAccidentals && size > 1) {
    const accCount = pickBalancedCount(size);
    accSlots = [
      ...Array(accCount).fill(true),
      ...Array(size - accCount).fill(false),
    ];
    shuffleArray(accSlots);
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
      // 가중치 기반 샘플링 (masteryMap이 비어있으면 균등)
      const weights = candidates.map(n => {
        const acc = getAccidental(n.key);
        return getNoteWeight(masteryMap, clef, n.key, n.octave, acc);
      });
      const idx = weightedPickIndex(weights);
      picked = candidates[idx >= 0 ? idx : 0];
      attempts++;
      if (attempts > 200) break;
    } while (
      batch.length > 0 &&
      batch[batch.length - 1].key === picked.key &&
      batch[batch.length - 1].octave === picked.octave
    );

    batch.push({
      ...picked,
      accidental: getAccidental(picked.key),
      clef,
    });
  }

  return { notes: batch };
}

function generateBatch(
  pool: NoteType[],
  size: number,
  clef: "treble" | "bass",
  masteryMap: MasteryMap = new Map(),
): NoteType[] {
  const batch: NoteType[] = [];
  for (let i = 0; i < size; i++) {
    let n: NoteType;
    let attempts = 0;
    do {
      // 가중치 기반 샘플링 (masteryMap이 비어있으면 균등)
      const weights = pool.map(note =>
        getNoteWeight(masteryMap, clef, note.key, note.octave, note.accidental)
      );
      const idx = weightedPickIndex(weights);
      n = pool[idx >= 0 ? idx : Math.floor(Math.random() * pool.length)];
      attempts++;
      if (attempts > 200) break;
    } while (
      batch.length > 0 &&
      batch[batch.length - 1].key === n.key &&
      batch[batch.length - 1].octave === n.octave
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

const MAX_LIVES    = 5;
const TIMER_SECONDS = 9999;

// 개발용 디버그 패널 표시 (true로 바꾸면 retry queue 상태 확인 가능)
const SHOW_RETRY_DEBUG = false;

interface NoteGameProps {
  onReset?: () => void;
  onLevelSelect?: () => void;
  /** 다음 레벨로 진행 (프리미엄 체크 등은 Index.tsx에서) */
  onNextLevel?: () => void;
  level?: number;
  customNotes?: NoteType[];
  /** 테스트용: 카운트다운 스킵 */
  skipCountdown?: boolean;
}

export default function NoteGame({
  onReset,
  onLevelSelect,
  onNextLevel,
  level = 1,
  customNotes,
  skipCountdown = false,
}: NoteGameProps) {
  const { logNote }   = useNoteLogger();
  const recorder      = useSessionRecorder();
  const retryQueue    = useRetryQueue();                         // ★ n+2 재출제 큐
  const { masteryMap } = useUserMastery();                       // ★ 약점/마스터 플래그 (로그인 유저만)
  const noteStartTime = useRef<number>(Date.now());
  const turnCounterRef = useRef<number>(0);                      // ★ 세션 내 턴 카운터
  const isCustom      = level === 0 && !!customNotes;
  const NOTES         = isCustom ? customNotes : getNotesForLevel(level);
  const needsKeySig   = level >= 5;
  const showSharps    = level === 5 || level === 7 || (isCustom && customNotes.some(n => n.accidental === "#"));
  const showFlats     = level === 6 || level === 7 || (isCustom && customNotes.some(n => n.accidental === "b"));

  const customClef = isCustom
    ? (customNotes.some(n => parseInt(n.octave) >= 4) ? "treble" as const : "bass" as const)
    : "treble" as const;

  const stages = getStagesForLevel(level, isCustom);

  // ── 초기 상태 ──────────────────────────────────────────────
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

  const [currentBatch,        setCurrentBatch]        = useState<NoteType[]>(initResult.notes);
  const [currentIndex,        setCurrentIndex]        = useState(0);
  const [currentKeySignature, setCurrentKeySignature] = useState<KeySignatureType>(initResult.keySig);
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

  // ★ retry override: 현재 턴에서 batch 원본 대신 retry 음표를 낼 경우 저장
  const [retryOverride, setRetryOverride] = useState<NoteType | null>(null);

  const currentStageConfig = stages[stageIdx];

  // 실제 출제 대상: retryOverride가 있으면 그것, 아니면 batch 원본
  const currentTarget = retryOverride ?? currentBatch[currentIndex] ?? null;

  const currentClef: "treble" | "bass" =
    currentTarget?.clef ??
    (isCustom ? customClef : getClefForLevel(level));

  const targetNoteStr    = currentTarget ? `${currentTarget.key}${currentTarget.octave}` : null;
  const targetAccidental = currentTarget?.accidental ?? null;

  const stageLabel = `Stage ${currentStageConfig.stage}: ${
    currentStageConfig.batchSize === 1
      ? `음표 ${currentStageConfig.notesPerSet}개 순차`
      : `음표 ${currentStageConfig.batchSize}개`
  } (${currentSet}/${currentStageConfig.totalSets} 세트)`;

  // ─────────────────────────────────────────────────────────
  // 세션 시작
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sessionType: "regular" | "custom_score" = isCustom ? "custom_score" : "regular";
    recorder.startSession(level, sessionType);
    turnCounterRef.current = 0;
    retryQueue.reset();
    return () => {
      if (recorder.isRecording) {
        recorder.cancelSession();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────
  // 세션 종료
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "success" || phase === "gameover") {
      const reason = phase === "success" ? "completed" : "gameover";
      recorder.endSession(reason).then((result) => {
        if (result) {
          setSessionResult(result);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── 새 배치 생성 ───────────────────────────────────────────
  const generateNewBatch = useCallback((batchSize: number): NoteType[] => {
    if (isCustom) {
      return generateBatch(customNotes, batchSize, customClef, masteryMap);
    }
    if (level >= 5) {
      const newKey = getRandomKeySignature(level);
      setCurrentKeySignature(newKey);
      return generateKeyBatch(level, batchSize, newKey, masteryMap).notes;
    }
    const lvClef = getClefForLevel(level);
    return generateBatch(NOTES, batchSize, lvClef, masteryMap);
  }, [NOTES, isCustom, customNotes, level, customClef, masteryMap]);

  // ── 다음 출제 준비 (retry 체크) ──────────────────────────
  // 다음 turn으로 넘어갈 때 호출. retry queue에 due한 것이 있으면 override로 설정.
  const prepareNextTurn = useCallback(() => {
    turnCounterRef.current += 1;
    const due = retryQueue.popDueOrNull(turnCounterRef.current);
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
      return retryNote;
    }
    setRetryOverride(null);
    return null;
  }, [retryQueue]);

  // ── 세트 완료 처리 ─────────────────────────────────────────
  const handleSetComplete = useCallback((currentStageIdx: number, currentSetNum: number) => {
    const stagesRef = getStagesForLevel(level, isCustom);
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

      const notes = generateNewBatch(nextStage.batchSize);
      setCurrentBatch(notes);
      setCurrentIndex(0);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);

      const retryNote = prepareNextTurn();
      const toPlay = retryNote ?? notes[0];
      playNote(getSoundKey(toPlay));
    } else {
      const nextSet = currentSetNum + 1;
      setCurrentSet(nextSet);
      setSetProgress(0);
      setAnsweredNotes([]);

      const notes = generateNewBatch(stageConfig.batchSize);
      setCurrentBatch(notes);
      setCurrentIndex(0);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);

      const retryNote = prepareNextTurn();
      const toPlay = retryNote ?? notes[0];
      playNote(getSoundKey(toPlay));
    }
  }, [generateNewBatch, level, isCustom, prepareNextTurn]);

  // ── 다음 턴으로 진행 (정답/오답 공통) ──────────────────────
  // wasRetry: 직전에 출제된 게 retry 음표였는지 (true면 index 유지)
  const advanceToNextTurn = useCallback((wasRetry: boolean) => {
    const stagesRef = getStagesForLevel(level, isCustom);
    const stageConfig = stagesRef[stageIdx];

    if (wasRetry) {
      const retryNote = prepareNextTurn();
      if (retryNote) {
        playNote(getSoundKey(retryNote));
      } else if (currentBatch[currentIndex]) {
        playNote(getSoundKey(currentBatch[currentIndex]));
      }
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= currentBatch.length) {
      const newProgress = setProgress + currentBatch.length;

      if (newProgress >= stageConfig.notesPerSet) {
        handleSetComplete(stageIdx, currentSet);
      } else {
        setSetProgress(newProgress);
        const notes = generateNewBatch(stageConfig.batchSize);
        setCurrentBatch(notes);
        setCurrentIndex(0);
        setDisabledNotes(new Set());
        setTimerKey(prev => prev + 1);
        noteStartTime.current = Date.now();

        const retryNote = prepareNextTurn();
        const toPlay = retryNote ?? notes[0];
        playNote(getSoundKey(toPlay));
      }
    } else {
      setCurrentIndex(nextIndex);
      setDisabledNotes(new Set());
      setTimerKey(prev => prev + 1);
      noteStartTime.current = Date.now();

      const retryNote = prepareNextTurn();
      const toPlay = retryNote ?? currentBatch[nextIndex];
      playNote(getSoundKey(toPlay));
    }
  }, [level, isCustom, stageIdx, currentIndex, currentBatch, setProgress, currentSet, generateNewBatch, handleSetComplete, prepareNextTurn]);

  // 첫 마운트 시 카운트다운 표시 여부 (replay 시에도 표시)
  const [showCountdown, setShowCountdown] = useState(!skipCountdown);

  // 카운트다운 완료 시: 사운드 준비 확인 후 첫 음표 재생
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

  // ── 답변 처리 ──────────────────────────────────────────────
  const handleAnswer = useCallback((answer: string) => {
    if (phase !== "playing" || !currentTarget) return;

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
      // ── 정답 처리 ──
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

      retryQueue.resolve(retryKey);
      setScore(prev => prev + 1);

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

      // 공통 진행 로직으로 다음 턴
      advanceToNextTurn(wasRetry);
    } else {
      // ── 오답 처리 ──
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

      // retry queue 등록 (현재 turn 기준)
      retryQueue.scheduleRetry(retryKey, turnCounterRef.current);

      playWrong();
      setIndividualStreak(0);
      const newLives = lives - 1;
      setLives(newLives);

      if (newLives <= 0) {
        setPhase("gameover");
        return;
      }

      // ★ 오답 시 바로 다음 턴으로 진행 (C 옵션: Duolingo 스타일)
      advanceToNextTurn(wasRetry);
    }
  }, [phase, currentTarget, retryOverride, lives, individualStreak, logNote, recorder, level, isCustom, customClef, retryQueue, advanceToNextTurn]);

  // ── 타이머 만료 ────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (phase !== "playing" || !currentTarget) return;
    const clefForLog = currentTarget.clef ?? (isCustom ? customClef : getClefForLevel(level));
    const wasRetry = retryOverride !== null;

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

    retryQueue.scheduleRetry({
      key: currentTarget.key,
      octave: currentTarget.octave,
      accidental: currentTarget.accidental,
      clef: clefForLog,
    }, turnCounterRef.current);

    playWrong();
    setIndividualStreak(0);
    const newLives = lives - 1;
    setLives(newLives);

    if (newLives <= 0) {
      setPhase("gameover");
      return;
    }

    advanceToNextTurn(wasRetry);
  }, [phase, lives, currentTarget, retryOverride, logNote, recorder, level, isCustom, customClef, retryQueue, advanceToNextTurn]);

  // ── 리플레이 ───────────────────────────────────────────────
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

    // retry queue 초기화, turn counter 리셋
    retryQueue.reset();
    turnCounterRef.current = 0;

    const sessionType: "regular" | "custom_score" = isCustom ? "custom_score" : "regular";
    recorder.startSession(level, sessionType);

    const stagesRef = getStagesForLevel(level, isCustom);
    const firstStage = stagesRef[0];
    const notes = generateNewBatch(firstStage.batchSize);
    setCurrentBatch(notes);

    // 리플레이 시에도 카운트다운 표시 (사용자 요청, skipCountdown=true면 건너뜀)
    setShowCountdown(!skipCountdown);
    if (skipCountdown) {
      // 카운트 스킵: 첫 음표 즉시 재생
      if (isSamplerReady()) {
        playNote(getSoundKey(notes[0]));
      }
      noteStartTime.current = Date.now();
    }
  };

  // ── 게임 오버 ──────────────────────────────────────────────
  if (phase === "gameover") {
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

  // ── 메인 ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3 w-full animate-fade-up">

      {showCountdown && (
        <CountdownOverlay seconds={3} onComplete={handleCountdownComplete} />
      )}

      {/* 테스트 헬퍼용 — 시각적으로 숨겨진 현재 정답 마커 */}
      <span className="sr-only">
        현재 정답: {targetNoteStr ?? "(없음)"}
        {targetAccidental ? ` ${targetAccidental}` : ""}
      </span>

      {retryOverride && (
        <div className="text-center w-full mt-1">
          <span className="text-xs bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded">🔁 재출제</span>
        </div>
      )}

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
            clef={currentClef}
            level={level}
            keySignature={currentKeySignature.abcKey}
            keySharps={needsKeySig ? currentKeySignature.sharps : undefined}
            keyFlats={needsKeySig ? currentKeySignature.flats : undefined}
          />
        </div>

        <div className="w-full mt-1">
          <p className="text-center text-sm text-muted-foreground mb-3">
            {currentIndex + 1}번째 음표의 이름은?
          </p>
          <NoteButtons
            onNoteClick={handleAnswer}
            disabled={phase !== "playing" || showCountdown}
            disabledNotes={disabledNotes}
            keySharps={needsKeySig ? currentKeySignature.sharps : undefined}
            keyFlats={needsKeySig ? currentKeySignature.flats : undefined}
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

      {/* 테스트 헬퍼 + 개발용 디버그 데이터 — sr-only로 항상 DOM에 유지 */}
      <span className="sr-only">
        turn: {turnCounterRef.current} · size: {retryQueue.size}
      </span>

      {/* 개발용 디버그 패널 (SHOW_RETRY_DEBUG=true일 때만 시각적으로 표시) */}
      {SHOW_RETRY_DEBUG && (
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
        open={phase === "success"}
        score={score}
        onNextLevel={
          // 마지막 레벨(7)이면 다음 버튼 없음, 그 외엔 onNextLevel 호출
          level >= 7 || !onNextLevel
            ? undefined
            : () => onNextLevel()
        }
        onReplay={handleReplay}
        onLevelSelect={onLevelSelect}
        isFinalLevel={level >= 7}
      />

      {/* 개발 전용 힌트 — 프로덕션 빌드에서 트리쉐이킹으로 제거됨 */}
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