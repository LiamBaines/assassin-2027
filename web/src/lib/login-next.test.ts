import { describe, expect, it } from "vitest";
import { confirmRedirectUrl, loginPathWithNext, returnPathFromConfirm } from "./login-next";

describe("loginPathWithNext", () => {
  it("keeps the original path and query as next", () => {
    expect(loginPathWithNext("/join/ABC123", "")).toBe("/login?next=%2Fjoin%2FABC123");
    expect(loginPathWithNext("/games/g1", "?x=1&y=2")).toBe(
      "/login?next=%2Fgames%2Fg1%3Fx%3D1%26y%3D2",
    );
  });

  it("drops next for the home page", () => {
    expect(loginPathWithNext("/", "")).toBe("/login");
  });

  it("drops an unsafe path", () => {
    expect(loginPathWithNext("//evil.com", "")).toBe("/login");
  });
});

describe("confirmRedirectUrl", () => {
  it("adds an encoded next", () => {
    expect(confirmRedirectUrl("http://localhost:3000/", "/join/ABC123")).toBe(
      "http://localhost:3000/auth/confirm?next=%2Fjoin%2FABC123",
    );
  });

  it("omits next for the home page and for unsafe values", () => {
    expect(confirmRedirectUrl("https://x.app", "/")).toBe("https://x.app/auth/confirm");
    expect(confirmRedirectUrl("https://x.app", "//evil.com")).toBe(
      "https://x.app/auth/confirm",
    );
    expect(confirmRedirectUrl("https://x.app", "https://evil.com/")).toBe(
      "https://x.app/auth/confirm",
    );
  });
});

describe("returnPathFromConfirm", () => {
  const params = (q: string) => new URLSearchParams(q);

  it("reads next from inside redirect_to", () => {
    const redirectTo = confirmRedirectUrl("http://localhost:3000", "/join/ABC123");
    expect(
      returnPathFromConfirm(params(`token_hash=t&type=email&redirect_to=${encodeURIComponent(redirectTo)}`)),
    ).toBe("/join/ABC123");
  });

  it("falls back to next when redirect_to has none", () => {
    expect(returnPathFromConfirm(params("redirect_to=http%3A%2F%2Flocalhost%3A3000&next=%2Fme"))).toBe(
      "/me",
    );
    expect(returnPathFromConfirm(params("next=/"))).toBe("/");
    expect(returnPathFromConfirm(params(""))).toBe("/");
  });

  it("sanitises the inner next", () => {
    expect(
      returnPathFromConfirm(params(`redirect_to=${encodeURIComponent("http://x/auth/confirm?next=%2F%2Fevil.com")}`)),
    ).toBe("/");
    expect(
      returnPathFromConfirm(params(`redirect_to=${encodeURIComponent("http://x/auth/confirm?next=%2F.%2F%2Fevil.com")}`)),
    ).toBe("/");
  });
});
