import { useState } from 'react'
import { Factory, Document } from '@/types'
import { useAppContext } from '@/store/AppContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Trash2, Download, UploadCloud } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'

export function FactoryDocuments({ factory }: { factory: Factory }) {
  const { updateFactory } = useAppContext()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    // Mock an upload delay with progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          const newDoc: Document = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            url: '#',
            size: file.size,
            uploadedAt: new Date().toISOString(),
          }
          updateFactory(factory.id, {
            documents: [...(factory.documents || []), newDoc],
          })
          setUploading(false)
          toast({
            title: 'Upload concluído',
            description: `O arquivo ${file.name} foi adicionado aos registros da fábrica.`,
          })
          return 100
        }
        return prev + 25
      })
    }, 400)
  }

  const handleDelete = (docId: string) => {
    updateFactory(factory.id, {
      documents: (factory.documents || []).filter((d) => d.id !== docId),
    })
    toast({
      title: 'Documento removido',
      description: 'O arquivo foi excluído com sucesso.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border border-dashed rounded-lg bg-muted/20 flex flex-col items-center justify-center text-center space-y-3">
        <UploadCloud className="w-8 h-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Anexar novo documento</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDFs, planilhas (.xlsx, .csv) de trials e contratos.
          </p>
        </div>
        <div className="relative">
          <Input
            type="file"
            accept=".pdf,.xlsx,.csv"
            onChange={handleUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Button variant="secondary" size="sm" disabled={uploading}>
            Selecionar Arquivo
          </Button>
        </div>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span>Enviando arquivo...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium border-b pb-2">Arquivos Salvos</h3>
        {(!factory.documents || factory.documents.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum documento encontrado.
          </p>
        )}
        {factory.documents?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-primary/10 p-2 rounded-md">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" title={doc.name}>
                  {doc.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(doc.size / 1024).toFixed(1)} KB •{' '}
                  {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-4">
              <Button
                variant="ghost"
                size="icon"
                title="Baixar"
                onClick={() => window.open(doc.url)}
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Excluir"
                onClick={() => handleDelete(doc.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
