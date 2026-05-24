// 글로벌 UI 텍스트. 한·영 작성, 일·중은 영어 fallback (Phase 3 영역).
// 신규 키 추가 시 Strings 인터페이스 + ko + en 모두 추가.

import type { Lang } from "@/contexts/LanguageContext";

export interface Strings {
  hero: {
    title: string;
    subtitle: string;
  };
  game: {
    start: string;
  };
  comingSoon: {
    badge: string;
    /** {email} placeholder 포함 */
    body: string;
    blogButton: string;
  };
  header: {
    signIn: string;
    signOut: string;
    profile: string;
    dashboard: string;
    setNicknameHint: string;
  };
  legal: {
    terms: string;
    privacy: string;
    refund: string;
    cookies: string;
    businessInfo: string;
    home: string;
    effectiveDate: string;
  };
  footer: {
    copyright: string;
    pricing: string;
    product: string;
    company: string;
    support: string;
    legalSection: string;
    about: string;
    contact: string;
    faq: string;
    blog: string;
    companyName: string;
    ceo: string;
    bizReg: string;
    ecommerceReg: string;
    address: string;
    email: string;
  };
  blog: {
    title: string;
    subtitle: string;
    home: string;
    all: string;
    empty: string;
    backToList: string;
    loading: string;
    notFound: string;
    notFoundBody: string;
    backToBlog: string;
    adLabel: string;
    categories: readonly string[];
  };
  langToggle: {
    ko: string;
    en: string;
  };
  premiumDialog: {
    title: string;
    subtitle: string;
    benefits: readonly string[];
    cta: string;
    close: string;
  };
  lockedByProgress: {
    title: string;
    subtitle: string;     // {requiredLevel}·{requiredSublevel} placeholder
    description: string;
    cta: string;          // {requiredLevel}·{requiredSublevel} placeholder
    close: string;
  };
  profile: {
    title: string;
    homeLink: string;
    accountSection: string;
    nicknameLabel: string;
    nicknamePlaceholder: string;
    nicknameChecking: string;
    nicknameAvailable: string;
    nicknameTaken: string;
    nicknameSuggestions: string;
    birthYearLabel: string;
    nationalityLabel: string;
    languageLabel: string;
    marketingConsent: string;
    dirtyHint: string;
    saveButton: string;
    saving: string;
    saveSuccess: string;
    saveFailed: string;
    nicknameDuplicate: string;
    nicknameDuplicateDesc: string;
    solfegeSection: string;
    solfegeKorean: string;
    solfegeEnglish: string;
    solfegeLatin: string;
    solfegeApplied: string;
    accountInfoSection: string;
    accountInfoEmail: string;
    accountInfoJoinedAt: string;
    accountInfoSubscription: string;
    accountInfoFree: string;
    signOutButton: string;
    deleteSection: string;
    deleteDescription: string;
    deleteButton: string;
    deleteConfirmTitle: string;
    deleteConfirmDesc: string;
    deleteEmailSentTitle: string;
    deleteReasonLabel: string;
    deleteReasonNone: string;
    deleteReasons: readonly string[];
    deleteSendButton: string;
    deleteSending: string;
    deleteEmailSentBody: string;
    deleteRecoveryHint: string;
    deleteCancel: string;
    deleteCloseModal: string;
    deleteSendFailed: string;
    manageSubscription: string;
    manageSubscriptionLoading: string;
  };
  adPlaceholder: {
    premium: {
      title: string;
      subtitle: string;
      cta: string;
    };
    blog: {
      readMore: string;
    };
  };
  dailyLimit: {
    guest: {
      title: string;
      values: readonly string[];
      cta: string;
      close: string;
    };
    free: {
      title: string;
      values: readonly string[];
      pricing: string;
      cta: string;
      close: string;
    };
    /** "{hours}h {minutes}m" placeholder 포함 */
    countdown: string;
  };
  diagnosis: {
    analyzing: string;
    noRecordsTitle: string;
    noRecordsHint: string;
    period7d: string;
    period30d: string;
    periodAll: string;
    kpiTotalQuestions: string;
    kpiAccuracy: string;
    kpiCorrectCount: string;
    kpiAvgReaction: string;
    vulnerabilityTitle: string;
    vulnerabilityLowest: string;
    weakestNotesTitle: string;
    weakestNotesTooltip: string;
    slowestNotesTitle: string;
    slowestNotesTooltip: string;
    dailyAccuracyTitle: string;
    reactionTrendTitle: string;
    chartNoData: string;
    chartAvgLabel: string;
    chartMaxLabel: string;
    chartMinLabel: string;
    chartLatestLabel: string;
    secondsSuffix: string;
    // Batch analysis (formal)
    batchTitle: string;
    batchTooltip: string;
    batchPending: string;       // "{time}" placeholder
    batchLastAnalyzedAt: string; // "마지막 분석: {time}" / "Last analyzed: {time}"
    batchLoading: string;
    batchError: string;          // "{err}" placeholder
    batchEmpty: string;
    batchWeaknessHeading: string; // "{count}" placeholder
    batchNoWeakness: string;
    batchMastersHeading: string;  // "{count}" placeholder
    batchNoMasters: string;
    clefTreble: string;
    clefBass: string;
    statAccuracy: string;        // "정답률 {pct}"
  };
  aiCoachingDetail: {
    fasterNotesTitle: string;     // 🚀 빨라진 음표
    slowerNotesTitle: string;     // 🐢 느려진 음표
    accuracyUpTitle: string;      // 🎯 정확도 ↑
    accuracyDownTitle: string;    // 🎯 정확도 ↓
    insufficientData: string;     // 이전 기록 5회 미만 영역
    noteDeltaSeconds: string;     // "{note} ({sign}{delta}초)"
    noteDeltaPp: string;          // "{note} ({sign}{delta}%p)"
    /** showDetail prop을 다이얼로그 표시할지 안 할지 (테스트·placeholder) */
  };
  gameDialogs: {
    // GameOverDialog
    gameOverTitle: string;       // "😵 게임 오버 — {label}"
    gameOverDesc: string;
    statAttempts: string;
    statAccuracy: string;
    statBestStreak: string;
    backToPrevious: string;      // "이전 단계로 ({label})"
    retrySameLevel: string;
    // SublevelPassedDialog — fast track
    fastTrackBadge: string;
    fastTrackAutoAdvance: string; // "{n}초 후 자동 진입" / "Auto-advance in {n}s"
    fastTrackGoNow: string;
    fastTrackLevelSelect: string;
    // SublevelPassedDialog — normal pass
    passedTitle: string;         // "🎉 {label} 통과!"
    clearTitle: string;          // "✅ {label} 클리어"
    passedDescNext: string;      // "축하해요! {nextLabel}이(가) 해제됐어요." / "..."
    passedDescLast: string;      // "🏆 마지막 단계까지 통과했어요. 진짜 그랜드마스터!"
    clearDesc: string;           // "이번 판도 깔끔하게 클리어. 더 도전해볼래요?"
    backToSelect: string;        // "단계 선택으로"
    replaySameLevel: string;     // "같은 단계 한 번 더"
    nextLevelButton: string;     // "{nextLabel}로 →" / "{nextLabel} →"
    // PauseDialog
    pauseTitle: string;
    pauseBody: string;
    pauseResume: string;
    pauseExit: string;
    exitLabel: string;
  };
  dashboard: {
    backToHome: string;
    libraryPreviewTitle: string;
    libraryPreviewDesc: string;
    pageTitle: string;
    pageSubtitle: string;
    loading: string;
    updating: string;
    liveLastPractice: string;
    refresh: string;
    refreshSuccess: string;
    dataError: string;          // "{error}" placeholder
    // StatTile labels
    currentStreak: string;
    streakValueDays: string;    // "{n}일" / "{n} days"
    streakTodayDone: string;
    streakTodayContinues: string;
    streakTodayFirst: string;
    todayXp: string;
    totalXp: string;            // "총 {n} XP" / "Total {n} XP"
    league: string;
    leagueGroupRank: string;    // "{rank}위 · 주간 {xp} XP" / "Group #{rank} · Weekly {xp} XP"
    leagueWeekly: string;       // "주간 {xp} XP" / "Weekly {xp} XP"
    leagueAfterFirst: string;
    longestStreak: string;
    bestRecord: string;
    // Tabs
    tabRhythm: string;
    tabDiagnosis: string;
    tabActivity: string;
    // XP chart
    xpChartTitle: string;
    xpRangeRecent7d: string;
    xpRangeRecent30d: string;
    xpRangeEarned: string;      // "{range} 획득 XP"
    xpRange7d: string;
    xpRange30d: string;
    xpEarnedLabel: string;      // "획득" / "earned"
    noRecordWeek: string;
    noRecord30d: string;
    // Accuracy / reaction chart
    accuracyReactionTitle: string;
    accuracyReactionDesc: string;
    accuracyAxis: string;       // "정확도 (%)"
    reactionAxis: string;       // "평균 반응속도 (ms)"
    accuracyTooltip: string;
    avgTooltip: string;
    // Weak notes
    weakNotesTitle: string;
    weakNotesTooltip: string;
    weakNotesDesc: string;
    weakNotesInsufficient: string;
    clefTreble: string;
    clefBass: string;
    avgMs: string;              // "평균 {n}ms"
    // AI feedback
    aiFeedbackTitle: string;
    aiFeedbackDesc: string;
    reportDailyLabel: string;
    reportDailyPeriod: string;
    reportWeeklyLabel: string;
    reportWeeklyPeriod: string;
    reportMonthlyLabel: string;
    reportMonthlyPeriod: string;
    reportComingSoon: string;   // "🤖 {label} 준비 중이에요"
    reportDailyDesc: string;
    reportNotDailyDesc: string;
    // Recent sessions
    recentSessionsTitle: string;
    recentSessionsDesc: string;
    noSessions: string;
    tableTime: string;
    tableLevel: string;
    tableCorrectTotal: string;
    tableAccuracy: string;
    tableAvgReaction: string;
    tableXp: string;
    // Premium gate (AI 분석 보고서)
    aiReportLocked: string;             // "AI 일간 분석 보고서"
    aiReportLockedSubtitle: string;     // 짧은 안내
    // DAY_LABELS
    dayLabels: readonly string[];       // 일·월·화·... / S·M·T·...

    // ── 신규 미니멀 대시보드 영역 ─────────────────────────────
    /** 상태 2: 오늘 활동 없음 */
    emptyTodayTitle: string;        // "오늘은 아직 시작하지 않았어요"
    emptyTodaySubtitle: string;     // "스트릭 유지하려면 오늘 1회 연습해주세요"
    emptyTodayStreakHint: string;   // "오늘 박으면 {n}일째" placeholder
    emptyTodayCta: string;          // "지금 시작 →"

    /** 상태 3: 신규 사용자 */
    newUserTitle: string;           // "🎵 첫 세션을 시작해보세요"
    newUserSubtitle: string;        // "연습이 누적되면 약한 음표·진행 영역이 표시됩니다"
    newUserCta: string;             // "지금 시작하기 →"

    /** KPI 비교 영역 */
    vsLast: string;                 // "vs 최근"
    noLastSessionYet: string;       // "첫 세션 이후 표시"
    lastActivityTitle: string;      // "마지막 활동"
    lastActivityFormat: string;     // "{when} · 정답률 {acc}% · 속도 {speed}s · XP {xp}" placeholder
    daysAgo: string;                // "{n}일 전" / "{n} days ago"
    yesterday: string;
    today: string;
    /** 상태 2 KPI — 비활성 서브텍스트 */
    streakStartFresh: string;   // "오늘 다시 시작해보세요"
    kpiNoDataToday: string;     // "오늘 데이터 없음"
    kpiNotYet: string;           // "아직 시작 전"

    /** AI 분석 보고서 영역 (신규 미니멀 버전) */
    aiFeedbackSubtitleActive: string;   // "연주를 검토하고 다음 목표를 제안해드려요"
    aiFeedbackSubtitleNew: string;      // "연습을 시작하면 AI가 분석해드려요"
    aiFeedbackPremiumOnly: string;      // "🔒 프리미엄 전용"
  };
  checkout: {
    backHome: string;
    success: {
      title: string;
      subtitle: string;
      receiptNote: string;
      benefitsHeading: string;
      benefits: readonly string[];
      startCta: string;
      autoRedirect: string;
    };
    failed: {
      cancelledTitle: string;
      cancelledSubtitle: string;
      failedTitle: string;
      failedSubtitle: string;
      checkHeading: string;
      checkItems: readonly string[];
      retryCta: string;
      homeCta: string;
      supportPrefix: string;
      supportSuffix: string;
    };
  };
  levelSelect: {
    title: string;
    loading: string;
    passed: string;
    proBadge: string;
    achieved: string;          // "{n}" 치환
    aria: { proOnly: string; locked: string; select: string; passedReplay: string; inProgress: string };
    levels: { name: string; label: string }[];   // 길이 7
  };
  userMenu: {
    premiumActive: string;
    profile: string;
    dashboard: string;
    logout: string;
  };
}

