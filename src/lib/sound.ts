import * as Tone from "tone";

let sampler: Tone.Sampler | null = null;
let synth: Tone.PolySynth | null = null;
let gainNode: Tone.Gain | null = null;
let initialized = false;
let _samplerReady = false;

const SALAMANDER_BASE = "https://tonejs.github.io/audio/salamander/";

const PRACTICE_KEY_TO_NOTE: Record<string, string> = {
  C: "C4",
  D: "D4",
  E: "E4",
  F: "F4",
  G: "G4",
  A: "A4",
  B: "B4",
};

export function isSamplerReady() {
  return _samplerReady;
}

/**
 * §1 (2026-05-01) — 카운트다운 후 첫 음표 사운드 보장.
 *  1. sampler 미준비 시 initSound() 호출 (audio context resume + sampler 로딩)
 *  2. audio context가 suspended 상태면 명시적 resume (다른 탭 갔다 온 케이스)
 *
 * mount 시 initSound() 백그라운드 호출과 함께 사용해 99% 케이스 커버.
 */
export async function ensureAudioReady(): Promise<void> {
  if (!_samplerReady) {
    await initSound();
  }
  // audio context가 suspended이면 resume (사용자 인터랙션 후 호출 시 자동 resume).
  if (Tone.getContext().state === "suspended") {
    await Tone.getContext().resume();
  }
}

export async function initSound(): Promise<void> {
  if (initialized) return;
  await Tone.start();

  // ── 마스터 체인 (signal 흐름: gain → HP → brightness → EQ → limiter → dest)
  const limiter = new Tone.Limiter(-0.5).toDestination();

  // 밝은 그랜드 EQ
  const eq = new Tone.EQ3({
    low: 0.5,              // 저음 살짝만 (드라이에선 과한 저음은 뭉침)
    lowFrequency: 200,
    mid: 1.5,              // 상위 중음 살짝 부스트 → 음 윤곽 또렷
    high: 3.5,             // 고음 확실히 → 명료/밝기
    highFrequency: 3500,
  }).connect(limiter);

  // 초고역 샤인 (맑고 반짝이는 타건감)
  const brightness = new Tone.Filter({
    type: "highshelf",
    frequency: 7500,
    Q: 0.7,
  });
  brightness.gain.value = 2.5;
  brightness.connect(eq);

  // 초저역 럼블만 제거 (샘플 저음 보존)
  const highpass = new Tone.Filter({
    type: "highpass",
    frequency: 40,
    Q: 0.5,
  }).connect(brightness);

  gainNode = new Tone.Gain(0.88).connect(highpass);

  // Fallback synth (샘플 로딩 실패 시)
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0.08, release: 1.0 },
    volume: -5,
  }).connect(gainNode);

  return new Promise<void>((resolve) => {
    sampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
      },
      baseUrl: SALAMANDER_BASE,
      attack: 0,
      release: 1.8,        // 드라이라 릴리즈 짧게 (꼬리 깔끔)
      onload: () => {
        _samplerReady = true;
        initialized = true;
        resolve();
      },
    }).connect(gainNode!);

    setTimeout(() => {
      if (!_samplerReady) {
        initialized = true;
        console.warn("⚠️ Sampler timeout, using synth fallback");
        resolve();
      }
    }, 10000);
  });
}

// ── 재생 함수 ───────────────────────────────────────────

/**
 * 메인 재생: 1.6초 지속 (자연스러운 감쇠)
 * 벨로시티 0.9 — 또렷한 타건
 */
export function playNote(note: string) {
  if (_samplerReady && sampler) {
    sampler.triggerAttackRelease(note, 1.6, undefined, 0.9);
  } else {
    synth?.triggerAttackRelease(note, 1.2, undefined, 0.88);
  }
}

/**
 * 연습 버튼용: 짧게 톡
 */
export function playPracticePianoKey(letter: string) {
  const note = PRACTICE_KEY_TO_NOTE[letter.toUpperCase()] ?? "C4";
  if (_samplerReady && sampler) {
    sampler.triggerAttackRelease(note, 0.35, undefined, 0.92);
  } else {
    synth?.triggerAttackRelease(note, 0.28, undefined, 0.88);
  }
}

export function playCorrect() {
  // 침묵 유지 (정답 시 음표가 별도로 재생됨)
}

/**
 * 오답: 저음 짧게
 */
export function playWrong() {
  if (_samplerReady && sampler) {
    sampler.triggerAttackRelease("E2", 0.3, undefined, 0.55);
  } else if (synth) {
    synth.triggerAttackRelease("E3", "8n");
  }
}

/**
 * 정답 공개용 긴 울림
 */
export function playReveal(note: string) {
  if (_samplerReady && sampler) {
    sampler.triggerAttackRelease(note, 2.5, undefined, 0.92);
  } else {
    synth?.triggerAttackRelease(note, 2.0, undefined, 0.88);
  }
}