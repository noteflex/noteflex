/**
 * §4 Step B (2026-05-02) — vite-node 실행을 위한 브라우저 globals 폴리필.
 *
 * 사용처: scripts/run-simulation.ts, scripts/analyze-sim-logs.ts.
 * 이유: simulator는 NoteGame.tsx의 pure helper (generateBatch, getNotesForLevel,
 * getClefForLevel)를 import — 그러나 NoteGame.tsx 트리에 supabase client.ts가
 * 있어 top-level `localStorage` 참조 발생. Node 환경에서 `localStorage` 미정의
 * → ReferenceError.
 *
 * 폴리필은 simulator 동작에 영향 X (helper들 자체는 localStorage 미사용).
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(idx: number): string | null {
    return Array.from(this.store.keys())[idx] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const g = globalThis as unknown as {
  localStorage?: Storage;
  sessionStorage?: Storage;
  window?: unknown;
};

if (!g.localStorage) g.localStorage = new MemoryStorage();
if (!g.sessionStorage) g.sessionStorage = new MemoryStorage();
if (!g.window) g.window = { localStorage: g.localStorage, sessionStorage: g.sessionStorage };
