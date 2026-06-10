import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// jsdom ships neither matchMedia nor ResizeObserver. Polyfill both so libraries
// and hooks that depend on them under test (Embla carousel, the use-mobile hook)
// initialise instead of throwing.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom has no layout engine, so every element measures 0×0. Report a non-zero
// clientWidth so width-measuring components (react-photo-album) render content.
const JSDOM_CLIENT_WIDTH = 1024;
Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get: () => JSDOM_CLIENT_WIDTH,
});

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}
