CREATE TRIGGER inventory_reservation_guard
BEFORE UPDATE OF reserved_qty ON inventory
FOR EACH ROW
WHEN NEW.reserved_qty < 0 OR NEW.reserved_qty > NEW.available_qty
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_INVENTORY');
END;

CREATE TRIGGER account_balance_guard
BEFORE UPDATE OF balance_cents ON welfare_accounts
FOR EACH ROW
WHEN NEW.balance_cents < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_ACCOUNT_BALANCE');
END;

CREATE TRIGGER account_ledger_no_update
BEFORE UPDATE ON account_ledgers
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_LEDGER_IS_IMMUTABLE');
END;

CREATE TRIGGER account_ledger_active_account_guard
BEFORE INSERT ON account_ledgers
FOR EACH ROW
WHEN (
  SELECT status FROM welfare_accounts WHERE id = NEW.account_id
) <> 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_NOT_ACTIVE');
END;

CREATE TRIGGER account_ledger_no_delete
BEFORE DELETE ON account_ledgers
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_LEDGER_IS_IMMUTABLE');
END;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_LOG_IS_IMMUTABLE');
END;

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_LOG_IS_IMMUTABLE');
END;
