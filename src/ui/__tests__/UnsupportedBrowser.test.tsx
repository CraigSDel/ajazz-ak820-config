import { render } from "@testing-library/preact";
import { describe, expect, test } from "vitest";
import { UnsupportedBrowser } from "../UnsupportedBrowser";

describe("UnsupportedBrowser", () => {
  test("mentions Chrome and Edge", () => {
    const { getAllByText } = render(<UnsupportedBrowser />);
    const matches = getAllByText(/Chrome.*Edge/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
