import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StaffPreview from "./StaffPreview";

vi.mock("@/components/practice/GrandStaffPractice", async () => {
  const actual = await vi.importActual<typeof import("@/components/practice/GrandStaffPractice")>(
    "@/components/practice/GrandStaffPractice",
  );
  return {
    ...actual,
    GrandStaffPractice: () => <div data-testid="grand-staff-mock" />,
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <StaffPreview />
    </MemoryRouter>,
  );
}

describe("StaffPreview — render & controls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders without crashing", () => {
    renderPage();
    expect(screen.getByTestId("controls-panel")).toBeInTheDocument();
    expect(screen.getByTestId("meta-panel")).toBeInTheDocument();
    expect(screen.getByTestId("grand-staff-mock")).toBeInTheDocument();
  });

  it("default M=5 (batchSize=1, totalSets=5)", () => {
    renderPage();
    expect(screen.getByTestId("meta-M")).toHaveTextContent("5");
  });

  it("shows level toggle buttons 1-7", () => {
    renderPage();
    for (let lv = 1; lv <= 7; lv++) {
      expect(screen.getByTestId(`toggle-level-${lv}`)).toBeInTheDocument();
    }
  });

  it("shows batchSize toggle buttons", () => {
    renderPage();
    for (const bs of [1, 3, 5, 7]) {
      expect(screen.getByTestId(`toggle-batchsize-${bs}`)).toBeInTheDocument();
    }
  });

  it("batchSize=3 → M=3, batch-index-slider visible", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-3"));
    expect(screen.getByTestId("meta-M")).toHaveTextContent("3");
    expect(screen.getByTestId("batch-index-slider")).toBeInTheDocument();
  });

  it("batchSize=7 → M=7", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-7"));
    expect(screen.getByTestId("meta-M")).toHaveTextContent("7");
  });

  it("history-count-slider visible when batchSize=1", () => {
    renderPage();
    expect(screen.getByTestId("history-count-slider")).toBeInTheDocument();
  });

  it("history-count-slider hidden when batchSize=3", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-3"));
    expect(screen.queryByTestId("history-count-slider")).not.toBeInTheDocument();
  });

  it("keySig sharps → keysig-count-slider visible", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-keysig-type-sharps"));
    expect(screen.getByTestId("keysig-count-slider")).toBeInTheDocument();
  });

  it("meta-panel shows noteStartX, noteSpacing, effectiveWidth, segmentWidth", () => {
    renderPage();
    expect(screen.getByTestId("meta-noteStartX")).toBeInTheDocument();
    expect(screen.getByTestId("meta-noteSpacing")).toBeInTheDocument();
    expect(screen.getByTestId("meta-effectiveWidth")).toBeInTheDocument();
    expect(screen.getByTestId("meta-segmentWidth")).toBeInTheDocument();
  });

  it("meta-current-x and meta-ndiv-x are present", () => {
    renderPage();
    expect(screen.getByTestId("meta-current-x")).toBeInTheDocument();
    expect(screen.getByTestId("meta-ndiv-x")).toBeInTheDocument();
  });
});

describe("StaffPreview — meta value correctness", () => {
  it("batchSize=1, totalSets=5 → current-x has 5 entries (M=5 fixed grid)", () => {
    renderPage();
    const el = screen.getByTestId("meta-current-x");
    const text = el.textContent ?? "";
    const entries = text.replace("[", "").replace("]", "").split(",").filter(Boolean);
    expect(entries).toHaveLength(5);
  });

  it("batchSize=5 → current-x has 5 entries", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-5"));
    const el = screen.getByTestId("meta-current-x");
    const text = el.textContent ?? "";
    const entries = text.replace("[", "").replace("]", "").split(",").filter(Boolean);
    expect(entries).toHaveLength(5);
  });

  it("N-div X[0] < X[1] < X[2] (monotone increasing)", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-3"));
    const el = screen.getByTestId("meta-ndiv-x");
    const text = el.textContent ?? "";
    const values = text
      .replace("[", "")
      .replace("]", "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10));
    expect(values[0]).toBeLessThan(values[1]);
    expect(values[1]).toBeLessThan(values[2]);
  });
});

