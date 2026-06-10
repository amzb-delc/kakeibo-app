// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { HeaderCharacter } from "./header-character";

afterEach(cleanup);

describe("HeaderCharacter", () => {
  it("「今月へ移動」ボタンとして常時描画される", () => {
    render(<HeaderCharacter />);
    expect(
      screen.getByRole("button", { name: "今月へ移動" })
    ).toBeInTheDocument();
  });

  it("タップで onPress が呼ばれる（当月ジャンプ用）", () => {
    const onPress = vi.fn();
    render(<HeaderCharacter onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "今月へ移動" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("onPress 無しでもタップで落ちない", () => {
    render(<HeaderCharacter />);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "今月へ移動" }))
    ).not.toThrow();
  });
});
