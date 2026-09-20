import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { type AgendaTask } from '@/services/agenda-service'

interface DeleteTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: AgendaTask | null
  onConfirm: () => Promise<void>
}

export function DeleteTaskDialog({ open, onOpenChange, task, onConfirm }: DeleteTaskDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle>
          <AlertDialogDescription>
            {task ? (
              <>
                Tem certeza que deseja excluir &ldquo;<strong>{task.title}</strong>&rdquo;? Esta
                ação não pode ser desfeita.
              </>
            ) : (
              'Esta ação não pode ser desfeita.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
