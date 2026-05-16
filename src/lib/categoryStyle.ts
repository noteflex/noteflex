export interface CategoryStyle {
  gradient: string;
  darkGradient: string;
  hoverGradient: string;
  icon: string;
  textColor: string;
}

const DEFAULT_STYLE: CategoryStyle = {
  gradient: "from-stone-100 to-stone-200",
  darkGradient: "dark:from-stone-800 dark:to-stone-700",
  hoverGradient: "hover:from-stone-200 hover:to-stone-300",
  icon: "🎼",
  textColor: "text-stone-700 dark:text-stone-200",
};

const STYLE_MAP: Record<string, CategoryStyle> = {
  // HISTORY_THEORY — amber / beige
  "음악 이론 & 화성학": {
    gradient: "from-amber-100 to-amber-200",
    darkGradient: "dark:from-amber-900/60 dark:to-amber-800/60",
    hoverGradient: "hover:from-amber-200 hover:to-amber-300",
    icon: "📚",
    textColor: "text-amber-800 dark:text-amber-200",
  },
  "Theory & Harmony": {
    gradient: "from-amber-100 to-amber-200",
    darkGradient: "dark:from-amber-900/60 dark:to-amber-800/60",
    hoverGradient: "hover:from-amber-200 hover:to-amber-300",
    icon: "📚",
    textColor: "text-amber-800 dark:text-amber-200",
  },
  "초견의 정석": {
    gradient: "from-amber-100 to-amber-200",
    darkGradient: "dark:from-amber-900/60 dark:to-amber-800/60",
    hoverGradient: "hover:from-amber-200 hover:to-amber-300",
    icon: "📚",
    textColor: "text-amber-800 dark:text-amber-200",
  },
  "Sight-Reading Lab": {
    gradient: "from-amber-100 to-amber-200",
    darkGradient: "dark:from-amber-900/60 dark:to-amber-800/60",
    hoverGradient: "hover:from-amber-200 hover:to-amber-300",
    icon: "📚",
    textColor: "text-amber-800 dark:text-amber-200",
  },

  // PRACTICAL_GUIDE — emerald / mint
  "실전 연습 가이드": {
    gradient: "from-emerald-100 to-emerald-200",
    darkGradient: "dark:from-emerald-900/60 dark:to-emerald-800/60",
    hoverGradient: "hover:from-emerald-200 hover:to-emerald-300",
    icon: "🎵",
    textColor: "text-emerald-800 dark:text-emerald-200",
  },
  "Practice Hub": {
    gradient: "from-emerald-100 to-emerald-200",
    darkGradient: "dark:from-emerald-900/60 dark:to-emerald-800/60",
    hoverGradient: "hover:from-emerald-200 hover:to-emerald-300",
    icon: "🎵",
    textColor: "text-emerald-800 dark:text-emerald-200",
  },
  "직군별 학습 전략": {
    gradient: "from-emerald-100 to-emerald-200",
    darkGradient: "dark:from-emerald-900/60 dark:to-emerald-800/60",
    hoverGradient: "hover:from-emerald-200 hover:to-emerald-300",
    icon: "🎵",
    textColor: "text-emerald-800 dark:text-emerald-200",
  },
  "Learning Strategies by Role": {
    gradient: "from-emerald-100 to-emerald-200",
    darkGradient: "dark:from-emerald-900/60 dark:to-emerald-800/60",
    hoverGradient: "hover:from-emerald-200 hover:to-emerald-300",
    icon: "🎵",
    textColor: "text-emerald-800 dark:text-emerald-200",
  },
  "Sight-Reading by Role": {
    gradient: "from-emerald-100 to-emerald-200",
    darkGradient: "dark:from-emerald-900/60 dark:to-emerald-800/60",
    hoverGradient: "hover:from-emerald-200 hover:to-emerald-300",
    icon: "🎵",
    textColor: "text-emerald-800 dark:text-emerald-200",
  },
  "학습 데이터·과학": {
    gradient: "from-emerald-100 to-emerald-200",
    darkGradient: "dark:from-emerald-900/60 dark:to-emerald-800/60",
    hoverGradient: "hover:from-emerald-200 hover:to-emerald-300",
    icon: "🎵",
    textColor: "text-emerald-800 dark:text-emerald-200",
  },
  "Learning Science": {
    gradient: "from-emerald-100 to-emerald-200",
    darkGradient: "dark:from-emerald-900/60 dark:to-emerald-800/60",
    hoverGradient: "hover:from-emerald-200 hover:to-emerald-300",
    icon: "🎵",
    textColor: "text-emerald-800 dark:text-emerald-200",
  },

  // MUSIC_TECH — sky / blue
  "뮤직 테크 & 미래": {
    gradient: "from-sky-100 to-sky-200",
    darkGradient: "dark:from-sky-900/60 dark:to-sky-800/60",
    hoverGradient: "hover:from-sky-200 hover:to-sky-300",
    icon: "🎧",
    textColor: "text-sky-800 dark:text-sky-200",
  },
  "Music Tech": {
    gradient: "from-sky-100 to-sky-200",
    darkGradient: "dark:from-sky-900/60 dark:to-sky-800/60",
    hoverGradient: "hover:from-sky-200 hover:to-sky-300",
    icon: "🎧",
    textColor: "text-sky-800 dark:text-sky-200",
  },

  // INSTRUMENT — violet
  "악기별 가이드": {
    gradient: "from-violet-100 to-violet-200",
    darkGradient: "dark:from-violet-900/60 dark:to-violet-800/60",
    hoverGradient: "hover:from-violet-200 hover:to-violet-300",
    icon: "🎹",
    textColor: "text-violet-800 dark:text-violet-200",
  },
  "악기별 초견 전략": {
    gradient: "from-violet-100 to-violet-200",
    darkGradient: "dark:from-violet-900/60 dark:to-violet-800/60",
    hoverGradient: "hover:from-violet-200 hover:to-violet-300",
    icon: "🎹",
    textColor: "text-violet-800 dark:text-violet-200",
  },
  "Instrument Guides": {
    gradient: "from-violet-100 to-violet-200",
    darkGradient: "dark:from-violet-900/60 dark:to-violet-800/60",
    hoverGradient: "hover:from-violet-200 hover:to-violet-300",
    icon: "🎹",
    textColor: "text-violet-800 dark:text-violet-200",
  },
  "Sight-Reading by Instrument": {
    gradient: "from-violet-100 to-violet-200",
    darkGradient: "dark:from-violet-900/60 dark:to-violet-800/60",
    hoverGradient: "hover:from-violet-200 hover:to-violet-300",
    icon: "🎹",
    textColor: "text-violet-800 dark:text-violet-200",
  },
};

export function getCategoryStyle(category: string): CategoryStyle {
  return STYLE_MAP[category] ?? DEFAULT_STYLE;
}
