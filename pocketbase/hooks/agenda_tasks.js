/// <reference path="../pb_data/types.d.ts" />

/**
 * Validações de regra de negócio para a collection agenda_tasks:
 * 1. end_time deve ser posterior a start_time quando ambos forem informados.
 * 2. task_date não pode ser anterior a 2020-01-01.
 * 3. task_type restrito a: reuniao, visita, evento, ligacao, outro.
 * 4. status restrito a: agendada, concluida, cancelada.
 *
 * PocketBase JSVM executa callbacks em pool isolado: lógica mantida inline dentro de cada callback.
 */

onRecordCreateRequest((e) => {
  var ALLOWED_TASK_TYPES = ['reuniao', 'visita', 'evento', 'ligacao', 'outro']
  var ALLOWED_STATUS = ['agendada', 'concluida', 'cancelada']
  var MIN_TASK_DATE = '2020-01-01'

  var record = e.record
  var taskType = record.getString ? record.getString('task_type') : record.task_type
  if (!taskType || ALLOWED_TASK_TYPES.indexOf(taskType) === -1) {
    throw new BadRequestError('Validação falhou: task_type inválido', {
      task_type: new ValidationError(
        'validation_invalid_value',
        'task_type deve ser um dos seguintes: reuniao, visita, evento, ligacao, outro',
      ),
    })
  }

  var status = record.getString ? record.getString('status') : record.status
  if (!status || ALLOWED_STATUS.indexOf(status) === -1) {
    throw new BadRequestError('Validação falhou: status inválido', {
      status: new ValidationError(
        'validation_invalid_value',
        'status deve ser um dos seguintes: agendada, concluida, cancelada',
      ),
    })
  }

  var taskDate = record.getString ? record.getString('task_date') : record.task_date
  if (!taskDate) {
    throw new BadRequestError('Validação falhou: task_date obrigatório', {
      task_date: new ValidationError('validation_required', 'task_date é obrigatório'),
    })
  }

  var taskDateNorm = String(taskDate).trim().substring(0, 10)
  if (taskDateNorm < MIN_TASK_DATE) {
    throw new BadRequestError('Validação falhou: task_date não pode ser anterior a 2020-01-01', {
      task_date: new ValidationError(
        'validation_min_date',
        'task_date não pode ser anterior a 2020-01-01',
      ),
    })
  }

  var startTime = (
    (record.getString ? record.getString('start_time') : record.start_time) || ''
  ).trim()
  var endTime = ((record.getString ? record.getString('end_time') : record.end_time) || '').trim()

  if (startTime && endTime) {
    if (endTime <= startTime) {
      throw new BadRequestError('Validação falhou: end_time deve ser posterior a start_time', {
        end_time: new ValidationError(
          'validation_time_order',
          'end_time deve ser posterior a start_time quando ambos forem informados',
        ),
      })
    }
  }

  e.next()
}, 'agenda_tasks')

onRecordUpdateRequest((e) => {
  var ALLOWED_TASK_TYPES = ['reuniao', 'visita', 'evento', 'ligacao', 'outro']
  var ALLOWED_STATUS = ['agendada', 'concluida', 'cancelada']
  var MIN_TASK_DATE = '2020-01-01'

  var record = e.record
  var taskType = record.getString ? record.getString('task_type') : record.task_type
  if (!taskType || ALLOWED_TASK_TYPES.indexOf(taskType) === -1) {
    throw new BadRequestError('Validação falhou: task_type inválido', {
      task_type: new ValidationError(
        'validation_invalid_value',
        'task_type deve ser um dos seguintes: reuniao, visita, evento, ligacao, outro',
      ),
    })
  }

  var status = record.getString ? record.getString('status') : record.status
  if (!status || ALLOWED_STATUS.indexOf(status) === -1) {
    throw new BadRequestError('Validação falhou: status inválido', {
      status: new ValidationError(
        'validation_invalid_value',
        'status deve ser um dos seguintes: agendada, concluida, cancelada',
      ),
    })
  }

  var taskDate = record.getString ? record.getString('task_date') : record.task_date
  if (!taskDate) {
    throw new BadRequestError('Validação falhou: task_date obrigatório', {
      task_date: new ValidationError('validation_required', 'task_date é obrigatório'),
    })
  }

  var taskDateNorm = String(taskDate).trim().substring(0, 10)
  if (taskDateNorm < MIN_TASK_DATE) {
    throw new BadRequestError('Validação falhou: task_date não pode ser anterior a 2020-01-01', {
      task_date: new ValidationError(
        'validation_min_date',
        'task_date não pode ser anterior a 2020-01-01',
      ),
    })
  }

  var startTime = (
    (record.getString ? record.getString('start_time') : record.start_time) || ''
  ).trim()
  var endTime = ((record.getString ? record.getString('end_time') : record.end_time) || '').trim()

  if (startTime && endTime) {
    if (endTime <= startTime) {
      throw new BadRequestError('Validação falhou: end_time deve ser posterior a start_time', {
        end_time: new ValidationError(
          'validation_time_order',
          'end_time deve ser posterior a start_time quando ambos forem informados',
        ),
      })
    }
  }

  e.next()
}, 'agenda_tasks')