const ko: Strings = {
  hero: {
    title: "보는 즉시,\n음악이 되다.",
    subtitle: "초견 훈련을 게임처럼.",
  },
  game: {
    start: "Play",
  },
  comingSoon: {
    badge: "🚀 2026년 5월 출시 예정",
    body: "정식 출시까지 마지막 다듬기 중입니다. 출시 알림을 원하시면 {email}으로 메일을 보내주세요.",
    blogButton: "📝 블로그 읽기",
  },
  header: {
    signIn: "로그인 / 회원가입",
    signOut: "로그아웃",
    profile: "프로필",
    dashboard: "대시보드",
    setNicknameHint: "닉네임 설정하기 →",
  },
  legal: {
    terms: "이용약관",
    privacy: "개인정보처리방침",
    refund: "환불 정책",
    cookies: "쿠키 정책",
    businessInfo: "사업자 정보",
    home: "← 홈으로",
    effectiveDate: "시행일:",
  },
  footer: {
    copyright: "© 2026 Donofear",
    pricing: "요금제",
    product: "서비스",
    company: "회사",
    support: "고객지원",
    legalSection: "법적 고지",
    about: "회사 소개",
    contact: "문의",
    faq: "자주 묻는 질문",
    blog: "블로그",
    companyName: "상호: Donofear",
    ceo: "대표자: 김용준",
    bizReg: "사업자 등록 번호: 367-45-01000",
    ecommerceReg: "통신판매업 신고: 제 2026-서울서초-1624호",
    address: "사업장 주소: 서울특별시 서초구 사임당로8길 13, 4층 402-L976호 (06640)",
    email: "이메일: contact@noteflex.app",
  },
  blog: {
    title: "블로그",
    subtitle: "악보 독보, 음악 학습, 그리고 Noteflex 이야기",
    home: "← 홈으로",
    all: "전체",
    empty: "아직 게시된 글이 없습니다.",
    backToList: "← 블로그 목록",
    loading: "불러오는 중...",
    notFound: "글을 찾을 수 없습니다",
    notFoundBody: "요청하신 글이 존재하지 않습니다.",
    backToBlog: "블로그 목록으로 돌아가기",
    adLabel: "광고",
    categories: [
      "all",
      "초견의 정석",
      "실전 연습 가이드",
      "음악 이론 & 화성학",
      "뮤직 테크 & 미래",
    ],
  },
  langToggle: {
    ko: "한국어",
    en: "English",
  },
  premiumDialog: {
    title: "✨ Pro 구독으로 전체 단계 해제",
    subtitle: "전체 21단계 · 상세 약점 분석 · 광고 제거",
    benefits: [
      "🎵 Lv 1-7 전체 21단계 이용",
      "📊 음표별 약점·마스터 분석",
      "🎯 개인화 출제 가중치",
      "✨ 광고 없는 집중 연습",
    ],
    cta: "프리미엄 혜택 보기 →",
    close: "닫기",
  },
  lockedByProgress: {
    title: "🔒 이전 단계를 먼저 완료하세요",
    subtitle: "Lv {requiredLevel}-{requiredSublevel}을 통과한 후 이 단계가 열립니다",
    description: "단계별 학습이 가장 효과적인 초견 훈련 방식입니다. 차근차근 진행하세요.",
    cta: "Lv {requiredLevel}-{requiredSublevel}로 이동 →",
    close: "닫기",
  },
  profile: {
    title: "프로필 설정",
    homeLink: "← 홈으로",
    accountSection: "계정 설정",
    nicknameLabel: "닉네임",
    nicknamePlaceholder: "3~20자, 영문 소문자/숫자/밑줄",
    nicknameChecking: "확인 중...",
    nicknameAvailable: "✅ 사용 가능한 닉네임입니다",
    nicknameTaken: "이미 사용 중인 닉네임입니다",
    nicknameSuggestions: "추천:",
    birthYearLabel: "생년월일 (선택)",
    nationalityLabel: "국적",
    languageLabel: "표시 언어",
    marketingConsent: "마케팅 정보 수신 동의",
    dirtyHint: "변경 사항이 있습니다. 저장 버튼을 눌러주세요.",
    saveButton: "저장",
    saving: "저장 중...",
    saveSuccess: "저장되었습니다",
    saveFailed: "저장 실패",
    nicknameDuplicate: "이미 사용 중인 닉네임이에요",
    nicknameDuplicateDesc: "다른 닉네임을 입력해주세요.",
    solfegeSection: "계이름 표기 방식",
    solfegeKorean: "한국어 계이름",
    solfegeEnglish: "영어 음이름",
    solfegeLatin: "라틴 계이름",
    solfegeApplied: "이 설정은 즉시 적용됩니다.",
    accountInfoSection: "계정 정보",
    accountInfoEmail: "이메일",
    accountInfoJoinedAt: "가입일",
    accountInfoSubscription: "구독 상태",
    accountInfoFree: "무료 플랜",
    signOutButton: "로그아웃",
    deleteSection: "회원 탈퇴",
    deleteDescription: "탈퇴 후 30일 내 복구가 가능합니다. 이후에는 모든 데이터가 삭제됩니다.",
    deleteButton: "회원 탈퇴",
    deleteConfirmTitle: "정말 탈퇴하시겠어요?",
    deleteConfirmDesc: "탈퇴 후 30일 내 복구 가능합니다.",
    deleteEmailSentTitle: "탈퇴 확인 메일을 보냈습니다",
    deleteReasonLabel: "탈퇴 사유 (선택)",
    deleteReasonNone: "선택 안 함",
    deleteReasons: ["사용 빈도 낮음", "서비스 불만", "개인정보 보호", "기타"],
    deleteSendButton: "탈퇴 확인 메일 보내기",
    deleteSending: "처리 중...",
    deleteEmailSentBody: "에 도착한 메일에서\n\"탈퇴 확인\" 링크를 클릭하면 탈퇴가 완료됩니다.",
    deleteRecoveryHint: "• 30일 내 같은 이메일로 가입 시 복구 가능합니다.",
    deleteCancel: "취소",
    deleteCloseModal: "닫기",
    deleteSendFailed: "전송 실패",
    manageSubscription: "구독 관리",
    manageSubscriptionLoading: "이동 중...",
  },
  adPlaceholder: {
    premium: {
      title: "프리미엄 무료 체험 — 7일",
      subtitle: "광고 X · 무제한 학습 · 자세한 통계",
      cta: "체험 시작",
    },
    blog: {
      readMore: "자세히 보기",
    },
  },
  dailyLimit: {
    guest: {
      title: "오늘은 여기까지.",
      values: [
        "매일 7회 무료 세션 (지금의 2배 이상)",
        "Lv1~Lv5 단계 이용 가능",
        "AI 분석 보고서로 약점 진단",
      ],
      cta: "무료로 가입하기",
      close: "닫기",
    },
    free: {
      title: "오늘 7회를 마치셨어요.",
      values: [
        "매일 무제한 세션",
        "21단계 모두 열림",
        "AI 풀 분석 — 약점 음표·학습 곡선·목표 추적",
        "광고 없는 집중 환경",
      ],
      pricing: "월 $2.99 · 연 $24.99 (30% 절약)",
      cta: "Premium 시작하기",
      close: "내일 다시",
    },
    countdown: "내일 reset까지: {hours}h {minutes}m",
  },
  diagnosis: {
    analyzing: "분석 중...",
    noRecordsTitle: "아직 기록이 없습니다",
    noRecordsHint: "게임을 플레이하면 자동으로 기록됩니다!",
    period7d: "최근 7일",
    period30d: "최근 30일",
    periodAll: "전체",
    kpiTotalQuestions: "총 문제",
    kpiAccuracy: "정답률",
    kpiCorrectCount: "정답 수",
    kpiAvgReaction: "평균 반응",
    vulnerabilityTitle: "취약점 분석",
    vulnerabilityLowest: "가장 낮은 정답률:",
    weakestNotesTitle: "😰 가장 약한 음표 Top 3",
    weakestNotesTooltip: "최근 200개 답변 기준 · 지금 세션의 경향을 반영합니다",
    slowestNotesTitle: "🐢 가장 느린 음표 Top 3",
    slowestNotesTooltip: "최근 200개 답변의 평균 반응 시간 기준",
    dailyAccuracyTitle: "📈 일별 정답률",
    reactionTrendTitle: "⏱ 평균 반응 시간 추이",
    chartNoData: "아직 데이터가 없어요",
    chartAvgLabel: "평균",
    chartMaxLabel: "최고",
    chartMinLabel: "최단",
    chartLatestLabel: "최근",
    secondsSuffix: "초",
    batchTitle: "🔬 공식 학습 분석",
    batchTooltip: "매일 자정 KST 기준 공식 판정 · 정답률과 반응 속도로 판정합니다",
    batchPending: "⏰ 아직 분석 데이터가 없어요. 내일 아침 06:00 (KST)에 첫 분석이 완료됩니다",
    batchLastAnalyzedAt: "⏰ 마지막 분석: {time}",
    batchLoading: "분석 데이터 불러오는 중...",
    batchError: "❌ 분석 데이터 로드 실패: {err}",
    batchEmpty: "아직 분석 데이터가 없어요. 더 많이 연습하면 약점/마스터가 자동으로 판정됩니다.",
    batchWeaknessHeading: "🔴 집중 훈련 필요 ({count})",
    batchNoWeakness: "아직 약점으로 판정된 음표가 없어요 🎉",
    batchMastersHeading: "🏆 마스터 완료 ({count})",
    batchNoMasters: "아직 마스터한 음표가 없어요. 95%+ 정답률 20회 이상 달성해보세요!",
    clefTreble: "높은음자리",
    clefBass: "낮은음자리",
    statAccuracy: "정답률 {pct}",
  },
  aiCoachingDetail: {
    fasterNotesTitle: "🚀 빨라진 음표",
    slowerNotesTitle: "🐢 느려진 음표",
    accuracyUpTitle: "🎯 정확도 ↑",
    accuracyDownTitle: "🎯 정확도 ↓",
    insufficientData: "이전 기록이 충분하지 않아 비교 분석은 다음 세션부터 나타납니다.",
    noteDeltaSeconds: "{note} ({sign}{delta}초)",
    noteDeltaPp: "{note} ({sign}{delta}%p)",
  },
  gameDialogs: {
    gameOverTitle: "😵 게임 오버 — {label}",
    gameOverDesc: "목숨이 다했어요. 다시 도전하거나 이전 단계로 돌아가서 연습할 수 있어요.",
    statAttempts: "시도",
    statAccuracy: "정답률",
    statBestStreak: "최고 연속",
    backToPrevious: "이전 단계로 ({label})",
    retrySameLevel: "같은 단계 다시 도전",
    fastTrackBadge: "🚀 패스트트랙",
    fastTrackAutoAdvance: "{n}초 후 자동 진입",
    fastTrackGoNow: "지금 바로 다음 단계",
    fastTrackLevelSelect: "레벨 선택",
    passedTitle: "🎉 {label} 통과!",
    clearTitle: "✅ {label} 클리어",
    passedDescNext: "축하해요! {nextLabel}이(가) 해제됐어요.",
    passedDescLast: "🏆 마지막 단계까지 통과했어요. 진짜 그랜드마스터!",
    clearDesc: "이번 판도 깔끔하게 클리어. 더 도전해볼래요?",
    backToSelect: "단계 선택으로",
    replaySameLevel: "같은 단계 한 번 더",
    nextLevelButton: "{nextLabel}로 →",
    pauseTitle: "일시정지",
    pauseBody: "지금 나가면 이번 판 진행은 저장되지 않고, 오늘 세션 1회는 그대로 차감돼요.",
    pauseResume: "계속하기",
    pauseExit: "레벨 선택으로",
    exitLabel: "나가기",
  },
  dashboard: {
    backToHome: "메인",
    libraryPreviewTitle: "📚 내 악보 (관리자 프리뷰)",
    libraryPreviewDesc: "공개 전 기능 확인용. 일반 사용자에게는 노출되지 않아요.",
    pageTitle: "대시보드",
    pageSubtitle: "오늘의 연습과 진행 영역",
    loading: "불러오는 중…",
    updating: "업데이트 중…",
    liveLastPractice: "실시간 · 마지막 연습",
    refresh: "새로고침",
    refreshSuccess: "최신 데이터로 업데이트했어요",
    dataError: "대시보드 데이터 불러오기 실패: {error}",
    currentStreak: "현재 스트릭",
    streakValueDays: "{n}일",
    streakTodayDone: "오늘 연습 완료 ✓",
    streakTodayContinues: "오늘 연습하면 이어져요",
    streakTodayFirst: "오늘 첫 연습을 시작해요",
    todayXp: "오늘 XP",
    totalXp: "총 {n} XP",
    league: "리그",
    leagueGroupRank: "그룹 {rank}위 · 주간 {xp} XP",
    leagueWeekly: "주간 {xp} XP",
    leagueAfterFirst: "첫 연습 후 배정",
    longestStreak: "최장 스트릭",
    bestRecord: "내 최고 기록",
    tabRhythm: "학습 리듬",
    tabDiagnosis: "실력 진단",
    tabActivity: "활동 기록",
    xpChartTitle: "XP 추이",
    xpRangeRecent7d: "최근 7일",
    xpRangeRecent30d: "최근 30일",
    xpRangeEarned: "{range} 획득 XP",
    xpRange7d: "7일",
    xpRange30d: "30일",
    xpEarnedLabel: "획득",
    noRecordWeek: "이번 주 기록이 없어요",
    noRecord30d: "최근 30일 기록이 없어요",
    accuracyReactionTitle: "정확도 · 반응속도 추이",
    accuracyReactionDesc: "최근 30일 일별 평균",
    accuracyAxis: "정확도 (%)",
    reactionAxis: "평균 반응속도 (ms)",
    accuracyTooltip: "정확도",
    avgTooltip: "평균",
    weakNotesTitle: "약점 음표 Top 10",
    weakNotesTooltip: "전체 게임 이력의 누적 정답률 기준 · 꾸준히 약했던 음표입니다",
    weakNotesDesc: "5회 이상 시도한 음표 중 정답률이 낮은 순",
    weakNotesInsufficient: "분석할 데이터가 충분하지 않아요",
    clefTreble: "높은음자리",
    clefBass: "낮은음자리",
    avgMs: "평균 {n}ms",
    aiFeedbackTitle: "AI 피드백",
    aiFeedbackDesc: "AI가 너의 연주를 보고 코멘트와 다음 목표를 제안해요",
    reportDailyLabel: "오늘의 코멘트",
    reportDailyPeriod: "매일 · 짧은 AI 피드백",
    reportWeeklyLabel: "이번 주 리포트",
    reportWeeklyPeriod: "주간 · 매주 월요일",
    reportMonthlyLabel: "월간 성장 리포트",
    reportMonthlyPeriod: "월간 · 매월 1일",
    reportComingSoon: "🤖 {label} 준비 중이에요",
    reportDailyDesc: "AI가 오늘 연주를 보고 짧은 코멘트를 남겨줄 거야.",
    reportNotDailyDesc: "AI가 너의 연주 패턴을 분석해줄 거야.",
    recentSessionsTitle: "최근 세션",
    recentSessionsDesc: "최대 20개",
    noSessions: "아직 세션 기록이 없어요",
    tableTime: "시각",
    tableLevel: "레벨",
    tableCorrectTotal: "정답/전체",
    tableAccuracy: "정확도",
    tableAvgReaction: "평균 반응",
    tableXp: "XP",
    aiReportLocked: "AI 분석 보고서",
    aiReportLockedSubtitle: "프리미엄에서 일간·주간·월간 AI 분석을 받아보세요.",
    dayLabels: ["일", "월", "화", "수", "목", "금", "토"],

    // ── 신규 미니멀 대시보드 영역 ───────────────
    emptyTodayTitle: "오늘은 아직 시작하지 않았어요",
    emptyTodaySubtitle: "스트릭 유지하려면 오늘 1회 연습해주세요",
    emptyTodayStreakHint: "오늘 연습하면 {n}일째 ✨",
    emptyTodayCta: "지금 시작 →",

    newUserTitle: "🎵 첫 세션을 시작해보세요",
    newUserSubtitle: "연습이 누적되면 약한 음표·진행 영역이 표시됩니다",
    newUserCta: "지금 시작하기 →",

    vsLast: "vs 최근",
    noLastSessionYet: "첫 세션 이후 표시",
    lastActivityTitle: "마지막 활동",
    lastActivityFormat: "{when} · 정답률 {acc} · 속도 {speed} · XP {xp}",
    daysAgo: "{n}일 전",
    yesterday: "어제",
    today: "오늘",
    streakStartFresh: "오늘 다시 시작해보세요",
    kpiNoDataToday: "오늘 데이터 없음",
    kpiNotYet: "아직 시작 전",

    aiFeedbackSubtitleActive: "연주를 검토하고 다음 목표를 제안해드려요",
    aiFeedbackSubtitleNew: "연습을 시작하면 AI가 분석해드려요",
    aiFeedbackPremiumOnly: "🔒 프리미엄 전용",
  },
  checkout: {
    backHome: "← 홈으로",
    success: {
      title: "결제가 완료되었습니다!",
      subtitle: "Noteflex Premium을 시작해보세요 🎹",
      receiptNote: "영수증은 이메일로 발송됩니다.",
      benefitsHeading: "🎁 이제 사용 가능한 기능",
      benefits: [
        "모든 레벨 (1~7) 무제한 이용",
        "광고 완전 제거",
        "상세 학습 통계 및 약점 분석",
      ],
      startCta: "🎹 시작하기",
      autoRedirect: "5초 후 자동으로 홈으로 이동합니다",
    },
    failed: {
      cancelledTitle: "결제가 취소되었어요",
      cancelledSubtitle: "언제든 다시 시도하실 수 있어요",
      failedTitle: "결제를 완료하지 못했어요",
      failedSubtitle: "일시적인 문제일 수 있으니 다시 시도해주세요",
      checkHeading: "💡 다음을 확인해주세요",
      checkItems: [
        "카드 정보가 정확한지 확인",
        "카드 한도 또는 해외 결제 가능 여부",
        "다른 카드로 다시 시도",
        "인터넷 연결 상태 확인",
      ],
      retryCta: "다시 결제하기",
      homeCta: "홈으로 돌아가기",
      supportPrefix: "문제가 계속되면 ",
      supportSuffix: "으로 문의해주세요",
    },
  },
  levelSelect: {
    title: "연습",
    loading: "진도 불러오는 중...",
    passed: "통과",
    proBadge: "PRO",
    achieved: "{n}/4 달성",
    aria: { proOnly: "Pro 전용", locked: "잠금", select: "선택", passedReplay: "통과 (재플레이 가능)", inProgress: "진행 중" },
    levels: [
      { name: "첫걸음", label: "높은음자리표 (C4–C6)" },
      { name: "입문",   label: "낮은음자리표 (C2–C4)" },
      { name: "초급",   label: "고급 높은음자리표" },
      { name: "중급",   label: "고급 낮은음자리표" },
      { name: "고급",   label: "샵 마스터리 (♯)" },
      { name: "전문가", label: "플랫 마스터리 (♭)" },
      { name: "마스터", label: "마스터 믹스 (♯♭)" },
    ],
  },
  userMenu: {
    premiumActive: "프리미엄 이용중",
    profile: "프로필 수정",
    dashboard: "대시보드",
    logout: "로그아웃",
  },
};

