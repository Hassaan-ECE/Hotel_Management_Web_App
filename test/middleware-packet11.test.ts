import { describe, expect, mock, test } from "bun:test";

let clerkMiddlewareCalls = 0;
const middlewareHandler = Symbol("middlewareHandler");

mock.module("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => {
    clerkMiddlewareCalls += 1;
    return middlewareHandler;
  },
}));

const middlewareModule = await import("../middleware");

describe("packet 11 Clerk middleware", () => {
  test("exports Clerk middleware and matches app plus API routes", () => {
    expect(clerkMiddlewareCalls).toBe(1);
    expect((middlewareModule.default as unknown) === middlewareHandler).toBe(true);
    expect(middlewareModule.config.matcher).toEqual([
      "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
      "/(api)(.*)",
    ]);
  });
});
