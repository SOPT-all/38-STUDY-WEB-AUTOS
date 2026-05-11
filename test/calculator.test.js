import { describe, expect, test } from "vitest";
import { add } from "../src/calculator.js";

describe("add 함수 테스트", () => {
  test("두 숫자를 더한 값을 반환한다", () => {
    expect(add(1, 2)).toBe(3);
  });
});
