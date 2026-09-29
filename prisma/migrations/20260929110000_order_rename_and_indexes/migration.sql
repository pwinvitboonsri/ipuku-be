-- Rename columns (keeps data, unlike DROP + ADD)
ALTER TABLE "Order" RENAME COLUMN "subtotal_stang" TO "subtotal_satang";
ALTER TABLE "OrderItem" RENAME COLUMN "line_to_total_satang" TO "line_total_satang";
ALTER TABLE "OrderItem" RENAME COLUMN "productNameSnapshot" TO "product_name_snapshot";

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_cash_session_id_order_number_key" ON "Order"("cash_session_id", "order_number");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_idx" ON "OrderItem"("order_id");

-- CreateIndex
CREATE INDEX "OrderItemModifier_order_item_id_idx" ON "OrderItemModifier"("order_item_id");
