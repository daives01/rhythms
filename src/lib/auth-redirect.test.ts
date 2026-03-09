import { describe, expect, test } from "bun:test"
import {
  AUTH_MODAL_PARAM,
  RETURN_TO_PARAM,
  buildAuthSearch,
  getReturnToFromLocation,
  normalizeReturnTo,
  stripAuthSearch,
} from "./auth-redirect"

describe("auth redirect helpers", () => {
  test("builds a returnTo from location parts", () => {
    expect(
      getReturnToFromLocation({
        pathname: "/groups/123",
        search: "?tab=members",
        hash: "#invite",
      })
    ).toBe("/groups/123?tab=members#invite")
  })

  test("normalizes safe in-app returnTo values", () => {
    expect(normalizeReturnTo("/groups/123?tab=members")).toBe("/groups/123?tab=members")
  })

  test("rejects external or protocol-relative returnTo values", () => {
    expect(normalizeReturnTo("https://evil.example")).toBe("/")
    expect(normalizeReturnTo("//evil.example")).toBe("/")
  })

  test("adds auth params without dropping existing search params", () => {
    const search = buildAuthSearch("?tab=members", "/groups/123")
    const params = new URLSearchParams(search)

    expect(params.get("tab")).toBe("members")
    expect(params.get(AUTH_MODAL_PARAM)).toBe("1")
    expect(params.get(RETURN_TO_PARAM)).toBe("/groups/123")
  })

  test("strips only auth params from search", () => {
    expect(stripAuthSearch("?tab=members&auth=1&returnTo=%2Fgroups%2F123")).toBe("?tab=members")
  })
})
