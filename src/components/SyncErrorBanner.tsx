import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SyncErrorBannerProps {
  message?: string
  onRetry: () => void | Promise<void>
  className?: string
}

/**
 * Banner de erro padronizado para o requisito do estado ERROR:
 * Mensagem em português 'Falha ao atualizar os dados.' com botão de nova tentativa,
 * mantendo os últimos dados válidos na tela.
 */
export function SyncErrorBanner({
  message = 'Falha ao atualizar os dados.',
  onRetry,
  className = '',
}: SyncErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs animate-in fade-in duration-200 ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void onRetry()}
        className="h-7 px-2.5 text-xs border-destructive/40 hover:bg-destructive/15 text-destructive gap-1.5 shrink-0"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Tentar novamente</span>
      </Button>
    </div>
  )
}
