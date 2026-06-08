// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { CategoryTag } from "./category-tag";
import { categoryColor } from "@/lib/category-color";

afterEach(() => {
  // globals 無効のため明示的に DOM を破棄する（bottom-sheet.test と同様）。
  cleanup();
});

describe("CategoryTag", () => {
  it("カテゴリ名を表示する", () => {
    render(<CategoryTag name="食費" sortOrder={0} />);
    expect(screen.getByText("食費")).toBeInTheDocument();
  });

  it("sortOrder に対応する色クラス(tag)を当てる", () => {
    render(<CategoryTag name="食費" sortOrder={3} />);
    const pill = screen.getByText("食費");
    for (const cls of categoryColor(3).tag.split(" ")) {
      expect(pill).toHaveClass(cls);
    }
  });

  it("色は sortOrder を 16 で巡回させる（16 と 0 は同色）", () => {
    expect(categoryColor(16).tag).toBe(categoryColor(0).tag);
    render(<CategoryTag name="A" sortOrder={16} />);
    const pill = screen.getByText("A");
    for (const cls of categoryColor(0).tag.split(" ")) {
      expect(pill).toHaveClass(cls);
    }
  });

  it("truncate 未指定: 名前を直接描画し min-w-0/内側 truncate を付けない", () => {
    render(<CategoryTag name="食費" sortOrder={0} />);
    const pill = screen.getByText("食費");
    expect(pill).not.toHaveClass("min-w-0");
    expect(pill.querySelector(".truncate")).toBeNull();
  });

  it("truncate 指定: 外側に min-w-0、内側 truncate span で名前を包む", () => {
    render(<CategoryTag name="とても長いカテゴリ名" sortOrder={0} truncate />);
    const inner = screen.getByText("とても長いカテゴリ名");
    expect(inner).toHaveClass("truncate");
    const pill = inner.parentElement!;
    expect(pill).toHaveClass("min-w-0");
    // 色は外側のピルに付く
    for (const cls of categoryColor(0).tag.split(" ")) {
      expect(pill).toHaveClass(cls);
    }
  });
});
