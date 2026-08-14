migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('users')

    if (!col.fields.getByName('whatsapp')) {
      col.fields.add(
        new TextField({
          name: 'whatsapp',
        }),
      )
    }

    if (!col.fields.getByName('whatsapp_validated')) {
      col.fields.add(
        new BoolField({
          name: 'whatsapp_validated',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('users')

    var whatsappField = col.fields.getByName('whatsapp')
    if (whatsappField) {
      col.fields.remove(whatsappField)
    }

    var validatedField = col.fields.getByName('whatsapp_validated')
    if (validatedField) {
      col.fields.remove(validatedField)
    }

    app.save(col)
  },
)
