import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ─────────────────────────────────────────────────────────
// mock: useNavigate
// ─────────────────────────────────────────────────────────
const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import UpgradeModal from "./UpgradeModal";

function renderModal(open = true, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <UpgradeModal open={open} onClose={onClose} />
    </MemoryRouter>
  );
}

describe("UpgradeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("open=true 시 다이얼로그 렌더링", () => {
    renderModal(true);
    expect(screen.getByText(/Pro 구독으로 전체 단계 해제/)).toBeInTheDocument();
    // "전체 21단계"는 DialogDescription과 목록 항목 두 곳에 있으므로 getAllByText 사용
    expect(screen.getAllByText(/전체 21단계/).length).toBeGreaterThanOrEqual(1);
  });

  it("open=false 시 내용 숨김", () => {
    renderModal(false);
    expect(screen.queryByText(/Pro 구독으로 전체 단계 해제/)).not.toBeInTheDocument();
  });

  it("'Pricing 보기' 클릭 → /pricing 이동 + onClose 호출", async () => {
    const onClose = vi.fn();
    renderModal(true, onClose);

    await userEvent.click(screen.getByRole("button", { name: /Pricing 보기/ }));

    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("'닫기' 클릭 → onClose 호출, navigate 안 함", async () => {
    const onClose = vi.fn();
    renderModal(true, onClose);

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("혜택 목록 표시: 4가지 항목", () => {
    renderModal(true);
    expect(screen.getByText(/Lv 1–7 전체 21단계/)).toBeInTheDocument();
    expect(screen.getByText(/약점·마스터 분석/)).toBeInTheDocument();
    expect(screen.getByText(/개인화 출제 가중치/)).toBeInTheDocument();
    expect(screen.getByText(/광고 없는/)).toBeInTheDocument();
  });
});
