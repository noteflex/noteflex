import { useEffect, useMemo, useRef, useState } from "react";
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";

interface NoteData {
  name: string;
  key: string;
  y: number;
  octave: string;
  accidental?: "#" | "b";
}

interface KeyAccidental {
  key: string;
  accidental: "#" | "b";
}

export interface StaffConfig {
  maxWidth: number;
  minWidth: number;
  horizontalPadding: number;
  baseHeight: number;
  advancedHeight: number;
  scaleX: number;
  baseScaleY: number;
  advancedScaleY: number;
  staveX: number;
  staveY: number;
  advancedStaveY: number;
  minStaveWidth: number;
  horizontalNotePadding: number;
  keySignature: {
    startX: number;
    spacing: number;
    fontSize: number;
    yOffset: number;
    color: string;
  };
  noteColors: {
    past: string;
    current: string;
    future: string;
  };
}

interface StaffDisplayProps {
  notes: NoteData[];
  currentIndex: number;
  shake: boolean;
  clef?: "treble" | "bass";
  isAdvanced?: boolean;
  keyAccidentals?: KeyAccidental[];
  config?: Partial<StaffConfig>;
}

const DEFAULT_STAFF_CONFIG: StaffConfig = {
  maxWidth: 600,
  minWidth: 280,
  horizontalPadding: 8,
  baseHeight: 250,
  advancedHeight: 350,
  scaleX: 1.5,
  baseScaleY: 2.25,
  advancedScaleY: 2.0,
  staveX: 20,
  staveY: 40,
  advancedStaveY: 60,
  minStaveWidth: 120,
  horizontalNotePadding: 20,
  keySignature: {
    startX: 58,
    spacing: 10,
    fontSize: 16,
    yOffset: 5,
    color: "#1e293b",
  },
  noteColors: {
    past: "#22c55e",
    current: "#2563eb",
    future: "#1e293b",
  },
};

const TREBLE_KEY_SIG_LINES: Record<string, number> = {
  F: 0,
  E: 0.5,
  D: 1,
  C: 1.5,
  B: 2,
  A: 2.5,
  G: 3,
};

const BASS_KEY_SIG_LINES: Record<string, number> = {
  A: 0,
  G: 0.5,
  F: 1,
  E: 1.5,
  D: 2,
  C: 2.5,
  B: 3,
};

function colorNoteGroups(groups: SVGGElement[], currentIndex: number, config: StaffConfig): void {
  groups.forEach((group, noteIndex) => {
    const color =
      noteIndex < currentIndex
        ? config.noteColors.past
        : noteIndex === currentIndex
          ? config.noteColors.current
          : config.noteColors.future;

    const targets = group.querySelectorAll<SVGElement>("path, ellipse, circle, line, rect");
    targets.forEach((node) => {
      if (node.hasAttribute("fill") && node.getAttribute("fill") !== "none") {
        node.setAttribute("fill", color);
      }
      if (node.hasAttribute("stroke") && node.getAttribute("stroke") !== "none") {
        node.setAttribute("stroke", color);
      }
    });
  });
}

