/**
 * One measurement of the visual viewport, shared by the footer chrome inset
 * (#27) and every fixed surface that can sit under the iOS keyboard.
 *
 * iOS Safari keeps `position: fixed; bottom: 0` on the layout viewport while
 * the keyboard scrolls and shrinks the visual viewport. The strip between
 * those bottoms is `layoutHeight - (visualViewport.height + visualViewport.offsetTop)`.
 * A short strip is the Safari toolbar. A taller strip is the keyboard.
 */

export const MAX_BROWSER_CHROME_BOTTOM = 100;

export type ViewportSample = {
  layoutHeight: number;
  height: number;
  offsetTop: number;
  scale: number;
  textFocused: boolean;
};

export type KeyboardFrame = {
  /** The keyboard is covering the layout viewport, so fixed UI must move. */
  open: boolean;
  /** Pin `bottom` to the visual viewport bottom. 0 when the keyboard is closed. */
  bottom: number;
  /** Cap `max-height` at the visual viewport height. 0 when the keyboard is closed. */
  height: number;
};

const CLOSED_FRAME: KeyboardFrame = { open: false, bottom: 0, height: 0 };

export function layoutViewportGap(layoutHeight: number, height: number, offsetTop: number): number {
  return Math.max(0, Math.round(layoutHeight - (height + offsetTop)));
}

/** Text inputs and textareas bring up the iOS keyboard. Selects and buttons do not. */
export function textFieldIsFocused(active: EventTarget | null): boolean {
  if (!active || typeof HTMLElement === "undefined") return false;
  if (!(active instanceof HTMLElement)) return false;
  if (active === document.body || active === document.documentElement) return false;
  if (active instanceof HTMLTextAreaElement) return true;
  if (active.isContentEditable) return true;
  if (!(active instanceof HTMLInputElement)) return false;
  const nonText = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ]);
  return !nonText.has(active.type);
}

/**
 * Toolbar gap for the in-flow footer spacer.
 * Null means leave the published value alone: pinch-zoom, a focused field,
 * or a gap taller than the toolbar (the keyboard).
 */
export function browserChromeBottom(sample: ViewportSample): number | null {
  if (sample.scale !== 1 || sample.textFocused) return null;
  const covered = layoutViewportGap(sample.layoutHeight, sample.height, sample.offsetTop);
  if (covered > MAX_BROWSER_CHROME_BOTTOM) return null;
  return Math.min(MAX_BROWSER_CHROME_BOTTOM, covered);
}

/** Lift fixed UI by the keyboard gap and cap it to the visible height. */
export function keyboardFrame(sample: ViewportSample): KeyboardFrame {
  if (sample.scale !== 1) return CLOSED_FRAME;
  const bottom = layoutViewportGap(sample.layoutHeight, sample.height, sample.offsetTop);
  if (bottom <= MAX_BROWSER_CHROME_BOTTOM) return CLOSED_FRAME;
  return { open: true, bottom, height: sample.height };
}

/** Inline style for a fixed overlay so it fills the visual viewport. */
export function fixedViewportStyle(frame: KeyboardFrame):
  | { top: "auto"; bottom: number; height: number; maxHeight: number }
  | undefined {
  if (!frame.open) return undefined;
  return { top: "auto", bottom: frame.bottom, height: frame.height, maxHeight: frame.height };
}

type Listener = () => void;

let currentFrame: KeyboardFrame = CLOSED_FRAME;
const listeners = new Set<Listener>();

export function getKeyboardFrame(): KeyboardFrame {
  return currentFrame;
}

export function getServerKeyboardFrame(): KeyboardFrame {
  return CLOSED_FRAME;
}

export function subscribeKeyboardFrame(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishKeyboardFrame(next: KeyboardFrame) {
  if (
    next.open === currentFrame.open &&
    next.bottom === currentFrame.bottom &&
    next.height === currentFrame.height
  ) {
    return;
  }
  currentFrame = next;
  for (const listener of listeners) listener();
}
