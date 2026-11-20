import { useState, useCallback } from 'react'
import Explorar from './Explorar'
import { ControlesTamano, ProveedorAccesibilidad } from './Accesibilidad'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, ZAxis, Legend
} from 'recharts'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Resumen {
  totalJugadas: number
  downs: Record<string, number>
  equipos: string[]
}

interface EfectividadCobertura {
  cobertura: string
  yardasPromedio: number
  jugadas: number
  exito: number  // % de jugadas donde defensiva tuvo éxito (≤ yardas necesarias)
}

interface CalorCeldas {
  cobertura: string
  down: number
  yardasPromedio: number
  jugadas: number
}

interface Recomendacion {
  situacion: string
  coberturaRecomendada: string
  razon: string
  yardasPromedio: number
}

interface ComparativaEquipo {
  equipo: string
  yardasPromedio: number
  exito: number
  jugadas: number
  mejorCobertura: string
}

interface AnalisisPorDown {
  down: number
  label: string
  yardasPromedio: number
  jugadas: number
}

interface DatosAPI {
  resumen: Resumen
  efectividadCobertura: EfectividadCobertura[]
  mapaCalor: CalorCeldas[]
  recomendaciones: Recomendacion[]
  porDown: AnalisisPorDown[]
}

interface DatosComparativa {
  equipoA: ComparativaEquipo
  equipoB: ComparativaEquipo
  porCobertura: { cobertura: string; equipoA: number; equipoB: number }[]
}

// ── Colores ──────────────────────────────────────────────────────────────────

const COLORES_COBERTURA: Record<string, string> = {
  'Cover 0': '#7C3AED',
  'Cover 1': '#2563EB',
  'Cover 2': '#0891B2',
  'Cover 3': '#059669',
  'Cover 4': '#D97706',
  'Cover 6': '#DC2626',
  'Quarters': '#BE185D',
  'Tampa 2': '#7C3AED',
  'Man': '#1D4ED8',
  'Zone': '#0F766E',
}

function colorCobertura(nombre: string): string {
  for (const [k, v] of Object.entries(COLORES_COBERTURA)) {
    if (nombre.includes(k)) return v
  }
  return '#6B7280'
}

// ── Helpers visuales ─────────────────────────────────────────────────────────

function Badge({ texto, color }: { texto: string; color: string }) {
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {texto}
    </span>
  )
}

function Stat({ etiqueta, valor, sub }: { etiqueta: string; valor: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-1 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{etiqueta}</span>
      <span className="text-3xl font-bold text-gray-900">{valor}</span>
      {sub && <span className="text-sm text-gray-500">{sub}</span>}
    </div>
  )
}

function intensidadCalor(valor: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (valor - min) / (max - min)
  // verde oscuro (bueno = pocas yardas) → rojo (malo = muchas yardas)
  const r = Math.round(34 + t * (220 - 34))
  const g = Math.round(197 - t * (197 - 38))
  const b = Math.round(94 - t * (94 - 38))
  return `rgb(${r},${g},${b})`
}

// ── Tooltip personalizado ────────────────────────────────────────────────────

