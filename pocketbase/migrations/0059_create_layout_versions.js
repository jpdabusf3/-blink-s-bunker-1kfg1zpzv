migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    const collection = new Collection({
      name: 'layout_versions',
      type: 'base',
      // Only the owner can read/write their layout versions.
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != "" && user = @request.auth.id',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'page_name', type: 'text', required: true },
        { name: 'config_data', type: 'text', required: true },
        { name: 'version_label', type: 'text' },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_layout_versions_user ON layout_versions (user)',
        'CREATE INDEX idx_layout_versions_page_name ON layout_versions (page_name)',
        'CREATE INDEX idx_layout_versions_created ON layout_versions (created DESC)',
        // Enforce at most one active version per (user, page_name).
        'CREATE UNIQUE INDEX idx_layout_versions_active_user_page ON layout_versions (user, page_name) WHERE is_active = 1',
      ],
    })

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('layout_versions')
    app.delete(collection)
  },
)
