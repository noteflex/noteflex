// Daily Challenge — 자체 타입.
// 기존 게임 엔진·레벨 시스템과 절대 공유하지 않는 독립 정의.

export type DailyClef = "treble" | "bass";

export type DailyLetter = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export type DailyKeySignature = {
  /** "G major" | "C major" 등 표시용 라벨. */
  name: string;
  /** ["F"] = F♯. C major면 빈 배열/undefined. */
  sharps?: DailyLetter[];
  /** ["B"] = B♭. */
  flats?: DailyLetter[];
};

export type DailyCategory = "treble" | "bass" | "ledger" | "keysig";

export type DailyQuestion = {
  /** 0..19. 글로벌 순번. */
  index: number;
  /** 0..3. 같은 turn 안의 5문제는 한 보표에 동시 표시. */
  turn: number;
  category: DailyCategory;
  clef: DailyClef;
  letter: DailyLetter;
  octave: number;
  /** 조표가 letter에 적용한 결과 (#/b). 자연음이면 null. */
  accidental: "#" | "b" | null;
  /** 화면에 표시할 조표. C major면 빈 키. */
  keySignature: DailyKeySignature;
};

export type DailyResultStatus =
  | "correct_fast"  // 빠른 정답 (속도 임계 이내)
  | "correct_slow"  // 정답이지만 느림
  | "wrong"         // 오답 버튼
  | "timeout"       // 시간 초과
  | "unreached";    // 게임 종료(생명 소진)로 도달 못 함

export type DailyQuestionResult = {
  questionIndex: number;
  status: DailyResultStatus;
  /** 문제 표시 → 입력까지 ms. unreached면 null. */
  responseTimeMs: number | null;
  /** 조표 문제였는지(조표 보너스 적용 여부). */
  wasKeySig: boolean;
};

export type DailyFinalResult = {
  /** YYYY-MM-DD (로컬 시간 기준). */
  dateKey: string;
  score: number;
  results: DailyQuestionResult[];
  livesRemaining: number;
  /** 도달한 문제 수 (correct + wrong + timeout). */
  reached: number;
  correct: number;
  bestStreak: number;
  /** 전체 문제 모두 도달한 경우 true. */
  completed: boolean;
};
