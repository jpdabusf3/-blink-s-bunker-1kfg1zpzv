import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import {
  type AgendaTask,
  type AgendaTaskInput,
  type AgendaTaskType,
  type DealOption,
  TASK_TYPE_LABELS,
} from '@/services/agenda-service'

interface AgendaTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: AgendaTask | null
  initialDate?: string
  deals: DealOption[]
  onSave: (taskData: AgendaTaskInput, taskId?: string) => Promise<void>
}

export function AgendaTaskModal({
  open,
  onOpenChange,
  task,
  initialDate,
  deals,
  onSave,
}: AgendaTaskModalProps) {
  const isEditing = Boolean(task)

  // Form states
  const [title, setTitle] = useState('')
  const [taskType, setTaskType] = useState<AgendaTaskType>('reuniao')
  const [clientName, setClientName] = useState('')
  const [dealId, setDealId] = useState<string>('none')
  const [taskDate, setTaskDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')

  // Search filter inside deal select
  const [dealSearch, setDealSearch] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Sync states on open or task change
  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      if (task) {
        setTitle(task.title || '')
        setTaskType(task.task_type || 'reuniao')
        setClientName(task.client_name || '')
        setDealId(task.deal_id || 'none')
        const rawDate = task.task_date ? task.task_date.split(' ')[0].split('T')[0] : ''
        setTaskDate(rawDate)
        setStartTime(task.start_time || '')
        setEndTime(task.end_time || '')
        setNotes(task.notes || '')
      } else {
        setTitle('')
        setTaskType('reuniao')
        setClientName('')
        setDealId('none')
        setTaskDate(initialDate || new Date().toISOString().split('T')[0])
        setStartTime('')
        setEndTime('')
        setNotes('')
      }
      setDealSearch('')
      setErrors({})
    }
    onOpenChange(nextOpen)
  }

  const validate = () => {
    const errs: Record<string, string> = {}

    if (!title.trim()) {
      errs.title = 'Informe o título da tarefa'
    } else if (title.trim().length > 100) {
      errs.title = 'O título não pode ultrapassar 100 caracteres'
    }

    if (!taskDate.trim()) {
      errs.taskDate = 'Informe a data'
    } else if (taskDate < '2020-01-01') {
      errs.taskDate = 'A data não pode ser anterior a 01/01/2020'
    }

    if (startTime && endTime) {
      if (endTime <= startTime) {
        errs.endTime = 'O horário de fim deve ser depois do horário de início'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      const payload: AgendaTaskInput = {
        title: title.trim(),
        task_type: taskType,
        client_name: clientName.trim() || undefined,
        deal_id: dealId && dealId !== 'none' ? dealId : undefined,
        task_date: taskDate,
        start_time: startTime.trim() || undefined,
        end_time: endTime.trim() || undefined,
        notes: notes.trim() || undefined,
        status: task?.status || 'agendada',
      }

      await onSave(payload, task?.id)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  // Filtered deals for search
  const filteredDeals = deals.filter((d) => {
    if (!dealSearch.trim()) return true
    return d.name.toLowerCase().includes(dealSearch.toLowerCase())
  })

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Atualize os dados da tarefa agendada na sua semana.'
                : 'Preencha as informações para agendar uma nova tarefa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.title
                      return next
                    })
                  }
                }}
                maxLength={100}
                placeholder="Ex: Reunião de alinhamento com cliente"
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title && (
                <p className="text-xs text-destructive font-medium">{errors.title}</p>
              )}
            </div>

            {/* Tipo de Tarefa */}
            <div className="space-y-1.5">
              <Label htmlFor="task-type">
                Tipo de Tarefa <span className="text-destructive">*</span>
              </Label>
              <Select value={taskType} onValueChange={(val) => setTaskType(val as AgendaTaskType)}>
                <SelectTrigger id="task-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_TYPE_LABELS) as AgendaTaskType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {TASK_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label htmlFor="task-date">
                Data <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-date"
                type="date"
                min="2020-01-01"
                value={taskDate}
                onChange={(e) => {
                  setTaskDate(e.target.value)
                  if (errors.taskDate) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.taskDate
                      return next
                    })
                  }
                }}
                aria-invalid={Boolean(errors.taskDate)}
              />
              {errors.taskDate && (
                <p className="text-xs text-destructive font-medium">{errors.taskDate}</p>
              )}
            </div>

            {/* Horários Início e Fim */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-time">Início (opcional)</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value)
                    if (errors.endTime) {
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next.endTime
                        return next
                      })
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="end-time">Fim (opcional)</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value)
                    if (errors.endTime) {
                      setErrors((prev) => {
                        const next = { ...prev }
                        delete next.endTime
                        return next
                      })
                    }
                  }}
                  aria-invalid={Boolean(errors.endTime)}
                />
              </div>
            </div>
            {errors.endTime && (
              <p className="text-xs text-destructive font-medium -mt-2">{errors.endTime}</p>
            )}

            {/* Nome do Cliente */}
            <div className="space-y-1.5">
              <Label htmlFor="client-name">Nome do Cliente (opcional)</Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Granja São José"
              />
            </div>

            {/* Oportunidade / Deal Vinculado */}
            <div className="space-y-1.5">
              <Label htmlFor="deal-id">Oportunidade / Deal Vinculado (opcional)</Label>
              <Select
                value={dealId}
                onValueChange={(val) => {
                  setDealId(val)
                  // If user selects a deal and clientName is empty, auto-populate clientName
                  if (val && val !== 'none' && !clientName) {
                    const matched = deals.find((d) => d.id === val)
                    if (matched) {
                      setClientName(matched.name)
                    }
                  }
                }}
              >
                <SelectTrigger id="deal-id">
                  <SelectValue placeholder="Selecione um cliente / fábrica" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <div className="p-2 sticky top-0 bg-popover z-10">
                    <Input
                      placeholder="Pesquisar cliente..."
                      value={dealSearch}
                      onChange={(e) => setDealSearch(e.target.value)}
                      className="h-8 text-xs"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem value="none">Nenhum deal vinculado</SelectItem>
                  {filteredDeals.slice(0, 80).map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.name}{' '}
                      {deal.city ? `(${deal.city}${deal.state ? ` - ${deal.state}` : ''})` : ''}
                    </SelectItem>
                  ))}
                  {filteredDeals.length === 0 && (
                    <p className="p-2 text-xs text-muted-foreground text-center">
                      Nenhum resultado encontrado
                    </p>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Notas / Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="task-notes">Observações (opcional)</Label>
              <Textarea
                id="task-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes, pauta ou informações adicionais..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Criar Tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
