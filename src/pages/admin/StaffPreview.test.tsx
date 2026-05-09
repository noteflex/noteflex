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

  it("default N=4 (batchSize=1, history=3)", () => {
    renderPage();
    expect(screen.getByTestId("meta-N")).toHaveTextContent("4");
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

  it("batchSize=3 → N=3, batch-index-slider visible", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-3"));
    expect(screen.getByTestId("meta-N")).toHaveTextContent("3");
    expect(screen.getByTestId("batch-index-slider")).toBeInTheDocument();
  });

  it("batchSize=7 → N=7", async () => {
    renderPage();
    await userEvent.click(screen.getByTestId("toggle-batchsize-7"));
    expect(screen.getByTestId("meta-N")).toHaveTextContent("7");
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
  it("batchSize=1 history=3 → current-x has 4 entries", () => {
    renderPage();
    const el = screen.getByTestId("meta-current-x");
    const text = el.textContent ?? "";
    const entries = text.replace("[", "").replace("]", "").split(",").filter(Boolean);
    expect(entries).toHaveLength(4);
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
