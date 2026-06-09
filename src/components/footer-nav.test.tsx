// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";

// 依存フック・OCR ボタンは差し替え、フッターの「表示の出し分け」と「カメラ→openCreate」配線に集中する。
const h = vi.hoisted(() => ({
  openCreate: vi.fn(),
  openSettings: vi.fn(),
  notify: vi.fn(),
  session: { unlocked: true as boolean | null },
  ocr: { amount: 500, storeName: null, spentAt: "2026-05-01", categoryId: null },
}));

vi.mock("@/components/expense-modal", () => ({
  useExpenseModal: () => ({ openCreate: h.openCreate, notify: h.notify }),
}));
vi.mock("@/components/settings-modal", () => ({
  useSettingsModal: () => ({ openSettings: h.openSettings }),
}));
vi.mock("@/components/session-provider", () => ({
  useSession: () => ({ unlocked: h.session.unlocked }),
}));
vi.mock("@/components/receipt-capture-button", () => ({
  ReceiptCaptureButton: ({
    onResult,
    "aria-label": label,
  }: {
    onResult: (r: typeof h.ocr) => void;
    "aria-label"?: string;
  }) => (
    <button type="button" aria-label={label} onClick={() => onResult(h.ocr)}>
      camera
    </button>
  ),
}));

import { FooterNav } from "./footer-nav";

const CAMERA = "レシートで続けて支出を登録（連続入力）";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.session.unlocked = true;
});

describe("FooterNav", () => {
  it("保存済み: 設定・カメラ・登録FAB が出る", () => {
    render(<FooterNav />);
    expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CAMERA })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "支出を登録" })).toBeInTheDocument();
  });

  it("カメラの読み取り結果は openCreate({ocr, keepOpen:true}) を呼ぶ", () => {
    render(<FooterNav />);
    fireEvent.click(screen.getByRole("button", { name: CAMERA }));
    expect(h.openCreate).toHaveBeenCalledWith({ ocr: h.ocr, keepOpen: true });
  });

  it("未保存: 設定のみ（カメラ・FABは出さない・設定にバッジ文言）", () => {
    h.session.unlocked = false;
    render(<FooterNav />);
    expect(
      screen.getByRole("button", { name: "設定（世帯コード未保存）" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: CAMERA })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "支出を登録" })
    ).not.toBeInTheDocument();
  });
});
