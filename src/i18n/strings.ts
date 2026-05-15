// 글로벌 UI 텍스트. 한·영 박음, 일·중은 영어 fallback (Phase 3 영역).
// 신규 키 박을 시 Strings 인터페이스 + ko + en 모두 박음.

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
    /** {email} placeholder 박힘 */
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
    /** "{hours}h {minutes}m" placeholder 박힘 */
    countdown: string;
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
};

// TODO(i18n-phase-3): 일본어·중국어 번역 박음
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