export default function StaffDisplay({
  notes,
  currentIndex,
  shake,
  clef = "treble",
  isAdvanced = false,
  keyAccidentals = [],
  config,
}: StaffDisplayProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const noteGroupsRef = useRef<SVGGElement[]>([]);
  const [frameWidth, setFrameWidth] = useState(0);

  const mergedConfig = useMemo<StaffConfig>(
    () => ({
      ...DEFAULT_STAFF_CONFIG,
      ...config,
      keySignature: {
        ...DEFAULT_STAFF_CONFIG.keySignature,
        ...(config?.keySignature ?? {}),
      },
      noteColors: {
        ...DEFAULT_STAFF_CONFIG.noteColors,
        ...(config?.noteColors ?? {}),
      },
    }),
    [config],
  );

  useEffect(() => {
    if (!frameRef.current) return;

    const updateWidth = () => {
      if (!frameRef.current) return;
      setFrameWidth(Math.floor(frameRef.current.clientWidth));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgHostRef.current || notes.length === 0 || frameWidth === 0) return;

    const width = Math.max(
      mergedConfig.minWidth,
      Math.min(frameWidth - mergedConfig.horizontalPadding * 2, mergedConfig.maxWidth),
    );
    const height = isAdvanced ? mergedConfig.advancedHeight : mergedConfig.baseHeight;
    const scaleY = isAdvanced ? mergedConfig.advancedScaleY : mergedConfig.baseScaleY;
    const staveY = isAdvanced ? mergedConfig.advancedStaveY : mergedConfig.staveY;

    const scaledWidth = Math.floor(width / mergedConfig.scaleX);
    const staveWidth = Math.max(
      mergedConfig.minStaveWidth,
      scaledWidth - mergedConfig.staveX * 2,
    );

    // Static + dynamic layer redraw (only when layout data changes)
    svgHostRef.current.innerHTML = "";
    noteGroupsRef.current = [];

    const renderer = new Renderer(svgHostRef.current, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();
    context.scale(mergedConfig.scaleX, scaleY);

    const stave = new Stave(mergedConfig.staveX, staveY, staveWidth);
    stave.addClef(clef).setContext(context).draw();

    if (keyAccidentals.length > 0) {
      const keyLineMap = clef === "treble" ? TREBLE_KEY_SIG_LINES : BASS_KEY_SIG_LINES;
      const svg = svgHostRef.current.querySelector("svg");
      const rootGroup = svg?.querySelector("g");

      if (rootGroup) {
        const ns = "http://www.w3.org/2000/svg";
        const sorted = [...keyAccidentals].sort((a, b) => {
          if (a.accidental === b.accidental) return 0;
          return a.accidental === "#" ? -1 : 1;
        });

        sorted.forEach((accidental, i) => {
          const symbol = accidental.accidental === "#" ? "♯" : "♭";
          const line = keyLineMap[accidental.key] ?? 2;
          const x = mergedConfig.keySignature.startX + i * mergedConfig.keySignature.spacing;
          const y = stave.getYForLine(line);

          const glyph = document.createElementNS(ns, "text");
          glyph.setAttribute("x", String(x));
          glyph.setAttribute("y", String(y + mergedConfig.keySignature.yOffset));
          glyph.setAttribute("font-size", String(mergedConfig.keySignature.fontSize));
          glyph.setAttribute("font-weight", "bold");
          glyph.setAttribute("font-family", "serif");
          glyph.setAttribute("fill", mergedConfig.keySignature.color);
          glyph.textContent = symbol;
          rootGroup.appendChild(glyph);
        });
      }
    }

    const staveNotes = notes.map((note) => {
      const vfNote = new StaveNote({
        clef,
        keys: [`${note.key.toLowerCase()}/${note.octave}`],
        duration: "q",
      });

      if (note.accidental && keyAccidentals.length === 0) {
        vfNote.addModifier(new Accidental(note.accidental));
      }

      vfNote.setStyle({
        fillStyle: mergedConfig.noteColors.future,
        strokeStyle: mergedConfig.noteColors.future,
      });
      return vfNote;
    });

    const voice = new Voice({ numBeats: notes.length, beatValue: 4 });
    voice.addTickables(staveNotes);

    const keyOffset = keyAccidentals.length > 0 ? keyAccidentals.length * 12 + 20 : 0;
    if (keyOffset > 0) {
      stave.setNoteStartX(stave.getNoteStartX() + keyOffset);
    }

    const noteArea = staveWidth - (stave.getNoteStartX() - mergedConfig.staveX) - mergedConfig.horizontalNotePadding;
    const formatterWidth = Math.max(noteArea, 100);
    new Formatter().joinVoices([voice]).format([voice], formatterWidth);
    voice.draw(context, stave);

    noteGroupsRef.current = Array.from(
      svgHostRef.current.querySelectorAll<SVGGElement>("g.vf-stavenote"),
    );
    colorNoteGroups(noteGroupsRef.current, currentIndex, mergedConfig);
  }, [notes, clef, isAdvanced, keyAccidentals, frameWidth, mergedConfig, currentIndex]);

  // Dynamic update layer: only color update on quiz progress.
  useEffect(() => {
    colorNoteGroups(noteGroupsRef.current, currentIndex, mergedConfig);
  }, [currentIndex, mergedConfig]);

  return (
    <div
      ref={frameRef}
      className={`w-full max-w-[500px] mx-auto bg-white rounded-3xl shadow-2xl flex items-center justify-center border-4 border-gray-50 transition-all py-4 px-2 ${shake ? "animate-bounce" : ""}`}
    >
      <div ref={svgHostRef} className="w-full flex justify-center" style={{ overflow: "visible" }} />
    </div>
  );
}
