migrate(
  (app) => {
    // Apagar produtos legados que não pertencem à nova especificação de 40 produtos (prefixos BBMO, BBMY, BPMI, BPMY, BBMI)
    var legacyCodes = [
      'ADS001', 'ADS002', 'BLE001', 'BLE002', 'ING001', 'ING002',
      'MIN001', 'MIN002', 'MIN003', 'MIN004', 'MIN005',
      'PRE001', 'PRE002', 'PRE003'
    ]

    for (var i = 0; i < legacyCodes.length; i++) {
      try {
        var rec = app.findFirstRecordByData('produtos', 'codigo', legacyCodes[i])
        if (rec) {
          app.delete(rec)
        }
      } catch (_) {}
    }
  },
  (app) => {}
)