function TooltipBarra({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Zona de carga de archivo ─────────────────────────────────────────────────

function ZonaCarga({ onArchivo }: { onArchivo: (f: File) => void }) {
  const [arrastrando, setArrastrando] = useState(false)

  const manejar = (f: File | null) => {
    if (f && f.name.endsWith('.csv')) onArchivo(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    manejar(e.dataTransfer.files[0] ?? null)
  }, [])

  return (
    <label
      className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors ${
        arrastrando ? 'border-violet-500 bg-violet-50' : 'border-gray-300 bg-gray-50 hover:border-violet-400 hover:bg-violet-50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={onDrop}
    >
      <span className="text-4xl">🗂️</span>
      <span className="font-semibold text-gray-700">Haz clic o arrastra tu archivo CSV aquí</span>
      <span className="text-sm text-gray-400">Formato esperado: plays.csv con columnas del dataset NFL</span>
      <input type="file" accept=".csv" className="hidden" onChange={(e) => manejar(e.target.files?.[0] ?? null)} />
    </label>
  )
}

// ── Pestañas ─────────────────────────────────────────────────────────────────

type Pestaña = 'decision' | 'comparar' | 'historia'

const PESTAÑAS: { id: Pestaña; emoji: string; label: string }[] = [
  { id: 'decision', emoji: '1', label: 'La decisión' },
  { id: 'comparar', emoji: '2', label: 'Comparar equipos' },
  { id: 'historia', emoji: '3', label: 'Historia del dato' },
]

// ── Filtros ───────────────────────────────────────────────────────────────────

type FiltroDown = 'todos' | '1' | '2' | '3' | '4'
type FiltroYardas = 'todas' | 'corta' | 'media' | 'larga' | 'muy_larga'

// ── App principal ────────────────────────────────────────────────────────────

function Coberturas() {
  const [pestaña, setPestaña] = useState<Pestaña>('decision')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<DatosAPI | null>(null)
  const [filtroDown, setFiltroDown] = useState<FiltroDown>('todos')
  const [filtroYardas, setFiltroYardas] = useState<FiltroYardas>('todas')
  const [filtroEquipo, setFiltroEquipo] = useState<string>('todos')
  const [equipoA, setEquipoA] = useState('')
  const [equipoB, setEquipoB] = useState('')
  const [comparativa, setComparativa] = useState<DatosComparativa | null>(null)
  const [cargandoComp, setCargandoComp] = useState(false)

  const subirArchivo = async (archivo: File) => {
    setCargando(true)
    setError(null)
    setDatos(null)
    setComparativa(null)
    const form = new FormData()
    form.append('archivo', archivo)
    try {
      const res = await fetch('api/analisis', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`)
      setDatos(await res.json())
    } catch (e: any) {
      setError(e.message ?? 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }

  const compararEquipos = async () => {
    if (!equipoA || !equipoB || equipoA === equipoB) return
    setCargandoComp(true)
    setComparativa(null)
    try {
      const res = await fetch(`api/comparar?equipoA=${encodeURIComponent(equipoA)}&equipoB=${encodeURIComponent(equipoB)}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setComparativa(await res.json())
    } catch {
      // silencioso, el usuario puede reintentar
    } finally {
      setCargandoComp(false)
    }
  }

  // Filtra coberturas según filtros activos
  const efectividadFiltrada: EfectividadCobertura[] = datos
    ? datos.efectividadCobertura.filter((d) => {
        // los filtros afectan al mapaCalor; aquí mostramos el agregado general
        // pero si hay filtro de down se hace via endpoint; por ahora mostramos todo
        return true
      })
    : []

  const equipos = datos?.resumen.equipos ?? []

  return (
    <div className="font-sans text-gray-900">

      <div className="flex flex-col gap-8">
        {/* Zona de carga */}
        {!datos && !cargando && (
          <ZonaCarga onArchivo={subirArchivo} />
        )}

        {cargando && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 font-medium">Analizando el dataset…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
            <p className="font-semibold">Algo salió mal</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {datos && (
          <>
            {/* Filtros */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap gap-6 items-end">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Down</span>
                <div className="flex gap-2 flex-wrap">
                  {(['todos', '1', '2', '3', '4'] as FiltroDown[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFiltroDown(v)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        filtroDown === v
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-violet-400'
                      }`}
                    >
                      {v === 'todos' ? 'Todos' : `${v}er Down`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Yardas por ganar</span>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      ['todas', 'Todas'],
                      ['corta', 'Corta (1–3)'],
                      ['media', 'Media (4–6)'],
                      ['larga', 'Larga (7–10)'],
                      ['muy_larga', 'Muy larga (10+)'],
                    ] as [FiltroYardas, string][]
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setFiltroYardas(v)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        filtroYardas === v
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-violet-400'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Equipo defensivo</span>
                <select
                  value={filtroEquipo}
                  onChange={(e) => setFiltroEquipo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="todos">Todos</option>
                  {equipos.map((eq) => (
                    <option key={eq} value={eq}>{eq}</option>
                  ))}
                </select>
              </div>

              <span className="ml-auto text-sm text-gray-400 font-medium">
                💜 {datos.resumen.totalJugadas.toLocaleString()} jugadas
              </span>
            </section>

            {/* Pestañas */}
            <div className="flex gap-2">
              {PESTAÑAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPestaña(p.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    pestaña === p.id
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-400'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    {p.emoji}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>

            {/* ── Pestaña 1: La decisión ── */}
            {pestaña === 'decision' && (
              <div className="flex flex-col gap-6">
                {/* Efectividad por cobertura */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-1">Efectividad por cobertura</h2>
                  <p className="text-sm text-gray-500 mb-5">Yardas promedio permitidas por tipo de cobertura — menos es mejor</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={datos.efectividadCobertura} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="cobertura" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 12 }} unit=" yds" />
                      <Tooltip content={<TooltipBarra />} />
                      <Bar dataKey="yardasPromedio" name="Yardas prom." radius={[6, 6, 0, 0]}>
                        {datos.efectividadCobertura.map((d) => (
                          <Cell key={d.cobertura} fill={colorCobertura(d.cobertura)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Recomendación + Mapa de calor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recomendación */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
                    <h2 className="text-lg font-bold">Decisión recomendada</h2>
                    <p className="text-sm text-gray-500">Coach, esto es lo que dicen los datos</p>
                    {datos.recomendaciones.map((r, i) => (
                      <div key={i} className="rounded-xl bg-violet-50 border border-violet-100 p-4 flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">{r.situacion}</span>
                        <span className="text-lg font-bold text-violet-700">{r.coberturaRecomendada}</span>
                        <span className="text-sm text-gray-600">{r.razon}</span>
                        <span className="text-xs text-gray-400">{r.yardasPromedio.toFixed(1)} yds promedio permitidas</span>
                      </div>
                    ))}
                  </div>

                  {/* Mapa de calor */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-bold mb-1">Mapa de calor</h2>
                    <p className="text-sm text-gray-500 mb-4">Yardas promedio permitidas: Cobertura × Down</p>
                    <MapaCalor datos={datos.mapaCalor} />
                  </div>
                </div>

                {/* Cabina */}
                <CabinaComentarista datos={datos} tipo="decision" />
              </div>
            )}

            {/* ── Pestaña 2: Comparar equipos ── */}
            {pestaña === 'comparar' && (
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-1">Selecciona dos equipos</h2>
                  <p className="text-sm text-gray-500 mb-5">Comparativa defensiva</p>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Equipo A</label>
                      <select
                        value={equipoA}
                        onChange={(e) => setEquipoA(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        <option value="">— elige —</option>
                        {equipos.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                      </select>
                    </div>
                    <span className="text-gray-400 font-bold pb-2">VS</span>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Equipo B</label>
                      <select
                        value={equipoB}
                        onChange={(e) => setEquipoB(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        <option value="">— elige —</option>
                        {equipos.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={compararEquipos}
                      disabled={!equipoA || !equipoB || equipoA === equipoB || cargandoComp}
                      className="px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors"
                    >
                      {cargandoComp ? 'Comparando…' : 'Comparar'}
                    </button>
                  </div>
                </div>

                {comparativa && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <TarjetaEquipo datos={comparativa.equipoA} color="#7C3AED" />
                      <TarjetaEquipo datos={comparativa.equipoB} color="#2563EB" />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <h2 className="text-lg font-bold mb-1">Por cobertura</h2>
                      <p className="text-sm text-gray-500 mb-5">Yardas promedio permitidas por tipo de cobertura</p>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={comparativa.porCobertura} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis dataKey="cobertura" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 12 }} unit=" yds" />
                          <Tooltip content={<TooltipBarra />} />
                          <Legend />
                          <Bar dataKey="equipoA" name={comparativa.equipoA.equipo} fill="#7C3AED" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="equipoB" name={comparativa.equipoB.equipo} fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Pestaña 3: Historia del dato ── */}
            {pestaña === 'historia' && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat etiqueta="Total jugadas" valor={datos.resumen.totalJugadas.toLocaleString()} />
                  {datos.porDown.map((d) => (
                    <Stat key={d.down} etiqueta={d.label} valor={d.jugadas.toLocaleString()} sub={`${d.yardasPromedio.toFixed(1)} yds prom.`} />
                  ))}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-1">Distribución por down</h2>
                  <p className="text-sm text-gray-500 mb-5">Cantidad de jugadas registradas por down</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={datos.porDown} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<TooltipBarra />} />
                      <Bar dataKey="jugadas" name="Jugadas" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <CabinaComentarista datos={datos} tipo="historia" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Mapa de calor ────────────────────────────────────────────────────────────

function MapaCalor({ datos }: { datos: CalorCeldas[] }) {
  if (!datos.length) return <p className="text-gray-400 text-sm">Sin datos</p>

  const coberturas = [...new Set(datos.map((d) => d.cobertura))]
  const downs = [1, 2, 3, 4]
  const valores = datos.map((d) => d.yardasPromedio)
  const min = Math.min(...valores)
  const max = Math.max(...valores)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left text-gray-400 font-semibold">Cobertura</th>
            {downs.map((d) => (
              <th key={d} className="p-2 text-center text-gray-500 font-semibold">{d}er</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coberturas.map((cob) => (
            <tr key={cob}>
              <td className="p-2 font-semibold text-gray-700 whitespace-nowrap">{cob}</td>
              {downs.map((down) => {
                const celda = datos.find((d) => d.cobertura === cob && d.down === down)
                if (!celda) return <td key={down} className="p-2 text-center text-gray-200">—</td>
                return (
                  <td
                    key={down}
                    className="p-2 text-center rounded font-bold text-white"
                    style={{ backgroundColor: intensidadCalor(celda.yardasPromedio, min, max) }}
                    title={`${celda.jugadas} jugadas`}
                  >
                    {celda.yardasPromedio.toFixed(1)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-3">
        🟢 Verde = menos yardas permitidas (mejor defensiva) · 🔴 Rojo = más yardas (peor defensiva)
      </p>
    </div>
  )
}

// ── Tarjeta de equipo ────────────────────────────────────────────────────────

function TarjetaEquipo({ datos, color }: { datos: ComparativaEquipo; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-lg font-bold">{datos.equipo}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Yardas prom.</p>
          <p className="text-2xl font-bold" style={{ color }}>{datos.yardasPromedio.toFixed(1)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Éxito def.</p>
          <p className="text-2xl font-bold" style={{ color }}>{datos.exito.toFixed(0)}%</p>
        </div>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Mejor cobertura</p>
        <p className="text-base font-bold text-gray-800">{datos.mejorCobertura}</p>
      </div>
      <p className="text-xs text-gray-400">{datos.jugadas.toLocaleString()} jugadas analizadas</p>
    </div>
  )
}

// ── Cabina comentarista ──────────────────────────────────────────────────────

function CabinaComentarista({ datos, tipo }: { datos: DatosAPI; tipo: 'decision' | 'historia' }) {
  const mejor = datos.efectividadCobertura.reduce((a, b) => a.yardasPromedio < b.yardasPromedio ? a : b, datos.efectividadCobertura[0])
  const peor = datos.efectividadCobertura.reduce((a, b) => a.yardasPromedio > b.yardasPromedio ? a : b, datos.efectividadCobertura[0])

  const texto = tipo === 'decision'
    ? `🎙️ La cobertura más efectiva en este dataset es ${mejor?.cobertura} con ${mejor?.yardasPromedio.toFixed(1)} yardas promedio permitidas. ` +
      `La menos efectiva es ${peor?.cobertura} con ${peor?.yardasPromedio.toFixed(1)} yardas. ` +
      `En situaciones de 3er down, la diferencia entre una buena y una mala cobertura puede definir el partido.`
    : `🎙️ El dataset contiene ${datos.resumen.totalJugadas.toLocaleString()} jugadas en total. ` +
      `El 3er down concentra ${datos.porDown.find(d => d.down === 3)?.jugadas.toLocaleString() ?? '?'} jugadas, ` +
      `el momento de mayor presión donde la decisión defensiva importa más.`

  return (
    <div className="bg-gray-900 text-white rounded-2xl p-6 flex gap-4">
      <span className="text-3xl flex-shrink-0">🎙️</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">En cabina</p>
        <p className="text-sm leading-relaxed text-gray-200">{texto}</p>
      </div>
    </div>
  )
}


// ── Estructura general ───────────────────────────────────────────────────────

type Vista = 'explorar' | 'coberturas'

// Cambia a true para volver a mostrar el análisis de coberturas (subir CSV).
const MOSTRAR_COBERTURAS = false

export default function App() {
  const [vista, setVista] = useState<Vista>('explorar')
  const botones: { id: Vista; label: string }[] = [
    { id: 'explorar', label: 'Explorar datos' },
    ...(MOSTRAR_COBERTURAS ? [{ id: 'coberturas' as Vista, label: 'Análisis de coberturas (subir CSV)' }] : []),
  ]

  return (
    <ProveedorAccesibilidad>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:p-2 focus:bg-white focus:text-slate-900">
        Saltar al contenido
      </a>
      <header className="bg-[#013369] text-white px-6 py-4 border-b-4 border-[#B84A00]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Presión y clima en jugadas de pase de la NFL</h1>
            <p className="text-sm text-blue-100">Explora qué ocurrió según el down, la distancia, el cuarto y el clima.</p>
          </div>
          <ControlesTamano />
        </div>
      </header>
      <nav aria-label="Secciones" className={`bg-white border-b-4 border-[#B84A00] ${botones.length < 2 ? 'hidden' : ''}`}>
        <ul className="max-w-6xl mx-auto px-4 py-2 flex gap-2 flex-wrap">
          {botones.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => setVista(b.id)}
                aria-current={vista === b.id ? 'page' : undefined}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 ${
                  vista === b.id ? 'bg-[#013369] text-white border-[#013369]' : 'bg-white text-slate-900 border-slate-300 hover:border-[#013369]'
                }`}
              >
                {b.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main id="contenido" className="max-w-6xl mx-auto px-4 py-8">
        {vista === 'explorar' || !MOSTRAR_COBERTURAS ? <Explorar /> : <Coberturas />}
      </main>
    </div>
    </ProveedorAccesibilidad>
  )
}