const en: Strings = {
  hero: {
    title: "See it.\nPlay it.",
    subtitle: "Sight-reading, gamified.",
  },
  game: {
    start: "Play",
  },
  comingSoon: {
    badge: "🚀 Launching May 2026",
    body: "Final polishing before official launch. For launch notifications, email {email}.",
    blogButton: "📝 Read Blog",
  },
  header: {
    signIn: "Sign In / Sign Up",
    signOut: "Sign Out",
    profile: "Profile",
    dashboard: "Dashboard",
    setNicknameHint: "Set your nickname →",
  },
  legal: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    refund: "Refund Policy",
    cookies: "Cookie Policy",
    businessInfo: "Business Information",
    home: "← Home",
    effectiveDate: "Effective:",
  },
  footer: {
    copyright: "© 2026 Donofear",
    pricing: "Pricing",
    product: "Product",
    company: "Company",
    support: "Support",
    legalSection: "Legal",
    about: "About",
    contact: "Contact",
    faq: "FAQ",
    blog: "Blog",
    companyName: "Company: Donofear",
    ceo: "CEO: Kim Yongjun",
    bizReg: "Business Reg.: 367-45-01000",
    ecommerceReg: "E-commerce Reg.: 제 2026-서울서초-1624호",
    address: "Address: 13 Saimdang-ro 8-gil, 4F Unit 402-L976, Seocho-gu, Seoul 06640, South Korea",
    email: "Email: contact@noteflex.app",
  },
  blog: {
    title: "Blog",
    subtitle: "Sight-reading, music learning, and Noteflex stories",
    home: "← Home",
    all: "All",
    empty: "No posts yet.",
    backToList: "← Blog",
    loading: "Loading...",
    notFound: "Post not found",
    notFoundBody: "The requested post does not exist.",
    backToBlog: "Back to blog",
    adLabel: "Ad",
    categories: [
      "all",
      "Sight-Reading Lab",
      "Practice Hub",
      "Theory & Harmony",
      "Music Tech",
    ],
  },
  langToggle: {
    ko: "한국어",
    en: "English",
  },
  premiumDialog: {
    title: "✨ Unlock All Levels with Pro",
    subtitle: "All 21 levels · Detailed weakness analysis · Ad-free",
    benefits: [
      "🎵 Access all 21 levels (Lv 1-7)",
      "📊 Per-note weakness & mastery analytics",
      "🎯 Personalized practice weighting",
      "✨ Distraction-free, ad-free experience",
    ],
    cta: "View Premium Benefits →",
    close: "Close",
  },
  lockedByProgress: {
    title: "🔒 Complete previous stage first",
    subtitle: "Pass Lv {requiredLevel}-{requiredSublevel} to unlock this stage",
    description: "Sequential practice is the most effective way to build sight-reading skills. Take it step by step.",
    cta: "Go to Lv {requiredLevel}-{requiredSublevel} →",
    close: "Close",
  },
  profile: {
    title: "Profile Settings",
    homeLink: "← Home",
    accountSection: "Account Settings",
    nicknameLabel: "Nickname",
    nicknamePlaceholder: "3–20 chars, lowercase letters/digits/underscore",
    nicknameChecking: "Checking...",
    nicknameAvailable: "✅ Nickname available",
    nicknameTaken: "This nickname is already taken",
    nicknameSuggestions: "Suggestions:",
    birthYearLabel: "Date of Birth (Optional)",
    nationalityLabel: "Nationality",
    languageLabel: "Display Language",
    marketingConsent: "I agree to receive marketing communications",
    dirtyHint: "You have unsaved changes. Please click Save.",
    saveButton: "Save",
    saving: "Saving...",
    saveSuccess: "Saved",
    saveFailed: "Save failed",
    nicknameDuplicate: "Nickname already in use",
    nicknameDuplicateDesc: "Please enter a different nickname.",
    solfegeSection: "Solfège Notation",
    solfegeKorean: "Korean Solfège",
    solfegeEnglish: "English Letter Names",
    solfegeLatin: "Latin Solfège",
    solfegeApplied: "This setting applies immediately.",
    accountInfoSection: "Account Information",
    accountInfoEmail: "Email",
    accountInfoJoinedAt: "Joined",
    accountInfoSubscription: "Subscription",
    accountInfoFree: "Free plan",
    signOutButton: "Sign Out",
    deleteSection: "Delete Account",
    deleteDescription: "You can recover your account within 30 days after deletion. After that, all data is permanently removed.",
    deleteButton: "Delete Account",
    deleteConfirmTitle: "Are you sure you want to delete?",
    deleteConfirmDesc: "Recovery is available within 30 days.",
    deleteEmailSentTitle: "Deletion confirmation email sent",
    deleteReasonLabel: "Reason (optional)",
    deleteReasonNone: "Not specified",
    deleteReasons: ["Low usage", "Service dissatisfaction", "Privacy concerns", "Other"],
    deleteSendButton: "Send deletion confirmation email",
    deleteSending: "Sending...",
    deleteEmailSentBody: "We sent an email — click the \"Confirm deletion\" link to complete.",
    deleteRecoveryHint: "• You can recover the account by signing up with the same email within 30 days.",
    deleteCancel: "Cancel",
    deleteCloseModal: "Close",
    deleteSendFailed: "Failed to send",
    manageSubscription: "Manage Subscription",
    manageSubscriptionLoading: "Loading...",
  },
  adPlaceholder: {
    premium: {
      title: "Try Premium — 7 days free",
      subtitle: "Ad-free · Unlimited practice · Detailed stats",
      cta: "Start trial",
    },
    blog: {
      readMore: "Read more",
    },
  },
  dailyLimit: {
    guest: {
      title: "That's it for today.",
      values: [
        "7 free sessions daily (more than 2× now)",
        "Access Lv1 through Lv5",
        "AI analysis pinpoints your weak notes",
      ],
      cta: "Sign up — free",
      close: "Close",
    },
    free: {
      title: "You've finished today's seven.",
      values: [
        "Unlimited daily sessions",
        "All 21 stages unlocked",
        "Full AI analysis — weak notes, progress curve, goals",
        "Ad-free focus",
      ],
      pricing: "$2.99/mo · $24.99/yr (save 30%)",
      cta: "Start Premium",
      close: "Try tomorrow",
    },
    countdown: "Resets in: {hours}h {minutes}m",
  },
  diagnosis: {
    analyzing: "Analyzing...",
    noRecordsTitle: "No records yet",
    noRecordsHint: "Playing the game automatically saves your records!",
    period7d: "Last 7 days",
    period30d: "Last 30 days",
    periodAll: "All time",
    kpiTotalQuestions: "Total questions",
    kpiAccuracy: "Accuracy",
    kpiCorrectCount: "Correct",
    kpiAvgReaction: "Avg reaction",
    vulnerabilityTitle: "Vulnerability analysis",
    vulnerabilityLowest: "Lowest accuracy:",
    weakestNotesTitle: "😰 Weakest Notes — Top 3",
    weakestNotesTooltip: "Based on last 200 answers · reflects current session trends",
    slowestNotesTitle: "🐢 Slowest Notes — Top 3",
    slowestNotesTooltip: "Based on average reaction time of last 200 answers",
    dailyAccuracyTitle: "📈 Daily accuracy",
    reactionTrendTitle: "⏱ Avg reaction time trend",
    chartNoData: "No data yet",
    chartAvgLabel: "Avg",
    chartMaxLabel: "Max",
    chartMinLabel: "Best",
    chartLatestLabel: "Latest",
    secondsSuffix: "s",
    batchTitle: "🔬 Formal Learning Analysis",
    batchTooltip: "Official daily evaluation at midnight KST · based on accuracy and reaction speed",
    batchPending: "⏰ No analysis data yet. First analysis completes tomorrow at 06:00 (KST).",
    batchLastAnalyzedAt: "⏰ Last analyzed: {time}",
    batchLoading: "Loading analysis data...",
    batchError: "❌ Failed to load analysis: {err}",
    batchEmpty: "No analysis data yet. Practice more and weaknesses/masters will be auto-detected.",
    batchWeaknessHeading: "🔴 Needs focused practice ({count})",
    batchNoWeakness: "No notes flagged as weakness yet 🎉",
    batchMastersHeading: "🏆 Mastered ({count})",
    batchNoMasters: "No mastered notes yet. Reach 95%+ accuracy over 20+ attempts!",
    clefTreble: "Treble",
    clefBass: "Bass",
    statAccuracy: "Accuracy {pct}",
  },
  aiCoachingDetail: {
    fasterNotesTitle: "🚀 Faster notes",
    slowerNotesTitle: "🐢 Slower notes",
    accuracyUpTitle: "🎯 Accuracy up",
    accuracyDownTitle: "🎯 Accuracy down",
    insufficientData: "Not enough prior data yet — note-level comparison starts next session.",
    noteDeltaSeconds: "{note} ({sign}{delta}s)",
    noteDeltaPp: "{note} ({sign}{delta}%p)",
  },
  gameDialogs: {
    gameOverTitle: "😵 Game Over — {label}",
    gameOverDesc: "You ran out of lives. Try again or go back to a previous stage to practice.",
    statAttempts: "Attempts",
    statAccuracy: "Accuracy",
    statBestStreak: "Best streak",
    backToPrevious: "Back to {label}",
    retrySameLevel: "Retry this stage",
    fastTrackBadge: "🚀 Fast Track",
    fastTrackAutoAdvance: "Auto-advance in {n}s",
    fastTrackGoNow: "Next stage now",
    fastTrackLevelSelect: "Level select",
    passedTitle: "🎉 {label} cleared!",
    clearTitle: "✅ {label} clear",
    passedDescNext: "Nice work! {nextLabel} is now unlocked.",
    passedDescLast: "🏆 You completed the final stage. A true grandmaster!",
    clearDesc: "Clean clear again. Ready for another challenge?",
    backToSelect: "Back to level select",
    replaySameLevel: "Play this stage again",
    nextLevelButton: "{nextLabel} →",
    pauseTitle: "Paused",
    pauseBody: "Leaving now discards this round's progress, and today's session still counts as used.",
    pauseResume: "Resume",
    pauseExit: "Exit to levels",
    exitLabel: "Exit",
  },
  dashboard: {
    backToHome: "Home",
    libraryPreviewTitle: "📚 My Sheets (Admin preview)",
    libraryPreviewDesc: "Pre-release feature check. Not visible to regular users.",
    pageTitle: "Dashboard",
    pageSubtitle: "Today's practice and progress",
    loading: "Loading…",
    updating: "Updating…",
    liveLastPractice: "Live · Last practice",
    refresh: "Refresh",
    refreshSuccess: "Updated with the latest data",
    dataError: "Failed to load dashboard data: {error}",
    currentStreak: "Current Streak",
    streakValueDays: "{n} days",
    streakTodayDone: "Today's practice done ✓",
    streakTodayContinues: "Practice today to keep the streak",
    streakTodayFirst: "Start your first practice today",
    todayXp: "Today XP",
    totalXp: "Total {n} XP",
    league: "League",
    leagueGroupRank: "Group #{rank} · Weekly {xp} XP",
    leagueWeekly: "Weekly {xp} XP",
    leagueAfterFirst: "Assigned after first practice",
    longestStreak: "Longest Streak",
    bestRecord: "Personal best",
    tabRhythm: "Rhythm",
    tabDiagnosis: "Diagnosis",
    tabActivity: "Activity",
    xpChartTitle: "XP Trend",
    xpRangeRecent7d: "Last 7 days",
    xpRangeRecent30d: "Last 30 days",
    xpRangeEarned: "{range} XP earned",
    xpRange7d: "7d",
    xpRange30d: "30d",
    xpEarnedLabel: "Earned",
    noRecordWeek: "No records this week",
    noRecord30d: "No records in the last 30 days",
    accuracyReactionTitle: "Accuracy · Reaction Trend",
    accuracyReactionDesc: "Daily averages, last 30 days",
    accuracyAxis: "Accuracy (%)",
    reactionAxis: "Avg reaction time (ms)",
    accuracyTooltip: "Accuracy",
    avgTooltip: "Avg",
    weakNotesTitle: "Weakest Notes — Top 10",
    weakNotesTooltip: "By cumulative accuracy across all game history · consistently weak notes",
    weakNotesDesc: "Lowest accuracy among notes with 5+ attempts",
    weakNotesInsufficient: "Not enough data to analyze",
    clefTreble: "Treble",
    clefBass: "Bass",
    avgMs: "Avg {n}ms",
    aiFeedbackTitle: "AI Feedback",
    aiFeedbackDesc: "AI reviews your playing and suggests comments and next goals",
    reportDailyLabel: "Today's Comment",
    reportDailyPeriod: "Daily · Short AI feedback",
    reportWeeklyLabel: "Weekly Report",
    reportWeeklyPeriod: "Weekly · Every Monday",
    reportMonthlyLabel: "Monthly Growth Report",
    reportMonthlyPeriod: "Monthly · 1st of each month",
    reportComingSoon: "🤖 {label} coming soon",
    reportDailyDesc: "AI will leave a short comment on today's playing.",
    reportNotDailyDesc: "AI will analyze your playing patterns.",
    recentSessionsTitle: "Recent Sessions",
    recentSessionsDesc: "Up to 20",
    noSessions: "No session records yet",
    tableTime: "Time",
    tableLevel: "Level",
    tableCorrectTotal: "Correct/Total",
    tableAccuracy: "Accuracy",
    tableAvgReaction: "Avg reaction",
    tableXp: "XP",
    aiReportLocked: "AI Analytics Report",
    aiReportLockedSubtitle: "Unlock daily, weekly, and monthly AI analytics with Premium.",
    dayLabels: ["S", "M", "T", "W", "T", "F", "S"],

    // ── New minimal dashboard ───────────────────
    emptyTodayTitle: "You haven't started today yet",
    emptyTodaySubtitle: "Practice once today to keep your streak",
    emptyTodayStreakHint: "Practice today to make it day {n} ✨",
    emptyTodayCta: "Start now →",

    newUserTitle: "🎵 Start your first session",
    newUserSubtitle: "Stats appear here as you practice",
    newUserCta: "Start now →",

    vsLast: "vs Last session",
    noLastSessionYet: "Shown after first session",
    lastActivityTitle: "Last activity",
    lastActivityFormat: "{when} · Acc {acc} · Speed {speed} · XP {xp}",
    daysAgo: "{n} days ago",
    yesterday: "Yesterday",
    today: "Today",
    streakStartFresh: "Start fresh today",
    kpiNoDataToday: "No data today",
    kpiNotYet: "Not yet started",

    aiFeedbackSubtitleActive: "AI reviews your playing and suggests next goals",
    aiFeedbackSubtitleNew: "Practice and AI will analyze your patterns",
    aiFeedbackPremiumOnly: "🔒 Premium only",
  },
  checkout: {
    backHome: "← Home",
    success: {
      title: "Payment Successful!",
      subtitle: "Start using Noteflex Premium 🎹",
      receiptNote: "Your receipt will be sent to your email.",
      benefitsHeading: "🎁 Features now available",
      benefits: [
        "Unlimited access to all levels (1~7)",
        "Ad-free experience",
        "Detailed learning analytics and weakness analysis",
      ],
      startCta: "🎹 Get Started",
      autoRedirect: "Redirecting to home in 5 seconds",
    },
    failed: {
      cancelledTitle: "Payment Cancelled",
      cancelledSubtitle: "You can try again anytime",
      failedTitle: "Payment Failed",
      failedSubtitle: "This may be temporary. Please try again.",
      checkHeading: "💡 Please check the following",
      checkItems: [
        "Verify your card details",
        "Check card limit or international payment availability",
        "Try with a different card",
        "Check your internet connection",
      ],
      retryCta: "Try Again",
      homeCta: "Back to Home",
      supportPrefix: "If the problem persists, contact ",
      supportSuffix: "",
    },
  },
  levelSelect: {
    title: "Practice",
    loading: "Loading progress...",
    passed: "Passed",
    proBadge: "PRO",
    achieved: "{n}/4 done",
    aria: { proOnly: "Pro only", locked: "Locked", select: "Select", passedReplay: "Passed (replay available)", inProgress: "In progress" },
    levels: [
      { name: "Novice",       label: "Treble clef (C4–C6)" },
      { name: "Beginner",     label: "Bass clef (C2–C4)" },
      { name: "Elementary",   label: "Advanced treble" },
      { name: "Intermediate", label: "Advanced bass" },
      { name: "Advanced",     label: "Sharp mastery (♯)" },
      { name: "Expert",       label: "Flat mastery (♭)" },
      { name: "Master",       label: "Master mix (♯♭)" },
    ],
  },
  userMenu: {
    premiumActive: "Premium member",
    profile: "Edit profile",
    dashboard: "Dashboard",
    logout: "Log out",
  },
};

// TODO(i18n-phase-3): 일본어·중국어 번역 추가
const ja: Strings = en;
const zh: Strings = en;

const STRINGS: Record<Lang, Strings> = { ko, en, ja, zh };

export function getStrings(lang: Lang): Strings {
  return STRINGS[lang] ?? en;
}

/** "{email}" placeholder를 실제 값으로 치환. */
export function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{${key}}`
  );
}
