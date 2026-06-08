// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { useRef } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useSwipeNavigation } from "./use-swipe-navigation";

afterEach(() => {
  cleanup();
});

function Harness(props: {
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  enabled: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipeNavigation(ref, props);
  return <div ref={ref} data-testid="area" />;
}

// jsdom は TouchEvent を実装しないため、touches/changedTouches を持つ合成イベントを作る。
function touch(type: string, x: number, y: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const pts = [{ clientX: x, clientY: y }];
  Object.assign(ev, { touches: pts, changedTouches: pts });
  return ev;
}

function dispatchSwipe(
  el: Element,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  el.dispatchEvent(touch("touchstart", from.x, from.y));
  el.dispatchEvent(touch("touchmove", (from.x + to.x) / 2, (from.y + to.y) / 2));
  el.dispatchEvent(touch("touchend", to.x, to.y));
}

function setup(enabled = true) {
  const onSwipeRight = vi.fn();
  const onSwipeLeft = vi.fn();
  render(
    <Harness onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} enabled={enabled} />
  );
  return { el: screen.getByTestId("area"), onSwipeRight, onSwipeLeft };
}

describe("useSwipeNavigation", () => {
  it("右スワイプ（横移動が優位）で onSwipeRight", () => {
    const { el, onSwipeRight, onSwipeLeft } = setup();
    dispatchSwipe(el, { x: 80, y: 100 }, { x: 220, y: 100 });
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("左スワイプで onSwipeLeft", () => {
    const { el, onSwipeRight, onSwipeLeft } = setup();
    dispatchSwipe(el, { x: 220, y: 100 }, { x: 80, y: 100 });
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("enabled=false なら発火しない", () => {
    const { el, onSwipeRight, onSwipeLeft } = setup(false);
    dispatchSwipe(el, { x: 220, y: 100 }, { x: 80, y: 100 });
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("移動量が SWIPE_MIN(36px) 未満なら発火しない", () => {
    const { el, onSwipeRight, onSwipeLeft } = setup();
    dispatchSwipe(el, { x: 200, y: 100 }, { x: 180, y: 100 }); // dx=-20
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("縦移動が優位なら発火しない（誤タップ防止）", () => {
    const { el, onSwipeRight, onSwipeLeft } = setup();
    dispatchSwipe(el, { x: 200, y: 100 }, { x: 160, y: 300 }); // dx=-40, dy=200
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
