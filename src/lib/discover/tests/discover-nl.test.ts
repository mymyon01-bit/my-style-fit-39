/**
 * Discover natural-language regression tests
 * ------------------------------------------
 * Protects intent parsing + KR mood map + ladder fallback contracts.
 */
import { describe, it, expect } from "vitest";
import { parseIntent, summarizeIntent } from "@/lib/discover/discover-intent-parser";
import { resolveKrAliases } from "@/lib/discover/krAliasMap";
import { shouldUseAiFallback } from "@/lib/discover/discover-intent-ai";

describe("Discover NL :: intent parser", () => {
  it("'힙한 가방' → bags + streetwear/edgy mood", () => {
    const i = parseIntent("힙한 가방");
    expect(i.language).toBe("ko");
    expect(i.primaryCategory).toBe("bags");
    expect(i.moodTags).toContain("edgy");
    expect(i.enAliases).toEqual(expect.arrayContaining(["bag"]));
  });

  it("'red shoes' → shoes + red color", () => {
    const i = parseIntent("red shoes");
    expect(i.language).toBe("en");
    expect(i.primaryCategory).toBe("shoes");
    expect(i.color).toBe("red");
  });

  it("'Gucci loafers' → brand + shoes lock", () => {
    const i = parseIntent("Gucci loafers");
    expect(i.brand).toBe("gucci");
    expect(i.primaryCategory).toBe("shoes");
  });

  it("'꾸안꾸 느낌' → effortless mood", () => {
    const i = parseIntent("꾸안꾸 느낌");
    expect(i.language).toBe("ko");
    expect(i.moodTags).toContain("effortless");
  });

  it("'뉴욕 스트릿 미니멀' → streetwear + minimal style, mixed if Latin present", () => {
    const i = parseIntent("뉴욕 스트릿 미니멀");
    expect(i.language).toBe("ko");
    expect(i.enAliases.some((a) => /street|urban/.test(a))).toBe(true);
  });

  it("'코트 코디' → outerwear lock via KR family hint", () => {
    const i = parseIntent("코트 코디");
    expect(i.primaryCategory).toBe("outerwear");
  });

  it("'date night outfit' → occasion detected", () => {
    const i = parseIntent("date night outfit");
    expect(i.occasion).toBe("date night");
  });

  it("summarizeIntent produces non-empty chips for emotional KR query", () => {
    const i = parseIntent("힙한 가방");
    const chips = summarizeIntent(i);
    expect(chips.length).toBeGreaterThan(0);
  });
});

describe("Discover NL :: KR mood map", () => {
  it("꾸안꾸 maps to effortless/minimal-relaxed", () => {
    const r = resolveKrAliases("꾸안꾸");
    expect(r.aliases).toEqual(expect.arrayContaining(["effortless"]));
  });
  it("깔끔한 maps to minimal/clean", () => {
    const r = resolveKrAliases("깔끔한");
    expect(r.aliases).toEqual(expect.arrayContaining(["minimal"]));
  });
  it("뉴욕 스트릿 maps to nyc streetwear", () => {
    const r = resolveKrAliases("뉴욕 스트릿");
    expect(r.aliases.some((a) => /street|nyc|urban/.test(a))).toBe(true);
  });
});

describe("Discover NL :: AI fallback gating", () => {
  it("does NOT call AI when deterministic signal exists", () => {
    expect(shouldUseAiFallback(parseIntent("Gucci loafers"))).toBe(false);
    expect(shouldUseAiFallback(parseIntent("힙한 가방"))).toBe(false);
    expect(shouldUseAiFallback(parseIntent("red shoes"))).toBe(false);
  });
  it("DOES call AI for fully unknown gibberish queries", () => {
    expect(shouldUseAiFallback(parseIntent("zxqwerty mood thing"))).toBe(true);
  });
});
