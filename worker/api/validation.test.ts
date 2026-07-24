import { describe, expect, it } from "vitest";
import {
  parseCreateOrderInput,
  parseInternalPaymentInput,
} from "./validation";

const validInput = {
  items: [{ skuId: "sku-rice-5kg", quantity: 2 }],
  recipient: {
    name: "张三",
    mobile: "13800138000",
    province: "湖北省",
    city: "武汉市",
    district: "武昌区",
    address: "友谊大道100号",
  },
};

describe("parseCreateOrderInput", () => {
  it("accepts a valid order", () => {
    expect(parseCreateOrderInput(validInput)).toEqual(validInput);
  });

  it("rejects duplicate SKUs", () => {
    expect(
      parseCreateOrderInput({
        ...validInput,
        items: [
          { skuId: "sku-rice-5kg", quantity: 1 },
          { skuId: "sku-rice-5kg", quantity: 2 },
        ],
      })
    ).toBeNull();
  });

  it("rejects invalid quantities and phone numbers", () => {
    expect(
      parseCreateOrderInput({
        ...validInput,
        items: [{ skuId: "sku-rice-5kg", quantity: 0 }],
      })
    ).toBeNull();
    expect(
      parseCreateOrderInput({
        ...validInput,
        recipient: { ...validInput.recipient, mobile: "123" },
      })
    ).toBeNull();
  });
});

describe("parseInternalPaymentInput", () => {
  it("accepts a valid mixed internal payment", () => {
    expect(
      parseInternalPaymentInput({ welfareCents: 8000, mealCents: 900 })
    ).toEqual({ welfareCents: 8000, mealCents: 900 });
  });

  it("rejects zero, negative and fractional allocations", () => {
    expect(
      parseInternalPaymentInput({ welfareCents: 0, mealCents: 0 })
    ).toBeNull();
    expect(
      parseInternalPaymentInput({ welfareCents: -1, mealCents: 100 })
    ).toBeNull();
    expect(
      parseInternalPaymentInput({ welfareCents: 10.5, mealCents: 0 })
    ).toBeNull();
  });
});
