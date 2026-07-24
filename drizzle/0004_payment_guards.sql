CREATE TRIGGER order_paid_amount_guard
BEFORE UPDATE OF paid_cents ON orders
FOR EACH ROW
WHEN NEW.paid_cents < 0 OR NEW.paid_cents > NEW.payable_cents
BEGIN
  SELECT RAISE(ABORT, 'ORDER_PAYMENT_EXCEEDS_PAYABLE');
END;

CREATE TRIGGER order_payment_status_guard
BEFORE UPDATE OF paid_cents ON orders
FOR EACH ROW
WHEN OLD.status <> 'pending_payment' OR OLD.paid_cents <> 0
BEGIN
  SELECT RAISE(ABORT, 'ORDER_NOT_PAYABLE');
END;

CREATE TRIGGER payment_allocation_guard
BEFORE INSERT ON payment_allocations
FOR EACH ROW
WHEN NEW.amount_cents <= 0
BEGIN
  SELECT RAISE(ABORT, 'INVALID_PAYMENT_ALLOCATION');
END;
