import { Check, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/hooks/use-i18n'
import { LANGUAGES } from '@/lib/i18n'

export function LanguageSelector() {
  const { lang, setLang } = useI18n()
  const current = LANGUAGES.find((l) => l.code === lang)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 h-10 rounded-full"
          title="Language"
        >
          <Globe className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium hidden sm:inline">{current?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className="gap-2 cursor-pointer"
          >
            <span className="text-base">{l.flag}</span>
            <span>{l.label}</span>
            {l.code === lang && <Check className="w-4 h-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
