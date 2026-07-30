-- POSKESTREN follow-up indexes and account-link cleanup.

-- Keep both period-first and entity-first access paths. The first supports
-- monthly reports; this one supports a medicine-filtered stock card.
CREATE INDEX IF NOT EXISTS idx_pos_stock_movement_medicine_period
  ON poskestren_stock_movement(medicine_id, movement_date, movement_type);

CREATE INDEX IF NOT EXISTS idx_pos_purchase_cursor
  ON poskestren_purchase(purchase_date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pos_stock_movement_cursor
  ON poskestren_stock_movement(movement_date DESC, created_at DESC, id DESC);

-- When a personnel record is linked to a different account, revoke only the
-- POSKESTREN-specific roles from the former account. Other application roles
-- remain untouched.
CREATE TRIGGER IF NOT EXISTS trg_pos_personnel_unlink_user
AFTER UPDATE OF user_id ON poskestren_personnel
WHEN OLD.user_id IS NOT NULL
 AND (NEW.user_id IS NULL OR NEW.user_id <> OLD.user_id)
BEGIN
  UPDATE users
  SET roles = COALESCE((
        SELECT json_group_array(value)
        FROM json_each(COALESCE(users.roles, '[]'))
        WHERE value <> 'poskestren'
          AND value NOT LIKE 'poskestren:%'
      ), '[]'),
      poskestren_jabatan = NULL,
      updated_at = datetime('now')
  WHERE id = OLD.user_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_pos_personnel_delete_user
AFTER DELETE ON poskestren_personnel
WHEN OLD.user_id IS NOT NULL
BEGIN
  UPDATE users
  SET roles = COALESCE((
        SELECT json_group_array(value)
        FROM json_each(COALESCE(users.roles, '[]'))
        WHERE value <> 'poskestren'
          AND value NOT LIKE 'poskestren:%'
      ), '[]'),
      poskestren_jabatan = NULL,
      updated_at = datetime('now')
  WHERE id = OLD.user_id;
END;
