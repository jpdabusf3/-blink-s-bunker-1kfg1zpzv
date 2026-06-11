migrate(
  (app) => {
    // This is a placeholder migration.
    // The actual backend logic for monitoring targets is implemented
    // in pocketbase/hooks/on_order_create_evaluate.js and
    // pocketbase/hooks/on_order_update_evaluate.js since hooks
    // are loaded automatically by the runtime and cannot be
    // registered via the database migrations.
  },
  (app) => {},
)
