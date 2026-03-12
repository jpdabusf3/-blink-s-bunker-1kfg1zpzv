import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { useAppContext } from '@/store/AppContext'
import { Factory } from '@/types'

const regionCoords: Record<string, [number, number]> = {
  Norte: [50, 85],
  'Médio-Norte': [50, 65],
  Leste: [80, 45],
  Oeste: [20, 45],
  Sul: [50, 20],
}

export function MapCard() {
  const { factories } = useAppContext()

  const data = factories.map((f) => {
    const [baseX, baseY] = regionCoords[f.region] || [50, 50]
    const jitterX = (f.name.charCodeAt(0) % 10) - 5
    const jitterY = (f.name.charCodeAt(1) % 10) - 5
    return { ...f, x: baseX + jitterX, y: baseY + jitterY }
  })

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Mapa Geográfico (MT)</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ChartContainer config={{}} className="h-full w-full">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis type="number" dataKey="x" domain={[0, 100]} hide />
            <YAxis type="number" dataKey="y" domain={[0, 100]} hide />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload || !payload.length) return null
                const f = payload[0].payload as Factory
                return (
                  <div className="bg-background border rounded-lg p-3 text-xs shadow-xl flex flex-col gap-1 z-50">
                    <span className="font-bold text-foreground">{f.name}</span>
                    <span className="text-muted-foreground">
                      {f.region} • {f.city}
                    </span>
                  </div>
                )
              }}
            />
            <Scatter name="Fábricas" data={data}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill="hsl(var(--primary))" />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
