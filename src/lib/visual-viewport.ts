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
  /** Horizontal pan of the visual viewport. iOS sets this when a focused field is recentered. */
  offsetLeft: number;
  /** Visual viewport width. 0 when the sample has not been measured yet. */
  width: number;
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
  /** Pin `left` so a fixed sheet stays on screen when iOS pans sideways. */
  offsetLeft: number;
  /** Visual viewport width. 0 means the overlay should use 100% of its containing block. */
  width: number;
};

const CLOSED_FRAME: KeyboardFrame = { open: false, bottom: 0, height: 0, offsetLeft: 0, width: 0 };

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

function viewportBox(sample: ViewportSample): { offsetLeft: number; width: number } {
  return {
    offsetLeft: Math.max(0, Math.round(sample.offsetLeft || 0)),
    width: Math.max(0, Math.round(sample.width || 0)),
  };
}

/** Lift fixed UI by the keyboard gap and cap it to the visible height. */
export function keyboardFrame(sample: ViewportSample): KeyboardFrame {
  const box = viewportBox(sample);
  if (sample.scale !== 1) return { ...CLOSED_FRAME, ...box };
  const bottom = layoutViewportGap(sample.layoutHeight, sample.height, sample.offsetTop);
  if (bottom <= MAX_BROWSER_CHROME_BOTTOM) return { ...CLOSED_FRAME, ...box };
  return { open: true, bottom, height: sample.height, ...box };
}

/**
 * Inline style for every fixed overlay.
 * The horizontal lock is always on, so a sheet cannot grow past the screen
 * or follow a sideways pan. The keyboard lift is added only while it is open.
 * Width is the visual viewport when measured; otherwise 100% (not 100vw,
 * which is wider than the screen once padding is added).
 */
export function fixedViewportStyle(frame: KeyboardFrame): {
  overflowX: "hidden";
  maxWidth: "100vw";
  overscrollBehavior: "contain";
  boxSizing: "border-box";
  left: number;
  right: "auto";
  width: number | "100%";
  top?: "auto";
  bottom?: number;
  height?: number;
  maxHeight?: number;
} {
  const style: {
    overflowX: "hidden";
    maxWidth: "100vw";
    overscrollBehavior: "contain";
    boxSizing: "border-box";
    left: number;
    right: "auto";
    width: number | "100%";
    top?: "auto";
    bottom?: number;
    height?: number;
    maxHeight?: number;
  } = {
    overflowX: "hidden",
    maxWidth: "100vw",
    overscrollBehavior: "contain",
    boxSizing: "border-box",
    left: frame.offsetLeft,
    right: "auto",
    width: frame.width > 0 ? frame.width : "100%",
  };
  if (!frame.open) return style;
  style.top = "auto";
  style.bottom = frame.bottom;
  style.height = frame.height;
  style.maxHeight = frame.height;
  return style;
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
    next.height === currentFrame.height &&
    next.offsetLeft === currentFrame.offsetLeft &&
    next.width === currentFrame.width
  ) {
    return;
  }
  currentFrame = next;
  for (const listener of listeners) listener();
}
