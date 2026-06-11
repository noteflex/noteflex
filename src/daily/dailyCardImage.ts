// Daily Challenge — 결과 카드 PNG 렌더러 (canvas 2D 직접 그림).
//
// ⚠️ 디자인 = 코드. DailyResultCard.tsx의 카드 UI가 바뀌면 이 모듈도 같이 수정해야
// "화면 카드 ≈ 공유 이미지"가 유지됨. 1차 구현은 구조·색·기본 레이아웃만 정합 —
// 픽셀 단위 매칭은 스크린샷 비교 후 다음 라운드에서 조정.
//
// 스포일러프리: 음표·정답·키 노출 X (status 색 셀만 그림 — dailyShare 정책 그대로).

import { buildShareUrl } from "./dailyShare";
import { NOTES_PER_TURN, TOTAL_TURNS } from "./dailyGenerator";
import type {
  DailyFinalResult,
  DailyQuestionResult,
  DailyResultStatus,
} from "./dailyTypes";

export type CardLocale = "ko" | "en";

// ── 캔버스 — 인스타 친화 폭(1080), 콘텐츠(범례 포함)에 맞춰 세로 1500 ───
const CARD_W = 1080;
const CARD_H = 1500;

// ── 디자인 토큰 (src/index.css :root HSL → hex 환산) ───────
// --background 48 50% 96% / body { background-color: #faf8f0 }
const BG = "#faf8f0";
// --foreground 220 25% 10%
const FG = "#13192b";
// --muted-foreground 220 10% 46%
const MUTED = "#6a7383";
// --primary 345 72% 48% — 사이트 시그니처 빨강 (manifest theme_color #D3224E와 동일)
const PRIMARY = "#d3224e";

// 셀 색 — DailyResultCard.tsx CELL_BG와 1:1 (Tailwind 기본 팔레트)
const CELL: Record<DailyResultStatus, string> = {
  correct_fast: "#10b981", // emerald-500
  correct_slow: "#fbbf24", // amber-400
  wrong: "#ef4444",        // red-500
  timeout: "#ef4444",      // red-500
  unreached: "#d1d5db",    // gray-300
};

// ── 폰트 ───────────────────────────────────────────────────
// DM Sans = index.css에서 import. 이모지는 OS 컬러 이모지 폰트 fallback.
const FONT_FAMILY =
  "'DM Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif";

function font(size: number, weight: number | string = 500): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

// ── 데일리 일련번호 — DailyResultCard.tsx 로컬 자정 로직 미러 ─
const DAILY_EPOCH_Y = 2026;
const DAILY_EPOCH_M = 6;
const DAILY_EPOCH_D = 1;

function dailyNumberFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return 1;
  const today = new Date(y, m - 1, d).getTime();
  const epoch = new Date(DAILY_EPOCH_Y, DAILY_EPOCH_M - 1, DAILY_EPOCH_D).getTime();
  return Math.floor((today - epoch) / 86_400_000) + 1;
}

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateLine(dateKey: string, locale: CardLocale): string {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return dateKey;
  if (locale === "ko") return `${y}년 ${m}월 ${d}일`;
  return `${EN_MONTHS[m - 1] ?? ""} ${d}, ${y}`;
}

function buildMatrix(
  results: readonly DailyQuestionResult[],
): DailyResultStatus[][] {
  const flat: DailyResultStatus[] = Array.from(
    { length: TOTAL_TURNS * NOTES_PER_TURN },
    () => "unreached",
  );
  for (const r of results) {
    if (r.questionIndex >= 0 && r.questionIndex < flat.length) {
      flat[r.questionIndex] = r.status;
    }
  }
  const matrix: DailyResultStatus[][] = [];
  for (let t = 0; t < TOTAL_TURNS; t++) {
    matrix.push(flat.slice(t * NOTES_PER_TURN, (t + 1) * NOTES_PER_TURN));
  }
  return matrix;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function waitFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  try {
    await document.fonts.ready;
  } catch {
    /* 폰트 로드 실패해도 system fallback으로 계속 진행 */
  }
}

/**
 * 결과 카드 PNG Blob 생성. CARD_W×CARD_H, DPR 2x 백잉으로 선명도 확보.
 * 호출자가 Blob → File로 감싸 navigator.share({ files })에 전달.
 */