describe("StaffPreview — C2 M-등분 고정 슬롯 정책", () => {
  it("total-sets-slider visible when batchSize=1", () => {
    renderPage();
    expect(screen.getByTestId("total-sets-slider")).toBeInTheDocument();
  });

  it("total-sets-slider hidden when batchSize=3", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-3"));
    expect(screen.queryByTestId("total-sets-slider")).not.toBeInTheDocument();
  });

  it("batchSize=1, totalSets=7 → meta-M=7", async () => {
    const { fireEvent } = await import("@testing-library/react");
    renderPage();
    const slider = screen.getByTestId("total-sets-slider");
    fireEvent.change(slider, { target: { value: "7" } });
    expect(screen.getByTestId("meta-M")).toHaveTextContent("7");
  });

  it("toggle-slot-idx toggles meta-slot-idx visibility", async () => {
    renderPage();
    expect(screen.queryByTestId("meta-slot-idx")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("toggle-slot-idx"));
    expect(screen.getByTestId("meta-slot-idx")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("toggle-slot-idx"));
    expect(screen.queryByTestId("meta-slot-idx")).not.toBeInTheDocument();
  });
});

describe("StaffPreview — §S3 scale·viewport·grand staff 토글", () => {
  it("scale-preset 무관 uniscale=0.75 고정 (computeScale 상수화)", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-scale-preset-1.0"));
    expect(screen.getByTestId("meta-uniscale")).toHaveTextContent("0.75");
    await userEvent.click(screen.getByTestId("toggle-scale-preset-0.75"));
    expect(screen.getByTestId("meta-uniscale")).toHaveTextContent("0.75");
    await userEvent.click(screen.getByTestId("toggle-scale-preset-0.55"));
    expect(screen.getByTestId("meta-uniscale")).toHaveTextContent("0.75");
  });

  it("viewport portrait → meta-viewport 노출 + 375×667 포함", async () => {
    renderPage();
    expect(screen.queryByTestId("meta-viewport")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("toggle-viewport-portrait"));
    const vpEl = screen.getByTestId("meta-viewport");
    expect(vpEl).toBeInTheDocument();
    expect(vpEl.textContent).toContain("375×667");
    await userEvent.click(screen.getByTestId("toggle-viewport-desktop"));
    expect(screen.getByTestId("meta-viewport").textContent).toContain("1440×900");
    await userEvent.click(screen.getByTestId("toggle-viewport-none"));
    expect(screen.queryByTestId("meta-viewport")).not.toBeInTheDocument();
  });

  it("staff-mode grand → meta-staff-mode=grand, styleLevel≥5", async () => {
    renderPage();
    expect(screen.getByTestId("meta-staff-mode")).toHaveTextContent("treble");
    await userEvent.click(screen.getByTestId("toggle-staff-mode-grand"));
    expect(screen.getByTestId("meta-staff-mode")).toHaveTextContent("grand");
    // styleLevel should be ≥5 (default level=1 → forced to 5)
    expect(Number(screen.getByTestId("meta-style-level").textContent)).toBeGreaterThanOrEqual(5);
    await userEvent.click(screen.getByTestId("toggle-staff-mode-bass"));
    expect(screen.getByTestId("meta-staff-mode")).toHaveTextContent("bass");
  });

  it("메타 패널: staffH·uniscale·staffLineGap·clefFontSize·keySigFontSize 존재", () => {
    renderPage();
    expect(screen.getByTestId("meta-staffH")).toBeInTheDocument();
    expect(screen.getByTestId("meta-uniscale")).toBeInTheDocument();
    expect(screen.getByTestId("meta-staffLineGap")).toBeInTheDocument();
    expect(screen.getByTestId("meta-clefFontSize")).toBeInTheDocument();
    expect(screen.getByTestId("meta-keySigFontSize")).toBeInTheDocument();
    expect(screen.getByTestId("meta-svgH")).toBeInTheDocument();
  });
});
