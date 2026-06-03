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
    gameOver: string;
    scoreLabel: string;
    xpEarned: string;
    tryAgain: string;
    backToHome: string;
    finalStage: string;
    notesSequential: string;
    notesSimultaneous: string;
    setProgress: string;
    questionOfTotal: string;
    question: string;
    listenAgain: string;
    answerHint: string;
    showAnswerDev: string;
    answerAlert: string;
    ariaNoteInput: string;
    ariaSelectNote: string;
    countdownStarting: string;
    countdownAria: string;
    errorTitle: string;
    errorBody: string;
    errorRetry: string;
    errorHome: string;
  };
  premiumRequired: {
    title: string;
    bodyLevel: string;
    body: string;
    benefitsTitle: string;
    benefitAllLevels: string;
    benefitWeakNotes: string;
    benefitAdFree: string;
    price: string;
    cancel: string;
    subscribe: string;
  };
  comingSoon: {
    badge: string;
    /** {email} placeholder 포함 */
    body: string;
    blogButton: string;
  };
  updateBanner: {
    message: string;
    action: string;
  };
  header: {
    signIn: string;
    mainNav: string;
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
  blogCta: {
    /** 8 main hook lines, indexed in parallel with `subs` */
    mains: readonly string[];
    /** 8 sub lines (empty string = no sub line rendered) */
    subs: readonly string[];
    buttonLabel: string;
  };
  notFoundPage: {
    headline: string;     // "음표가 길을 잃었어요" / "This note got lost"
    body: string;         // "찾으시는 페이지가 없습니다" / "The page you're looking for isn't here"
    backHome: string;     // "메인으로" / "Back to home"
    playGame: string;     // "게임 시작" / "Play game"
  };
  pageMeta: {
    // 2026-06-02 — 누락 6 페이지 Seo 보강. 사용자 영역은 noindex 적용.
    notFound: { title: string; description: string };
    dashboard: { title: string; description: string };
    play: { title: string; description: string };
    profile: { title: string; description: string };
    checkoutSuccess: { title: string; description: string };
    checkoutFailed: { title: string; description: string };
  };
  feedback: {
    // FAB
    fabLabel: string;          // "한 마디" / "Drop a note"
    fabAriaLabel: string;      // 접근성용 long label
    // Dialog
    dialogTitle: string;       // "한 마디 남겨주세요" / "Drop a note"
    dialogSubtitle: string;    // "버그·개선 사항·..." / "Bugs, ideas, anything..."
    messagePlaceholder: string;
    emailPlaceholder: string;
    counter: string;           // "{n} / 500"
    minHint: string;           // "최소 5자" / "Min 5 characters"
    submit: string;            // "보내기" / "Send"
    submitting: string;        // "보내는 중..." / "Sending..."
    cancel: string;            // "취소" / "Cancel"
    // Toasts
    toastSuccess: string;      // "감사합니다 — 잘 받았습니다" / "Thanks — got it"
    toastError: string;        // "전송 실패 — 잠시 후 다시 시도해주세요" / "Send failed — please retry"
    toastTooShort: string;     // "최소 5자 이상 적어주세요" / "Please write at least 5 characters"
    toastInvalidEmail: string; // "이메일 형식을 확인해주세요" / "Please check email format"
  };
  langToggle: {
    ko: string;
    en: string;
  };
  authModal: {
    // Login mode
    loginTitle: string;
    loginSubtitle: string;
    loginEmailPlaceholder: string;
    loginSubmit: string;
    loginEmailNotFound: string;
    loginEmailNotFoundCta: string;
    smtpNoticeLogin: string;
    // Signup mode
    signupTitle: string;
    signupSubtitle: string;
    signupStep1: string;
    signupStep2: string;
    signupEmailPlaceholder: string;
    signupSubmit: string;
    signupEmailExists: string;
    signupEmailHardDeleted: string;
    signupEmailExistsCta: string;
    smtpNoticeSignup: string;
    giftHeadline: string;
    giftBullet1: string;
    giftBullet2: string;
    giftBullet3: string;
    // Common
    googleContinue: string;
    orDivider: string;
    closeButton: string;
    submitProcessing: string;
    submitSending: string;
    submitWorking: string;
    loginPrompt: string;
    signupPrompt: string;
    loginLink: string;
    signupLink: string;
    // ToS
    tosRequiredLabel: string;
    tosOptionalLabel: string;
    tosBodyBefore: string;
    tosTermsLink: string;
    tosPrivacyLink: string;
    tosSeparator: string;
    tosBodyAfter: string;
    marketingText: string;
    // Step 2 magic link
    magicLinkTitle: string;
    magicLinkSentPre: string;
    magicLinkSentPost: string;
    magicLinkActionLogin: string;
    magicLinkActionSignup: string;
    magicLinkActionRecover: string;
    magicLinkActionBody: string;
    magicLinkSpamHint: string;
    magicLinkWaiting: string;
    magicLinkResend: string;
    magicLinkResendCooldown: string;
    magicLinkBackEmail: string;
    // Step 3 recovery
    recoveryTitle: string;
    recoveryBodyPre: string;
    recoveryBodyMid: string;
    recoveryBodyDays: string;
    recoveryAction: string;
    recoveryActionSending: string;
    freshStartButton: string;
    freshStartConfirmTitle: string;
    freshStartConfirmBody: string;
    freshStartConfirmYes: string;
    freshStartBack: string;
    recoveryCancel: string;
    // Toasts
    toastTosRequired: string;
    toastEmailInvalid: string;
    toastGoogleFailed: string;
    toastGenericError: string;
    toastResendSent: string;
    toastResendSentDesc: string;
    toastResendFailed: string;
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
    /** "n={n}" — 표본 수 표시 */
    attemptsCountFormat: string;
    /** "⏱ 시간초과" — 평균이 timeLimit 근처일 때 */
    timeoutLabel: string;
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
    statAvgReaction: string;     // "평균 반응" / "Avg response"
    backToPrevious: string;      // "이전 단계로 ({label})"
    retrySameLevel: string;
    // 5/31 디자인 리뉴얼 — 트렌드·variant·음표 분석
    variantPassed: string;       // "통과" / "Passed"
    variantFailed: string;       // "실패" / "Failed"
    vsAvgUp: string;             // "+{n}%p vs 평균" / "+{n}%p vs avg"
    vsAvgDown: string;           // "-{n}%p vs 평균" / "-{n}%p vs avg"
    vsAvgFlat: string;           // "평소 수준 vs 평균" / "On par with avg"
    noteAnalysisTitle: string;   // "음표별 분석 · 최근 30회" / "Note analysis · Recent 30"
    noteAnalysisEmpty: string;   // "수치가 부족합니다. ..." / "Not enough data yet. ..."
    // 6/01 비가입자 teaser (NoteAnalysisSection이 guest일 때 노출)
    guestTeaserTitle: string;    // "음표별 분석" / "Note breakdown"
    guestTeaserPrompt: string;   // "음표별 분석을 보려면 로그인하세요" / "Sign up to see note breakdown"
    guestTeaserCta: string;      // "5초만에 시작" / "Sign up — 5 seconds"
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
  accidentalTutorial: {
    title: string;
    intro: string;
    sharpTitle: string;
    sharpDesc: string;
    flatTitle: string;
    flatDesc: string;
    naturalTitle: string;
    naturalDesc: string;
    confirm: string;
    dontShowAgain: string;
    ariaLabel: string;
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
    emptyTodayStreakHint: string;   // "오늘 달성하면 {n}일째" placeholder
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

    /** "다음 한 걸음" 카드 (B 맥락 → A 후킹 → C 성취 세로 위계) */
    nextStepEyebrow: string;             // "다음 한 걸음"
    /** B — 레벨/서브레벨 진행 */
    nextStepCurrentLabel: string;        // "Lv {level}-{sublevel}" placeholder
    nextStepPlayProgress: string;        // "플레이 {current}/{target}" placeholder
    nextStepStreakChip: string;          // "연속 {n}/5" placeholder
    nextStepAccuracyChip: string;        // "정확도 {pct}%" placeholder
    nextStepAllPassed: string;           // "모든 단계 통과 — 마스터!"
    /** B — 통과 상태 표시 */
    nextStepStatusInProgress: string;    // "진행 중"
    nextStepStatusReady: string;         // "통과 준비 완료"
    nextStepGapPrefix: string;           // "통과까지: "
    nextStepGapPlay: string;             // "플레이 {n}회" / "{n} more plays"
    nextStepGapStreak: string;           // "연속 +{n}" / "Streak +{n}"
    nextStepGapAccuracy: string;         // "정확도 +{n}%p" / "Accuracy +{n}%p"
    /** A — 후킹 핵심 (졸업 임박 / 가장 진전된 약점 / 약점 없음) */
    nextStepGradHook: string;            // "{clef} {note} — 졸업 임박 🎓" placeholder (legacy)
    nextStepGradProgress: string;        // "({current}/{target})" placeholder (legacy)
    nextStepWeakHook: string;            // "{clef} {note} 연습 중" placeholder (legacy)
    nextStepWeakSubtitle: string;        // "가장 진전된 약점" (legacy)
    /** A — 큰 음표명 라벨 + 진행 분기별 부제 */
    nextStepAClefNote: string;           // "{clef} {note}" placeholder (예: "높은음 B4")
    nextStepASubHigh: string;            // "졸업 임박 🎓" (16+/19)
    nextStepASubMid: string;             // "거의 다 왔어요" (10–15/19)
    nextStepASubLow: string;             // "마스터하는 중" (<10/19)
    nextStepAProgressLabel: string;      // "{current}/{target}" — 큰 음표 옆 진행 분수
    nextStepNoneTitle: string;           // "약점 없음 — 새 레벨에 도전 🚀"
    nextStepNoneSubtitle: string;        // "지금까지 약점으로 분류된 음표가 없어요"
    nextStepLearningTitle: string;       // "데이터 누적 중"
    nextStepLearningSubtitle: string;    // "몇 번 더 연습하면 다음 목표가 보여요"
    /** C — 성취 (이번 주 졸업·약점 남음) */
    nextStepFootGraduated: string;       // "이번 주 졸업 {n}" placeholder
    nextStepFootWeakness: string;        // "약점 {n} 남음" placeholder
    nextStepFootGradZero: string;        // "이번 주 첫 졸업을 노려봐요 🎯"
    nextStepFootEmpty: string;           // "분석 데이터 누적 중"
    /** 두 박스 구조 (v3) */
    nextStepFocusBoxTitle: string;       // "이 음에 집중"
    nextStepNeedsBoxTitle: string;       // "연습이 필요한 음"
    nextStepMasteredBoxTitle: string;    // "마스터한 음"
    nextStepTooltipBody: string;         // "최근 20번 중 {current}번 정답..." placeholder
    nextStepGoalMarker: string;          // "목표"
    nextStepBatchUpdatedHoursAgo: string;// "{n}시간 전 갱신" placeholder
    nextStepBatchUpdatedJustNow: string; // "방금 전 갱신"
    nextStepBatchUpdatedDaysAgo: string; // "{n}일 전 갱신" placeholder
    nextStepNoNeedsPractice: string;     // "약점 없음 ✓"
    nextStepNoMastered: string;          // "아직 마스터한 음 없음"
    nextStepGradCorrectSuffix: string;   // "번 정답" / "correct"
  };
  analytics: {
    // 페이지 제목·부제
    dailyTitle: string;
    dailySubtitle: string;
    weeklyTitle: string;
    weeklySubtitle: string;
    monthlyTitle: string;
    monthlySubtitle: string;
    // 네비게이션 카드
    nextReport: string;
    backToDaily: string;
    backToWeekly: string;
    toWeeklyLabel: string;
    toWeeklyDesc: string;
    /** {clef} {note} placeholders */
    toWeeklyHook: string;
    toMonthlyLabel: string;
    toMonthlyDesc: string;
    // Placeholder (Pro, 준비 중)
    weeklyPlaceholderTitle: string;
    weeklyPlaceholderDesc: string;
    monthlyPlaceholderTitle: string;
    monthlyPlaceholderDesc: string;
    // Pro 잠금 화면
    proLockSuffix: string;
    proLockBody: string;
    proLockCta: string;
    // DailyReport 상태
    graceTitle: string;
    graceBody: string;
    graceCta: string;
    errorTitle: string;
    errorRetry: string;
    // DailyReport 콘텐츠
    headlineEyebrow: string;
    /** {note} placeholder */
    headlineWeak: string;
    headlineClean: string;
    /** {n} placeholder */
    streakBadge: string;
    metricAccuracy: string;
    metricAvgReaction: string;
    metricTotalAttempts: string;
    /** {n} placeholder */
    metricSessions: string;
    deltaVsBaseline: string;
    weakNotesTitle: string;
    sessionsTitle: string;
    sessionAccLabel: string;
    sessionSpeedLabel: string;
    sessionAttemptsLabel: string;
    // 클레프 짧은 라벨 (WeakNoteChip · DailyReport)
    clefTreble: string;
    clefBass: string;
    // WeakNoteChip tooltip
    chipErrorRateLabel: string;
    chipAttemptsUnit: string;
    // PeriodReport (주간·월간 공용)
    periodWeeklyEyebrow: string;
    periodMonthlyEyebrow: string;
    /** {note} placeholder */
    periodWeeklyHeadlineWeak: string;
    periodWeeklyHeadlineClean: string;
    /** {note} placeholder */
    periodMonthlyHeadlineWeak: string;
    periodMonthlyHeadlineClean: string;
    periodWeeklyWeakNotesTitle: string;
    periodMonthlyWeakNotesTitle: string;
    /** {n} placeholder */
    periodActiveDays: string;
    /** {n} placeholder */
    periodGraduated: string;
    /** {n} placeholder */
    periodRegressed: string;
    periodNoData: string;
    periodWeeklyNoDataHint: string;
    periodMonthlyNoDataHint: string;
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
    gameOver: "게임 오버",
    scoreLabel: "정답 수:",
    xpEarned: "+{xp} XP 획득!",
    tryAgain: "다시 도전해 주세요!",
    backToHome: "메인으로 돌아가기 🔥",
    finalStage: "마무리 단계 — {n}개 남음",
    notesSequential: "음표 {n}개 순차",
    notesSimultaneous: "음표 {n}개 동시",
    setProgress: "({cur}/{total} 세트)",
    questionOfTotal: "{a}/{b}번째 음표의 이름은?",
    question: "{a}번째 음표의 이름은?",
    listenAgain: "🔊 다시 듣기",
    answerHint: "💡 정답: {ans}",
    showAnswerDev: "💡 정답 보기 (DEV)",
    answerAlert: "정답: {ans}",
    ariaNoteInput: "음표 정답 입력",
    ariaSelectNote: "{label} 선택",
    countdownStarting: "곧 시작합니다",
    countdownAria: "{count}초 뒤 시작",
    errorTitle: "게임 중 문제가 발생했습니다",
    errorBody: "잠시 후 다시 시도해주세요. 게임 데이터는 안전합니다.",
    errorRetry: "다시 시도",
    errorHome: "홈으로",
  },
  premiumRequired: {
    title: "Premium 전용 레벨",
    bodyLevel: "Level {n}은 Premium 구독자만 이용할 수 있어요.",
    body: "이 레벨은 Premium 구독자만 이용할 수 있어요.",
    benefitsTitle: "Premium 혜택",
    benefitAllLevels: "모든 레벨 잠금 해제 (Lv1 ~ Lv7)",
    benefitWeakNotes: "상세 약점 분석",
    benefitAdFree: "광고 없이 학습 집중",
    price: "연간 $39.99 · Save 33%",
    cancel: "취소",
    subscribe: "구독하러 가기 →",
  },
  comingSoon: {
    badge: "🚀 2026년 6월 출시 예정",
    body: "정식 출시까지 마지막 다듬기 중입니다. 출시 알림을 원하시면 {email}으로 메일을 보내주세요.",
    blogButton: "📝 블로그 읽기",
  },
  updateBanner: {
    message: "새 버전이 있어요",
    action: "새로고침",
  },
  header: {
    signIn: "로그인 / 회원가입",
    signOut: "로그아웃",
    profile: "프로필",
    dashboard: "대시보드",
    setNicknameHint: "닉네임 설정하기 →",
    mainNav: "주 메뉴",
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
    copyright: "© 2026 Donofear. All rights reserved.",
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
  blogCta: {
    mains: [
      "여기서 멈추지 마세요.",
      "지금 한 판 해볼까요?",
      "읽는 것과 익히는 건 다릅니다.",
      "5초 안에 첫 음을 맞춰보세요.",
      "음표가 당신을 기다려요.",
      "딱 한 판. 진짜요.",
      "안 해보면 모릅니다.",
      "5초면 끝나요.",
    ],
    subs: [
      "직접 해보면 다릅니다.",
      "1분이면 충분합니다.",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    buttonLabel: "Play →",
  },
  notFoundPage: {
    headline: "음표가 길을 잃었어요",
    body: "찾으시는 페이지가 없습니다",
    backHome: "메인으로",
    playGame: "게임 시작",
  },
  pageMeta: {
    notFound: {
      title: "페이지를 찾을 수 없어요 | Noteflex",
      description: "요청하신 페이지가 사라졌어요. 메인이나 게임 페이지로 돌아가세요.",
    },
    dashboard: {
      title: "대시보드 | Noteflex",
      description: "오늘의 연습과 진행 영역.",
    },
    play: {
      title: "게임 | Noteflex",
      description: "악보 읽기 게임 — 레벨 선택 후 시작.",
    },
    profile: {
      title: "프로필 | Noteflex",
      description: "닉네임·언어·계정 설정.",
    },
    checkoutSuccess: {
      title: "결제 완료 | Noteflex",
      description: "구독이 활성화되었어요. Premium 모든 기능을 이용할 수 있어요.",
    },
    checkoutFailed: {
      title: "결제 미완료 | Noteflex",
      description: "결제가 완료되지 않았어요. 다시 시도해주세요.",
    },
  },
  feedback: {
    fabLabel: "한 마디",
    fabAriaLabel: "피드백 남기기",
    dialogTitle: "한 마디 남겨주세요",
    dialogSubtitle: "버그·개선 사항·뭐든 환영합니다.",
    messagePlaceholder: "여기에 적어주세요…",
    emailPlaceholder: "답변 받고 싶으시면 이메일 (선택)",
    counter: "{n} / 500",
    minHint: "최소 5자",
    submit: "보내기",
    submitting: "보내는 중…",
    cancel: "취소",
    toastSuccess: "감사합니다 — 잘 받았습니다",
    toastError: "전송에 실패했어요. 잠시 후 다시 시도해주세요.",
    toastTooShort: "최소 5자 이상 적어주세요",
    toastInvalidEmail: "이메일 형식을 확인해주세요",
  },
  langToggle: {
    ko: "한국어",
    en: "English",
  },
  authModal: {
    loginTitle: "로그인",
    loginSubtitle: "돌아오신 것을 환영해요",
    loginEmailPlaceholder: "이메일을 입력해주세요",
    loginSubmit: "이메일로 로그인",
    loginEmailNotFound: "가입된 이메일이 아니에요. 회원가입을 시작해볼까요?",
    loginEmailNotFoundCta: "회원가입하기",
    smtpNoticeLogin: "📧 이메일 로그인은 잠시 점검 중이에요. Google로 계속해주세요.",
    signupTitle: "독보 마스터 시작하기",
    signupSubtitle: "계정을 만들고 첫 걸음을 시작해요",
    signupStep1: "① 이메일 + 약관",
    signupStep2: "② 메일 확인",
    signupEmailPlaceholder: "사용할 이메일을 입력해주세요",
    signupSubmit: "이메일로 시작",
    signupEmailExists: "이미 가입된 이메일이에요.",
    signupEmailHardDeleted: "이 계정은 완전히 삭제되었습니다. 다른 이메일로 가입해주세요.",
    signupEmailExistsCta: "로그인하기",
    smtpNoticeSignup: "📧 이메일 가입은 잠시 점검 중이에요. Google로 계속해주세요.",
    giftHeadline: "🎁 가입하면 이런 게 가능해요",
    giftBullet1: "연주 기록 저장 및 성장 추적",
    giftBullet2: "모든 레벨 자유롭게 도전",
    giftBullet3: "학습 통계로 약점 분석",
    googleContinue: "Google로 계속하기",
    orDivider: "또는",
    closeButton: "닫기",
    submitProcessing: "처리 중...",
    submitSending: "전송 중...",
    submitWorking: "처리 중...",
    loginPrompt: "아직 계정이 없으신가요? ",
    signupPrompt: "이미 계정이 있으신가요? ",
    loginLink: "로그인",
    signupLink: "회원가입",
    tosRequiredLabel: "[필수]",
    tosOptionalLabel: "[선택]",
    tosBodyBefore: "만 14세 이상이며, ",
    tosTermsLink: "이용약관",
    tosPrivacyLink: "개인정보처리방침",
    tosSeparator: "·",
    tosBodyAfter: "에 동의합니다",
    marketingText: "마케팅 정보 수신에 동의합니다",
    magicLinkTitle: "메일을 확인해주세요",
    magicLinkSentPre: "",
    magicLinkSentPost: "로\n인증 메일을 보냈어요.",
    magicLinkActionLogin: "로그인이 이어집니다",
    magicLinkActionSignup: "가입이 이어집니다",
    magicLinkActionRecover: "계정 복구가 이어집니다",
    magicLinkActionBody: "메일 속 링크를 클릭하면 {action}.",
    magicLinkSpamHint: "스팸함도 확인해보세요 📁",
    magicLinkWaiting: "인증 대기 중...",
    magicLinkResend: "메일 재전송",
    magicLinkResendCooldown: "{n}초 후 재전송",
    magicLinkBackEmail: "이메일 다시 입력하기",
    recoveryTitle: "계정 복구 가능",
    recoveryBodyPre: "",
    recoveryBodyMid: "은\n삭제 처리 중인 계정이에요.",
    recoveryBodyDays: "{n}일 이내에 복구할 수 있어요.",
    recoveryAction: "계정 복구하기",
    recoveryActionSending: "전송 중...",
    freshStartButton: "새로 시작",
    freshStartConfirmTitle: "정말 진행하시겠어요?",
    freshStartConfirmBody: "이전 데이터가 영구 삭제됩니다. 진행하시겠어요?",
    freshStartConfirmYes: "확인",
    freshStartBack: "뒤로",
    recoveryCancel: "취소",
    toastTosRequired: "필수 약관에 동의해주세요",
    toastEmailInvalid: "이메일을 확인해주세요",
    toastGoogleFailed: "Google 로그인 실패",
    toastGenericError: "오류가 발생했어요",
    toastResendSent: "메일을 재전송했어요",
    toastResendSentDesc: "이메일함을 확인해주세요.",
    toastResendFailed: "재전송 실패",
  },
  premiumDialog: {
    title: "✨ Pro 구독으로 전체 단계 해제",
    subtitle: "전체 21단계 · 상세 약점 분석 · 광고 제거",
    benefits: [
      "🎵 Lv 1-7 전체 21단계 이용",
      "📊 음표별 약점·마스터 분석",
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
        "분석 보고서로 약점 진단",
      ],
      cta: "무료로 가입하기",
      close: "닫기",
    },
    free: {
      title: "오늘 7회를 마치셨어요.",
      values: [
        "매일 무제한 세션",
        "21단계 모두 열림",
        "상세 분석 — 약점 음표·학습 곡선·목표 추적",
        "광고 없는 집중 환경",
      ],
      pricing: "월 $4.99 · 연 $39.99 (33% 절약)",
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
    weakestNotesTitle: "😰 가장 약한 음표 Top 5",
    weakestNotesTooltip: "최근 500개 답변 기준 · 표본 가중치 적용 (소표본 극단값 보정)",
    slowestNotesTitle: "🐢 가장 느린 음표 Top 5",
    slowestNotesTooltip: "최근 500개 답변의 평균 반응 시간 · ⏱는 시간초과 다발",
    attemptsCountFormat: "n={n}",
    timeoutLabel: "⏱ 시간초과",
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
    statAvgReaction: "평균 반응",
    backToPrevious: "이전 단계로 ({label})",
    retrySameLevel: "같은 단계 다시 도전",
    variantPassed: "통과",
    variantFailed: "실패",
    vsAvgUp: "+{n}%p vs 평균",
    vsAvgDown: "-{n}%p vs 평균",
    vsAvgFlat: "평소 수준 vs 평균",
    noteAnalysisTitle: "음표별 분석 · 최근 30회",
    noteAnalysisEmpty: "수치가 부족합니다. 더 진행하면 음표별 분석을 보여드려요.",
    guestTeaserTitle: "음표별 분석",
    guestTeaserPrompt: "음표별 분석을 보려면 로그인하세요",
    guestTeaserCta: "5초만에 시작",
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
  accidentalTutorial: {
    title: "새로운 조작법 안내",
    intro: "이 레벨부터는 조표(♯, ♭)가 등장합니다. 아래 방식으로 답을 입력해 주세요.",
    sharpTitle: "샵(♯) 음표",
    sharpDesc: "해당 음 버튼을 위로 끌어올려 주세요",
    flatTitle: "플랫(♭) 음표",
    flatDesc: "해당 음 버튼을 아래로 내려 주세요",
    naturalTitle: "자연음 (♯, ♭ 없음)",
    naturalDesc: "해당 음 버튼을 그냥 클릭해 주세요",
    confirm: "확인했습니다",
    dontShowAgain: "앞으로 더 이상 보지 않기",
    ariaLabel: "조표 입력 사용법",
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
    aiFeedbackTitle: "분석 보고서",
    aiFeedbackDesc: "연주 기록을 분석해 코멘트와 다음 목표를 제안해요",
    reportDailyLabel: "오늘의 코멘트",
    reportDailyPeriod: "매일 · 짧은 피드백",
    reportWeeklyLabel: "이번 주 리포트",
    reportWeeklyPeriod: "주간 · 매주 월요일",
    reportMonthlyLabel: "월간 성장 리포트",
    reportMonthlyPeriod: "월간 · 매월 1일",
    reportComingSoon: "⏳ {label} 준비 중이에요",
    reportDailyDesc: "오늘 연주 기반 짧은 코멘트를 제공해요.",
    reportNotDailyDesc: "연주 패턴을 기반으로 분석을 제공해요.",
    recentSessionsTitle: "최근 세션",
    recentSessionsDesc: "최대 20개",
    noSessions: "아직 세션 기록이 없어요",
    tableTime: "시각",
    tableLevel: "레벨",
    tableCorrectTotal: "정답/전체",
    tableAccuracy: "정확도",
    tableAvgReaction: "평균 반응",
    tableXp: "XP",
    aiReportLocked: "분석 보고서",
    aiReportLockedSubtitle: "프리미엄에서 일간·주간·월간 분석 보고서를 받아보세요.",
    dayLabels: ["일", "월", "화", "수", "목", "금", "토"],

    // ── 신규 미니멀 대시보드 영역 ───────────────
    emptyTodayTitle: "오늘은 아직 시작하지 않았어요",
    emptyTodaySubtitle: "스트릭 유지하려면 오늘 1회 연습해주세요",
    emptyTodayStreakHint: "오늘 연습하면 {n}일째 ✨",
    emptyTodayCta: "지금 시작 →",

    newUserTitle: "음악 학습 시작해요",
    newUserSubtitle: "첫 게임 한 판으로 시작",
    newUserCta: "게임 시작",

    vsLast: "vs 7일 평균",
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
    aiFeedbackSubtitleNew: "연습을 시작하면 패턴을 분석해드려요",
    aiFeedbackPremiumOnly: "🔒 프리미엄 전용",

    nextStepEyebrow: "다음 한 걸음",
    nextStepCurrentLabel: "Lv {level}-{sublevel}",
    nextStepPlayProgress: "{current}/{target}",
    nextStepStreakChip: "연속 {n}/5",
    nextStepAccuracyChip: "정확도 {pct}%",
    nextStepAllPassed: "모든 단계 통과 — 마스터 🏆",
    nextStepStatusInProgress: "진행 중",
    nextStepStatusReady: "통과 준비 완료 ✓",
    nextStepGapPrefix: "통과까지 ",
    nextStepGapPlay: "플레이 {n}회",
    nextStepGapStreak: "연속 +{n}",
    nextStepGapAccuracy: "정확도 +{n}%p",
    nextStepGradHook: "{clef} {note} — 졸업 임박 🎓",
    nextStepGradProgress: "{current}/{target}",
    nextStepWeakHook: "{clef} {note} 연습 중",
    nextStepWeakSubtitle: "가장 진전된 약점",
    nextStepAClefNote: "{clef} {note}",
    nextStepASubHigh: "졸업 임박 🎓",
    nextStepASubMid: "거의 다 왔어요",
    nextStepASubLow: "마스터하는 중",
    nextStepAProgressLabel: "{current}/{target}",
    nextStepNoneTitle: "약점 없음 — 새 레벨에 도전 🚀",
    nextStepNoneSubtitle: "지금까지 약점으로 분류된 음표가 없어요",
    nextStepLearningTitle: "데이터 누적 중",
    nextStepLearningSubtitle: "몇 번 더 연습하면 다음 목표가 보여요",
    nextStepFootGraduated: "이번 주 졸업 {n}",
    nextStepFootWeakness: "약점 {n} 남음",
    nextStepFootGradZero: "이번 주 첫 졸업을 노려봐요 🎯",
    nextStepFootEmpty: "분석 데이터 누적 중",
    nextStepFocusBoxTitle: "이 음에 집중",
    nextStepNeedsBoxTitle: "연습이 필요한 음",
    nextStepMasteredBoxTitle: "마스터한 음",
    nextStepTooltipBody: "최근 20번 중 {current}번 정답. 19번 이상이면 이 음을 마스터해요.",
    nextStepGoalMarker: "목표",
    nextStepBatchUpdatedHoursAgo: "{n}시간 전 갱신",
    nextStepBatchUpdatedJustNow: "방금 전 갱신",
    nextStepBatchUpdatedDaysAgo: "{n}일 전 갱신",
    nextStepNoNeedsPractice: "약점 없음 ✓",
    nextStepNoMastered: "아직 마스터한 음 없음",
    nextStepGradCorrectSuffix: "번 정답",
  },
  analytics: {
    dailyTitle: "일간 보고서",
    dailySubtitle: "오늘 연습의 핵심 지표를 확인하세요.",
    weeklyTitle: "주간 보고서",
    weeklySubtitle: "이번 주 연습 패턴과 추세를 확인하세요.",
    monthlyTitle: "월간 보고서",
    monthlySubtitle: "이번 달 성장과 마스터리를 확인하세요.",
    nextReport: "다음 보고서",
    backToDaily: "← 오늘 일간 보고서",
    backToWeekly: "← 이번 주 주간 보고서",
    toWeeklyLabel: "이번 주 패턴 보기 →",
    toWeeklyDesc: "주간 추세와 반복되는 약점을 파악합니다.",
    toWeeklyHook: "오늘 틀린 {clef} {note} — 이번 주 내내 그랬을까요?",
    toMonthlyLabel: "이번 달 성장 보기 →",
    toMonthlyDesc: "월간 성장 그래프와 마스터리를 확인합니다.",
    weeklyPlaceholderTitle: "주간 보고서 — 준비 중입니다",
    weeklyPlaceholderDesc: "이번 주 패턴이 쌓이면 자동으로 채워집니다.",
    monthlyPlaceholderTitle: "월간 보고서 — 준비 중입니다",
    monthlyPlaceholderDesc: "한 달 치 데이터가 쌓이면 자동으로 채워집니다.",
    proLockSuffix: "— Pro 전용",
    proLockBody: "주간·월간 보고서는 Pro 구독자에게 제공됩니다.",
    proLockCta: "Pro 플랜 보기 →",
    graceTitle: "아직 오늘의 기록이 없어요",
    graceBody: "게임을 시작해 보세요! 한 세션이면 충분합니다.",
    graceCta: "게임 시작",
    errorTitle: "데이터를 불러오지 못했어요",
    errorRetry: "다시 시도",
    headlineEyebrow: "오늘의 한 줄",
    headlineWeak: "오늘 가장 어려운 음: {note}",
    headlineClean: "오늘 깔끔하게 잘 쳤어요",
    streakBadge: "🔥 연속 {n}일째",
    metricAccuracy: "정확도",
    metricAvgReaction: "평균 반응속도",
    metricTotalAttempts: "총 시도",
    metricSessions: "세션 {n}회",
    deltaVsBaseline: "vs 평소",
    weakNotesTitle: "오늘의 약점 음표",
    sessionsTitle: "오늘 세션",
    sessionAccLabel: "정확",
    sessionSpeedLabel: "속도",
    sessionAttemptsLabel: "시도",
    clefTreble: "높은음",
    clefBass: "낮은음",
    chipErrorRateLabel: "오답률",
    chipAttemptsUnit: "회",
    periodWeeklyEyebrow: "이번 주 요약",
    periodMonthlyEyebrow: "이번 달 요약",
    periodWeeklyHeadlineWeak: "이번 주 가장 어려운 음: {note}",
    periodWeeklyHeadlineClean: "이번 주 깔끔하게 연습했어요",
    periodMonthlyHeadlineWeak: "이번 달 가장 어려운 음: {note}",
    periodMonthlyHeadlineClean: "이번 달 꾸준히 잘 쳤어요",
    periodWeeklyWeakNotesTitle: "이번 주 약점 음표",
    periodMonthlyWeakNotesTitle: "이번 달 약점 음표",
    periodActiveDays: "활동 {n}일",
    periodGraduated: "졸업 {n}개",
    periodRegressed: "퇴보 {n}개",
    periodNoData: "아직 이번 기간 기록이 없어요",
    periodWeeklyNoDataHint: "계속 연습하세요 — 주간 분석은 이번 주가 쌓이며 채워집니다.",
    periodMonthlyNoDataHint: "계속 연습하세요 — 월간 분석은 한 달이 쌓이며 채워집니다.",
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
    gameOver: "Game Over",
    scoreLabel: "Correct:",
    xpEarned: "+{xp} XP earned!",
    tryAgain: "Try again!",
    backToHome: "Back to Home 🔥",
    finalStage: "Final stage — {n} left",
    notesSequential: "{n} notes in sequence",
    notesSimultaneous: "{n} notes at once",
    setProgress: "({cur}/{total} sets)",
    questionOfTotal: "What is note {a} of {b}?",
    question: "What is note {a}?",
    listenAgain: "🔊 Listen again",
    answerHint: "💡 Answer: {ans}",
    showAnswerDev: "💡 Show answer (DEV)",
    answerAlert: "Answer: {ans}",
    ariaNoteInput: "Note answer input",
    ariaSelectNote: "Select {label}",
    countdownStarting: "Get ready",
    countdownAria: "Starting in {count}s",
    errorTitle: "Something went wrong",
    errorBody: "Please try again in a moment. Your game data is safe.",
    errorRetry: "Try again",
    errorHome: "Home",
  },
  premiumRequired: {
    title: "Premium-only level",
    bodyLevel: "Level {n} is available to Premium subscribers only.",
    body: "This level is available to Premium subscribers only.",
    benefitsTitle: "Premium benefits",
    benefitAllLevels: "Unlock all levels (Lv1–Lv7)",
    benefitWeakNotes: "Detailed weakness analysis",
    benefitAdFree: "Ad-free, focused learning",
    price: "$39.99/yr · Save 33%",
    cancel: "Cancel",
    subscribe: "Go to subscribe →",
  },
  comingSoon: {
    badge: "🚀 Launching June 2026",
    body: "Final polishing before official launch. For launch notifications, email {email}.",
    blogButton: "📝 Read Blog",
  },
  updateBanner: {
    message: "A new version is available",
    action: "Refresh",
  },
  header: {
    signIn: "Sign In / Sign Up",
    signOut: "Sign Out",
    profile: "Profile",
    dashboard: "Dashboard",
    setNicknameHint: "Set your nickname →",
    mainNav: "Main navigation",
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
    copyright: "© 2026 Donofear. All rights reserved.",
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
  blogCta: {
    mains: [
      "Don't stop here.",
      "One quick round.",
      "Reading is one thing.",
      "Match your first note.",
      "Your notes are waiting.",
      "Just one round.",
      "You'll never know.",
      "5 seconds.",
    ],
    subs: [
      "Try it yourself.",
      "A minute is all it takes.",
      "Playing is another.",
      "in 5 seconds.",
      "for you.",
      "Really.",
      "unless you try.",
      "That's it.",
    ],
    buttonLabel: "Play →",
  },
  notFoundPage: {
    headline: "This note got lost",
    body: "The page you're looking for isn't here",
    backHome: "Back to home",
    playGame: "Play game",
  },
  pageMeta: {
    notFound: {
      title: "Page not found | Noteflex",
      description: "The page you're looking for has moved or never existed. Head back home or jump into the game.",
    },
    dashboard: {
      title: "Dashboard | Noteflex",
      description: "Your daily practice and progress.",
    },
    play: {
      title: "Play | Noteflex",
      description: "Sight-reading game — pick a level and start playing.",
    },
    profile: {
      title: "Profile | Noteflex",
      description: "Nickname, language, and account settings.",
    },
    checkoutSuccess: {
      title: "Payment complete | Noteflex",
      description: "Your subscription is active. Enjoy every Premium feature.",
    },
    checkoutFailed: {
      title: "Payment incomplete | Noteflex",
      description: "We couldn't complete the payment. Please try again.",
    },
  },
  feedback: {
    fabLabel: "Drop a note",
    fabAriaLabel: "Leave feedback",
    dialogTitle: "Drop a note",
    dialogSubtitle: "Bugs, ideas, anything — we read them all.",
    messagePlaceholder: "Write anything here…",
    emailPlaceholder: "Email for reply (optional)",
    counter: "{n} / 500",
    minHint: "Min 5 characters",
    submit: "Send",
    submitting: "Sending…",
    cancel: "Cancel",
    toastSuccess: "Thanks — got it.",
    toastError: "Send failed. Please try again in a moment.",
    toastTooShort: "Please write at least 5 characters.",
    toastInvalidEmail: "Please check email format.",
  },
  langToggle: {
    ko: "한국어",
    en: "English",
  },
  authModal: {
    loginTitle: "Sign In",
    loginSubtitle: "Welcome back",
    loginEmailPlaceholder: "Enter your email",
    loginSubmit: "Continue with email",
    loginEmailNotFound: "We couldn't find that email. Want to sign up instead?",
    loginEmailNotFoundCta: "Sign up",
    smtpNoticeLogin: "📧 Email sign-in is under maintenance. Please continue with Google.",
    signupTitle: "Start Mastering Sight-Reading",
    signupSubtitle: "Create your account and take the first step",
    signupStep1: "① Email + Terms",
    signupStep2: "② Email Verify",
    signupEmailPlaceholder: "Enter the email you'd like to use",
    signupSubmit: "Continue with email",
    signupEmailExists: "This email is already registered.",
    signupEmailHardDeleted: "This account was permanently deleted. Please sign up with a different email.",
    signupEmailExistsCta: "Sign in",
    smtpNoticeSignup: "📧 Email signup is under maintenance. Please continue with Google.",
    giftHeadline: "🎁 Here's what you'll get",
    giftBullet1: "Save play history and track progress",
    giftBullet2: "Free access to all levels",
    giftBullet3: "Analyze weak notes via stats",
    googleContinue: "Continue with Google",
    orDivider: "or",
    closeButton: "Close",
    submitProcessing: "Working...",
    submitSending: "Sending...",
    submitWorking: "Working...",
    loginPrompt: "Don't have an account? ",
    signupPrompt: "Already have an account? ",
    loginLink: "Sign in",
    signupLink: "Sign up",
    tosRequiredLabel: "[Required]",
    tosOptionalLabel: "[Optional]",
    tosBodyBefore: "I am 14+ and agree to the ",
    tosTermsLink: "Terms",
    tosPrivacyLink: "Privacy Policy",
    tosSeparator: " and ",
    tosBodyAfter: "",
    marketingText: "I agree to receive marketing communications",
    magicLinkTitle: "Check your email",
    magicLinkSentPre: "We sent a verification email to\n",
    magicLinkSentPost: "",
    magicLinkActionLogin: "to continue signing in",
    magicLinkActionSignup: "to complete signup",
    magicLinkActionRecover: "to recover your account",
    magicLinkActionBody: "Click the link in your email {action}.",
    magicLinkSpamHint: "Don't forget to check spam 📁",
    magicLinkWaiting: "Waiting for verification...",
    magicLinkResend: "Resend email",
    magicLinkResendCooldown: "Resend in {n}s",
    magicLinkBackEmail: "Use a different email",
    recoveryTitle: "Account recovery available",
    recoveryBodyPre: "",
    recoveryBodyMid: " is being deleted.",
    recoveryBodyDays: "You can recover it within {n} days.",
    recoveryAction: "Recover account",
    recoveryActionSending: "Sending...",
    freshStartButton: "Start fresh",
    freshStartConfirmTitle: "Are you sure?",
    freshStartConfirmBody: "Previous data will be permanently deleted. Continue?",
    freshStartConfirmYes: "Confirm",
    freshStartBack: "Back",
    recoveryCancel: "Cancel",
    toastTosRequired: "Please agree to the required terms",
    toastEmailInvalid: "Please check your email",
    toastGoogleFailed: "Google sign-in failed",
    toastGenericError: "Something went wrong",
    toastResendSent: "Email resent",
    toastResendSentDesc: "Please check your inbox.",
    toastResendFailed: "Resend failed",
  },
  premiumDialog: {
    title: "✨ Unlock All Levels with Pro",
    subtitle: "All 21 levels · Detailed weakness analysis · Ad-free",
    benefits: [
      "🎵 Access all 21 levels (Lv 1-7)",
      "📊 Per-note weakness & mastery analytics",
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
        "Spot your weak notes with data analysis",
      ],
      cta: "Sign up — free",
      close: "Close",
    },
    free: {
      title: "You've finished today's seven.",
      values: [
        "Unlimited daily sessions",
        "All 21 stages unlocked",
        "Detailed analysis — weak notes, progress curve, goals",
        "Ad-free focus",
      ],
      pricing: "$4.99/mo · $39.99/yr (save 33%)",
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
    weakestNotesTitle: "😰 Weakest Notes — Top 5",
    weakestNotesTooltip: "Based on last 500 answers · sample-weighted (small-sample extremes adjusted)",
    slowestNotesTitle: "🐢 Slowest Notes — Top 5",
    slowestNotesTooltip: "Avg reaction time over last 500 answers · ⏱ means frequent time-outs",
    attemptsCountFormat: "n={n}",
    timeoutLabel: "⏱ Timed out",
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
    statAvgReaction: "Avg response",
    backToPrevious: "Back to {label}",
    retrySameLevel: "Retry this stage",
    variantPassed: "Passed",
    variantFailed: "Failed",
    vsAvgUp: "+{n}%p vs avg",
    vsAvgDown: "-{n}%p vs avg",
    vsAvgFlat: "On par with avg",
    noteAnalysisTitle: "Note analysis · Recent 30",
    noteAnalysisEmpty: "Not enough data yet. Keep playing to see note-level analysis.",
    guestTeaserTitle: "Note breakdown",
    guestTeaserPrompt: "Sign up to see note breakdown",
    guestTeaserCta: "Sign up — 5 seconds",
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
  accidentalTutorial: {
    title: "New controls",
    intro: "From this level, accidentals (♯, ♭) appear. Enter your answer as shown below.",
    sharpTitle: "Sharp (♯)",
    sharpDesc: "Drag the note button up",
    flatTitle: "Flat (♭)",
    flatDesc: "Drag the note button down",
    naturalTitle: "Natural (no ♯ or ♭)",
    naturalDesc: "Just tap the note button",
    confirm: "Got it",
    dontShowAgain: "Don't show this again",
    ariaLabel: "How to enter accidentals",
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
    aiFeedbackTitle: "Analytics",
    aiFeedbackDesc: "Reviews your playing and suggests comments and next goals",
    reportDailyLabel: "Today's Comment",
    reportDailyPeriod: "Daily · Short feedback",
    reportWeeklyLabel: "Weekly Report",
    reportWeeklyPeriod: "Weekly · Every Monday",
    reportMonthlyLabel: "Monthly Growth Report",
    reportMonthlyPeriod: "Monthly · 1st of each month",
    reportComingSoon: "⏳ {label} coming soon",
    reportDailyDesc: "A short comment based on today's playing.",
    reportNotDailyDesc: "Analyzes your playing patterns.",
    recentSessionsTitle: "Recent Sessions",
    recentSessionsDesc: "Up to 20",
    noSessions: "No session records yet",
    tableTime: "Time",
    tableLevel: "Level",
    tableCorrectTotal: "Correct/Total",
    tableAccuracy: "Accuracy",
    tableAvgReaction: "Avg reaction",
    tableXp: "XP",
    aiReportLocked: "Analytics Report",
    aiReportLockedSubtitle: "Unlock daily, weekly, and monthly analytics reports with Premium.",
    dayLabels: ["S", "M", "T", "W", "T", "F", "S"],

    // ── New minimal dashboard ───────────────────
    emptyTodayTitle: "You haven't started today yet",
    emptyTodaySubtitle: "Practice once today to keep your streak",
    emptyTodayStreakHint: "Practice today to make it day {n} ✨",
    emptyTodayCta: "Start now →",

    newUserTitle: "Let's start your music journey",
    newUserSubtitle: "One round to begin",
    newUserCta: "Start playing",

    vsLast: "vs 7-day avg",
    noLastSessionYet: "Shown after first session",
    lastActivityTitle: "Last activity",
    lastActivityFormat: "{when} · Acc {acc} · Speed {speed} · XP {xp}",
    daysAgo: "{n} days ago",
    yesterday: "Yesterday",
    today: "Today",
    streakStartFresh: "Start fresh today",
    kpiNoDataToday: "No data today",
    kpiNotYet: "Not yet started",

    aiFeedbackSubtitleActive: "Analyzes your playing and suggests next goals",
    aiFeedbackSubtitleNew: "Practice to see your patterns analyzed",
    aiFeedbackPremiumOnly: "🔒 Premium only",

    nextStepEyebrow: "Next Step",
    nextStepCurrentLabel: "Lv {level}-{sublevel}",
    nextStepPlayProgress: "{current}/{target}",
    nextStepStreakChip: "Streak {n}/5",
    nextStepAccuracyChip: "Acc {pct}%",
    nextStepAllPassed: "All levels cleared — Master 🏆",
    nextStepStatusInProgress: "In progress",
    nextStepStatusReady: "Ready to pass ✓",
    nextStepGapPrefix: "to pass: ",
    nextStepGapPlay: "{n} more plays",
    nextStepGapStreak: "streak +{n}",
    nextStepGapAccuracy: "acc +{n}%p",
    nextStepGradHook: "{clef} {note} — close to graduating 🎓",
    nextStepGradProgress: "{current}/{target}",
    nextStepWeakHook: "{clef} {note} in progress",
    nextStepWeakSubtitle: "Most advanced weak note",
    nextStepAClefNote: "{clef} {note}",
    nextStepASubHigh: "Close to graduating 🎓",
    nextStepASubMid: "Almost there",
    nextStepASubLow: "Mastering in progress",
    nextStepAProgressLabel: "{current}/{target}",
    nextStepNoneTitle: "No weak notes — try a new level 🚀",
    nextStepNoneSubtitle: "Nothing flagged as a weakness yet",
    nextStepLearningTitle: "Gathering data",
    nextStepLearningSubtitle: "A few more sessions and the next goal appears",
    nextStepFootGraduated: "{n} graduated this week",
    nextStepFootWeakness: "{n} weak notes left",
    nextStepFootGradZero: "Aim for your first graduation this week 🎯",
    nextStepFootEmpty: "Building analytics",
    nextStepFocusBoxTitle: "Focus on this note",
    nextStepNeedsBoxTitle: "Needs practice",
    nextStepMasteredBoxTitle: "Mastered",
    nextStepTooltipBody: "{current} of your last 20 attempts correct. Reach 19+ to master this note.",
    nextStepGoalMarker: "Goal",
    nextStepBatchUpdatedHoursAgo: "updated {n}h ago",
    nextStepBatchUpdatedJustNow: "updated just now",
    nextStepBatchUpdatedDaysAgo: "updated {n}d ago",
    nextStepNoNeedsPractice: "No weak notes ✓",
    nextStepNoMastered: "No mastered notes yet",
    nextStepGradCorrectSuffix: "correct",
  },
  analytics: {
    dailyTitle: "Daily Report",
    dailySubtitle: "Your key metrics from today's practice.",
    weeklyTitle: "Weekly Report",
    weeklySubtitle: "Track your practice patterns this week.",
    monthlyTitle: "Monthly Report",
    monthlySubtitle: "See your growth and mastery this month.",
    nextReport: "Next Report",
    backToDaily: "← Today's daily report",
    backToWeekly: "← This week's weekly report",
    toWeeklyLabel: "See this week's patterns →",
    toWeeklyDesc: "Identify weekly trends and recurring weak spots.",
    toWeeklyHook: "You missed {clef} {note} today — was it all week?",
    toMonthlyLabel: "See this month's growth →",
    toMonthlyDesc: "Review monthly growth and mastery progress.",
    weeklyPlaceholderTitle: "Weekly Report — Coming Soon",
    weeklyPlaceholderDesc: "Fills in automatically as your weekly data builds up.",
    monthlyPlaceholderTitle: "Monthly Report — Coming Soon",
    monthlyPlaceholderDesc: "Fills in automatically after a month of practice.",
    proLockSuffix: "— Pro Only",
    proLockBody: "Weekly and monthly reports are available on the Pro plan.",
    proLockCta: "View Pro Plan →",
    graceTitle: "No records yet today",
    graceBody: "Start a game — one session is all it takes.",
    graceCta: "Start Playing",
    errorTitle: "Failed to load data",
    errorRetry: "Try again",
    headlineEyebrow: "Today's takeaway",
    headlineWeak: "Hardest note today: {note}",
    headlineClean: "Clean playing today",
    streakBadge: "🔥 {n}-day streak",
    metricAccuracy: "Accuracy",
    metricAvgReaction: "Avg Reaction",
    metricTotalAttempts: "Total Attempts",
    metricSessions: "{n} sessions",
    deltaVsBaseline: "vs avg",
    weakNotesTitle: "Today's weak notes",
    sessionsTitle: "Today's sessions",
    sessionAccLabel: "Acc",
    sessionSpeedLabel: "Speed",
    sessionAttemptsLabel: "Att",
    clefTreble: "Treble",
    clefBass: "Bass",
    chipErrorRateLabel: "error rate",
    chipAttemptsUnit: " tries",
    periodWeeklyEyebrow: "This week's summary",
    periodMonthlyEyebrow: "This month's summary",
    periodWeeklyHeadlineWeak: "This week's hardest note: {note}",
    periodWeeklyHeadlineClean: "Clean week — no standout weak notes",
    periodMonthlyHeadlineWeak: "This month's hardest note: {note}",
    periodMonthlyHeadlineClean: "Strong month — no standout weak notes",
    periodWeeklyWeakNotesTitle: "This week's weak notes",
    periodMonthlyWeakNotesTitle: "This month's weak notes",
    periodActiveDays: "{n} active days",
    periodGraduated: "{n} graduated",
    periodRegressed: "{n} regressed",
    periodNoData: "No data for this period yet",
    periodWeeklyNoDataHint: "Keep playing — weekly insights build over the week.",
    periodMonthlyNoDataHint: "Keep playing — monthly insights build over the month.",
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
