import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/safe-next";

describe("post-login redirect (?next=)", () => {
  it.each([
    ["/", "/"],
    ["/members", "/members"],
    ["/members/3f2a?tab=audit#top", "/members/3f2a?tab=audit#top"],
    ["/members/../security", "/security"],
  ])("keeps the dashboard path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "http://evil.example/members",
    "//evil.example",
    "//evil.example/members",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "members",
    " /members",
    "data:text/html,hi",
  ])("refuses %j and falls back to the overview", (raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });
});
