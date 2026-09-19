/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('maestro_uploads')
      const fileField = col.fields.getByName('arquivo')
      if (fileField) {
        // Expandir mimeTypes para incluir imagens comuns (png, jpg, jpeg, webp, gif, heic, heif)
        const allowedMimes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/plain',
          'application/csv',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'image/gif',
          'image/heic',
          'image/heif',
        ]
        fileField.mimeTypes = allowedMimes
        app.save(col)
      }
    } catch (err) {
      $app
        .logger()
        .error('0117_allow_image_uploads_in_maestro_uploads failed', 'error', String(err))
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('maestro_uploads')
      const fileField = col.fields.getByName('arquivo')
      if (fileField) {
        fileField.mimeTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/plain',
          'application/csv',
        ]
        app.save(col)
      }
    } catch (_) {}
  },
)
