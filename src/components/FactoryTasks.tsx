import { useState } from 'react'
import { useAppContext } from '@/store/AppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TaskType, TaskPriority } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Trash2, Calendar as CalendarIcon, AlertCircle } from 'lucide-react'
import {
  isPassedDeadline,
  generateGoogleCalendarLink,
  generateOutlookCalendarLink,
} from '@/lib/utils'

export function FactoryTasks({ factoryId }: { factoryId: string }) {
  const { tasks, factories, addTask, updateTask, deleteTask } = useAppContext()
  const [isAdding, setIsAdding] = useState(false)

  const factory = factories.find((f) => f.id === factoryId)
  const factoryName = factory?.name || 'Não informada'

  const factoryTasks = tasks
    .filter((t) => t.factoryId === factoryId)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    addTask({
      factoryId,
      description: fd.get('description') as string,
      type: fd.get('type') as TaskType,
      priority: fd.get('priority') as TaskPriority,
      dueDate: (fd.get('dueDate') as string) || undefined,
      completed: false,
    })
    setIsAdding(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-2 border-b">
        <h3 className="text-sm font-medium">To-Do List do Cliente</h3>
        <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancelar' : 'Nova Tarefa'}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-muted/30 p-4 rounded-lg border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Descrição da Tarefa</Label>
              <Input name="description" placeholder="Ex: Enviar proposta comercial..." required />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select name="type" defaultValue="Enviar amostra" required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enviar amostra">Enviar amostra</SelectItem>
                  <SelectItem value="Ligar para Follow-up">Ligar para Follow-up</SelectItem>
                  <SelectItem value="Outra">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select name="priority" defaultValue="Média" required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Data Limite (Opcional)</Label>
              <Input type="date" name="dueDate" />
            </div>
          </div>
          <Button type="submit" size="sm" className="w-full sm:w-auto">
            Salvar Tarefa
          </Button>
        </form>
      )}

      {factoryTasks.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma tarefa cadastrada para esta fábrica.
        </p>
      )}

      <div className="space-y-2">
        {factoryTasks.map((task) => {
          const isOverdue = !task.completed && isPassedDeadline(task.dueDate)
          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${task.completed ? 'bg-muted/50 opacity-70' : 'bg-card hover:bg-muted/30'}`}
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={(checked) => updateTask(task.id, { completed: !!checked })}
                className="mt-1 w-5 h-5 md:w-4 md:h-4"
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                >
                  {task.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Badge variant="outline" className="text-[10px] h-5">
                    {task.type}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] h-5 ${task.priority === 'Alta' && !task.completed ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : ''}`}
                  >
                    {task.priority}
                  </Badge>
                  {task.dueDate && (
                    <span
                      className={`text-[11px] flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                    >
                      {isOverdue ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <CalendarIcon className="w-3 h-3" />
                      )}
                      {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {task.dueDate && !task.completed && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <CalendarIcon className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-48 p-2 flex flex-col gap-1">
                      <a
                        href={generateGoogleCalendarLink(
                          `Blink: ${task.description}`,
                          `Fábrica: ${factoryName}\nTipo: ${task.type}`,
                          task.dueDate,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm p-2.5 hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                      >
                        Google Calendar
                      </a>
                      <a
                        href={generateOutlookCalendarLink(
                          `Blink: ${task.description}`,
                          `Fábrica: ${factoryName}\nTipo: ${task.type}`,
                          task.dueDate,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm p-2.5 hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                      >
                        Outlook / Apple
                      </a>
                    </PopoverContent>
                  </Popover>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTask(task.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
