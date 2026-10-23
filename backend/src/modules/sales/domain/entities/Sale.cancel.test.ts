import { test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError } from "@shared/domain/errors";
import { Sale } from "./Sale";
import { SaleStatus } from "../enums/SaleStatus";

test("Sale.cancel em venda já cancelada → ConflictError SALE_ALREADY_CANCELED", () => {
  const sale = new Sale({ customerId: "c", items: [], status: SaleStatus.CANCELED });
  assert.throws(
    () => sale.cancel(),
    (e: any) => e instanceof ConflictError && e.code === "SALE_ALREADY_CANCELED",
  );
});
