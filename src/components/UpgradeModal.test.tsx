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
    // 디폴트 EN — LanguageProvider 미박 환경
    expect(screen.getByText(/Unlock All Levels with Pro/)).toBeInTheDocument();
    expect(screen.getAllByText(/21 levels/).length).toBeGreaterThanOrEqual(1);
  });

  it("open=false 시 내용 숨김", () => {
    renderModal(false);
    expect(screen.queryByText(/Unlock All Levels with Pro/)).not.toBeInTheDocument();
  });

  it("'View Premium Benefits' 클릭 → /pricing 이동 + onClose 호출", async () => {
    const onClose = vi.fn();
    renderModal(true, onClose);

    await userEvent.click(screen.getByTestId("upgrade-modal-cta"));

    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("'Close' 클릭 → onClose 호출, navigate 안 함", async () => {
    const onClose = vi.fn();
    renderModal(true, onClose);

    await userEvent.click(screen.getByTestId("upgrade-modal-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("혜택 목록 표시: 4가지 항목", () => {
    renderModal(true);
    expect(screen.getByText(/Access all 21 levels/)).toBeInTheDocument();
    expect(screen.getByText(/Per-note weakness/)).toBeInTheDocument();
    expect(screen.getByText(/Distraction-free/)).toBeInTheDocument();
    expect(screen.getAllByText(/ad-free/i).length).toBeGreaterThanOrEqual(1);
  });
});
