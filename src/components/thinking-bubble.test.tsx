// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ThinkingBubble } from "./thinking-bubble";

afterEach(cleanup);

// 装飾用の「考え中」吹き出し。aria-hidden の純粋な見た目要素なので、
// 描画されること・side で開く向き（配置クラス）が切り替わることだけを確認する。
describe("ThinkingBubble", () => {
  function rootOf(container: HTMLElement): HTMLElement {
    const el = container.querySelector('[aria-hidden="true"]');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  }

  it("装飾なので aria-hidden で描画される", () => {
    const { container } = render(<ThinkingBubble />);
    expect(rootOf(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("既定（side=left）は左上基準で開く", () => {
    const { container } = render(<ThinkingBubble />);
    const root = rootOf(container);
    expect(root).toHaveClass("left-7", "top-6");
    expect(root).not.toHaveClass("right-9");
  });

  it('side="right" は画面右端で見切れないよう右上基準で開く', () => {
    const { container } = render(<ThinkingBubble side="right" />);
    const root = rootOf(container);
    expect(root).toHaveClass("right-9", "top-4");
    expect(root).not.toHaveClass("left-7");
  });

  it("背後の操作を妨げないよう pointer-events-none", () => {
    const { container } = render(<ThinkingBubble />);
    expect(rootOf(container)).toHaveClass("pointer-events-none");
  });
});
