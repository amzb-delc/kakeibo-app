import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./cookie-sign";

describe("signSession / verifySession", () => {
  it("署名→検証で元の値に戻る", () => {
    const signed = signSession("夫婦の合言葉");
    expect(signed).not.toBe("夫婦の合言葉");
    expect(verifySession(signed)).toBe("夫婦の合言葉");
  });

  it('"." を含む世帯コードも往復できる（最後の "." で分割）', () => {
    const value = "my.secret.code";
    expect(verifySession(signSession(value))).toBe(value);
  });

  it("署名部を改竄すると null", () => {
    const signed = signSession("夫婦の合言葉");
    const tampered = signed.slice(0, -1) + (signed.endsWith("A") ? "B" : "A");
    expect(verifySession(tampered)).toBeNull();
  });

  it("値部を改竄すると null（署名と不整合）", () => {
    const signed = signSession("夫婦の合言葉");
    const sig = signed.slice(signed.lastIndexOf("."));
    expect(verifySession("別の世帯" + sig)).toBeNull();
  });

  it("未署名（旧 cookie 形式の素の値）は null", () => {
    expect(verifySession("夫婦の合言葉")).toBeNull();
  });

  it("空文字・区切りのみは null", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession(".abc")).toBeNull();
  });
});