export async function renderDailyCard(
  result: DailyFinalResult,
  locale: CardLocale,
): Promise<Blob> {
  await waitFonts();

  const DPR = 2;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * DPR;
  canvas.height = CARD_H * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.scale(DPR, DPR);
  ctx.textBaseline = "alphabetic";

  const isKo = locale === "ko";
  const dailyNo = dailyNumberFromDateKey(result.dateKey);
  const dateLine = formatDateLine(result.dateKey, locale);
  const total = TOTAL_TURNS * NOTES_PER_TURN;
  const turnsPlayed = Math.min(
    TOTAL_TURNS,
    Math.ceil(result.reached / NOTES_PER_TURN),
  );

  // 배경
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const PAD_X = 80;
  let y = 120;

  // ── 헤더: 🎼 데일리 챌린지 #N ────────────────────────────
  ctx.fillStyle = FG;
  ctx.font = font(44, 600);
  ctx.textAlign = "center";
  const titleText = isKo
    ? `🎼 데일리 챌린지 #${dailyNo}`
    : `🎼 Daily challenge #${dailyNo}`;
  ctx.fillText(titleText, CARD_W / 2, y);
  y += 70;

  // 날짜 — 강조(키움 + FG 색, 📅 prefix). 회색 작은 글씨 톤 탈피.
  ctx.fillStyle = FG;
  ctx.font = font(36, 600);
  ctx.fillText(`📅 ${dateLine}`, CARD_W / 2, y);
  y += 80;

  // ── 점수 + 단위 ──────────────────────────────────────────
  const scoreText = result.score.toLocaleString();
  const unitText = isKo ? "점" : "pts";

  ctx.font = font(160, 800);
  const scoreW = ctx.measureText(scoreText).width;
  ctx.font = font(44, 500);
  const unitW = ctx.measureText(" " + unitText).width;

  const totalW = scoreW + unitW;
  const scoreX = (CARD_W - totalW) / 2;
  const scoreBaseline = y + 130;

  ctx.fillStyle = PRIMARY;
  ctx.font = font(160, 800);
  ctx.textAlign = "left";
  ctx.fillText(scoreText, scoreX, scoreBaseline);

  ctx.fillStyle = MUTED;
  ctx.font = font(44, 500);
  ctx.fillText(" " + unitText, scoreX + scoreW, scoreBaseline);

  y += 170;

  // Correct n/total
  ctx.fillStyle = MUTED;
  ctx.font = font(28, 500);
  ctx.textAlign = "center";
  const correctText = isKo
    ? `정답 ${result.correct}/${total}`
    : `Correct ${result.correct}/${total}`;
  ctx.fillText(correctText, CARD_W / 2, y);
  y += 70;

  // ── 5×5 그리드 — 정사각 셀, 중앙 정렬, 좌우 여백 충분 ───
  const matrix = buildMatrix(result.results);
  const LABEL_W = 50;
  const LABEL_GAP = 20;
  const CELL_W = 72;
  const CELL_H = 72;
  const CELL_GAP = 12;
  const ROW_GAP = 12;
  const GRID_TOTAL_W =
    LABEL_W + LABEL_GAP + CELL_W * NOTES_PER_TURN + CELL_GAP * (NOTES_PER_TURN - 1);
  const GRID_X = (CARD_W - GRID_TOTAL_W) / 2;
  const CELLS_AREA_X = GRID_X + LABEL_W + LABEL_GAP;

  for (let t = 0; t < TOTAL_TURNS; t++) {
    const rowY = y + t * (CELL_H + ROW_GAP);

    ctx.fillStyle = MUTED;
    ctx.font = font(22, 700);
    ctx.textAlign = "right";
    ctx.fillText(`T${t + 1}`, GRID_X + LABEL_W, rowY + CELL_H / 2 + 8);

    for (let i = 0; i < NOTES_PER_TURN; i++) {
      const cx = CELLS_AREA_X + i * (CELL_W + CELL_GAP);
      ctx.fillStyle = CELL[matrix[t][i]];
      roundRect(ctx, cx, rowY, CELL_W, CELL_H, 14);
      ctx.fill();
    }
  }
  y += TOTAL_TURNS * CELL_H + (TOTAL_TURNS - 1) * ROW_GAP + 70;

  // ── 3-stat (🔥 best / 🎯 turns / ❤️ lives) ──────────────
  const statW = (CARD_W - PAD_X * 2) / 3;
  const stats: Array<{ emoji: string; value: string; label: string }> = [
    {
      emoji: "🔥",
      value: String(result.bestStreak),
      label: isKo ? "최고 콤보" : "Best combo",
    },
    {
      emoji: "🎯",
      value: `${turnsPlayed}/${TOTAL_TURNS}`,
      label: isKo ? "진행 턴" : "Turns",
    },
    {
      emoji: "❤️",
      value: String(result.livesRemaining),
      label: isKo ? "남은 생명" : "Lives",
    },
  ];

  ctx.textAlign = "center";
  for (let i = 0; i < stats.length; i++) {
    const sx = PAD_X + statW * i + statW / 2;

    ctx.fillStyle = FG;
    ctx.font = font(36, 700);
    ctx.fillText(`${stats[i].emoji} ${stats[i].value}`, sx, y);

    ctx.fillStyle = MUTED;
    ctx.font = font(22, 500);
    ctx.fillText(stats[i].label, sx, y + 38);
  }
  y += 110;

  // ── 미도달 안내 ─────────────────────────────────────────
  if (!result.completed) {
    ctx.fillStyle = MUTED;
    ctx.font = font(20, 400);
    ctx.textAlign = "center";
    const msg = isKo
      ? `생명 소진으로 중간 종료 · ${total - result.reached}문제 미도달`
      : `Ended early · ${total - result.reached} not reached`;
    ctx.fillText(msg, CARD_W / 2, y);
    y += 30;
  }
  y += 20;

  // ── 색 범례 — 셀 색 의미. status 의미는 dailyTypes.ts 기준 ─
  //   correct_fast(green) = 빠른 정답 / Quick
  //   correct_slow(amber) = 느린 정답 / Slow
  //   wrong+timeout(red)  = 오답·시간초과 / Miss
  //   unreached(gray)     = 생명 소진 미도달 / Skip
  const legend: Array<{ color: string; label: string }> = isKo
    ? [
        { color: CELL.correct_fast, label: "빠름" },
        { color: CELL.correct_slow, label: "느림" },
        { color: CELL.wrong, label: "오답" },
        { color: CELL.unreached, label: "미도달" },
      ]
    : [
        { color: CELL.correct_fast, label: "Quick" },
        { color: CELL.correct_slow, label: "Slow" },
        { color: CELL.wrong, label: "Miss" },
        { color: CELL.unreached, label: "Skip" },
      ];

  const LEGEND_CHIP = 30;
  const LEGEND_CHIP_GAP = 12;
  const LEGEND_FONT_SIZE = 24;
  const LEGEND_SLOT_W = (CARD_W - PAD_X * 2) / legend.length;

  ctx.font = font(LEGEND_FONT_SIZE, 600);
  ctx.textBaseline = "middle";
  for (let i = 0; i < legend.length; i++) {
    const slotCenterX = PAD_X + LEGEND_SLOT_W * i + LEGEND_SLOT_W / 2;
    const labelW = ctx.measureText(legend[i].label).width;
    const groupW = LEGEND_CHIP + LEGEND_CHIP_GAP + labelW;
    const groupX = slotCenterX - groupW / 2;
    const rowCenterY = y + LEGEND_CHIP / 2;

    ctx.fillStyle = legend[i].color;
    roundRect(ctx, groupX, y, LEGEND_CHIP, LEGEND_CHIP, 8);
    ctx.fill();

    ctx.fillStyle = FG;
    ctx.textAlign = "left";
    ctx.fillText(
      legend[i].label,
      groupX + LEGEND_CHIP + LEGEND_CHIP_GAP,
      rowCenterY,
    );
  }
  ctx.textBaseline = "alphabetic";
  y += LEGEND_CHIP + 60;

  // ── 하단 브랜딩 — 전체 URL ──────────────────────────────
  const url = buildShareUrl();
  ctx.fillStyle = MUTED;
  ctx.font = font(26, 600);
  ctx.textAlign = "center";
  ctx.fillText(url, CARD_W / 2, CARD_H - 80);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas toBlob returned null"));
      },
      "image/png",
    );
  });
}
