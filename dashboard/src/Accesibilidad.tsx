import { createContext, useContext, useEffect, useState } from 'react'

// ── Tamaño de letra ──────────────────────────────────────────────────────────
// Todo el texto usa rem, así que cambiar el tamaño de la raíz agranda toda la página.
// Las gráficas usan píxeles, por eso exponemos la escala para multiplicarlos.

const TAMANOS = [
  { id: 'normal', etiqueta: 'A', px: 18, nombre: 'Letra normal' },
  { id: 'grande', etiqueta: 'A+', px: 22, nombre: 'Letra grande' },
  { id: 'muy-grande', etiqueta: 'A++', px: 26, nombre: 'Letra muy grande' },
]

interface Ctx { escala: number; id: string; setId: (id: string) => void }
const EscalaContext = createContext<Ctx>({ escala: 1, id: 'normal', setId: () => {} })
export const useEscala = () => useContext(EscalaContext).escala

export function ProveedorAccesibilidad({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string>(() => localStorage.getItem('tamano') ?? 'normal')
  const actual = TAMANOS.find((t) => t.id === id) ?? TAMANOS[0]

  useEffect(() => {
    document.documentElement.style.fontSize = `${actual.px}px`
    localStorage.setItem('tamano', actual.id)
  }, [actual])

  return <EscalaContext.Provider value={{ escala: actual.px / 16, id: actual.id, setId }}>{children}</EscalaContext.Provider>
}

export function ControlesTamano() {
  const { id, setId } = useContext(EscalaContext)
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Tamaño de la letra">
      {TAMANOS.map((t) => (
        <button
          key={t.id}
          onClick={() => setId(t.id)}
          aria-label={t.nombre}
          aria-pressed={id === t.id}
          className={`min-w-[3rem] px-3 py-2 rounded-lg font-bold border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 ${
            id === t.id ? 'bg-white text-[#013369] border-white' : 'bg-transparent text-white border-blue-200 hover:border-white'
          }`}
        >
          {t.etiqueta}
        </button>
      ))}
    </div>
  )
}

// ── Escuchar en voz alta ─────────────────────────────────────────────────────

export function BotonEscuchar({ obtenerTexto, etiqueta = 'Escuchar' }: { obtenerTexto: () => string; etiqueta?: string }) {
  const [hablando, setHablando] = useState(false)
  const disponible = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { if (disponible) window.speechSynthesis.cancel() }, [disponible])

  if (!disponible) return null

  const alternar = () => {
    if (hablando) {
      window.speechSynthesis.cancel()
      setHablando(false)
      return
    }
    const texto = obtenerTexto()
      .replace(/\s+/g, ' ')
      .replace(/1er/g, 'primer')
      .replace(/2do/g, 'segundo')
      .replace(/3er/g, 'tercer')
      .replace(/4to/g, 'cuarto')
      .replace(/%/g, ' por ciento')
      .replace(/°F/g, ' grados Fahrenheit')
      .replace(/yds\/s/g, ' yardas por segundo')
      .trim()
    if (!texto) return
    window.speechSynthesis.cancel()
    const voz = new SpeechSynthesisUtterance(texto)
    voz.lang = 'es-MX'
    voz.rate = 0.95
    const es = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('es'))
    if (es) voz.voice = es
    voz.onend = () => setHablando(false)
    voz.onerror = () => setHablando(false)
    setHablando(true)
    window.speechSynthesis.speak(voz)
  }

  return (
    <button
      onClick={alternar}
      aria-pressed={hablando}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 border-current focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
    >
      <span aria-hidden="true">{hablando ? '⏹' : '🔊'}</span>
      {hablando ? 'Detener' : etiqueta}
    </button>
  )
}

// ── Asistente con IA ─────────────────────────────────────────────────────────

const SUGERENCIAS = [
  '¿Qué ocurrió en el 3er down?',
  '¿Qué se observó durante el partido?',
  '¿Qué sabemos y qué no sabemos del clima?',
]

export function Asistente() {
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState<{ texto: string; ia: boolean } | null>(null)
  const [cargando, setCargando] = useState(false)

  const enviar = async (texto: string) => {
    const q = texto.trim()
    if (q.length < 3 || cargando) return
    setCargando(true)
    setRespuesta(null)
    const control = new AbortController()
    const limite = window.setTimeout(() => control.abort(), 25000)
    try {
      const r = await fetch('api/preguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: q }),
        signal: control.signal,
      })
      if (!r.ok) {
        const problema = await r.json().catch(() => ({}))
        throw new Error(problema.detail ?? 'No se pudo obtener una respuesta.')
      }
      const j = await r.json()
      setRespuesta({ texto: j.respuesta, ia: j.ia })
    } catch (e) {
      const texto = e instanceof Error && e.name === 'AbortError'
        ? 'La respuesta tardó demasiado. Puedes intentarlo otra vez.'
        : e instanceof Error ? e.message : 'No se pudo contactar al asistente.'
      setRespuesta({ texto, ia: false })
    } finally {
      window.clearTimeout(limite)
      setCargando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-asistente" className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6">
      <h2 id="titulo-asistente" className="text-lg font-bold text-slate-900">Pregúntale al asistente</h2>
      <p className="text-sm text-slate-700 mb-4">Escribe una pregunta. La IA responderá solo con los datos de esta página. Puede equivocarse: revisa también las explicaciones y las tablas.</p>

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(pregunta) }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <label htmlFor="pregunta" className="sr-only">Escribe tu pregunta</label>
        <input
          id="pregunta"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          maxLength={300}
          placeholder="Escribe tu pregunta aquí"
          className="flex-1 border-2 border-slate-400 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 focus:border-[#013369]"
        />
        <button
          type="submit"
          disabled={cargando || pregunta.trim().length < 3}
          className="px-5 py-3 rounded-lg bg-[#013369] text-white font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
        >
          {cargando ? 'Pensando…' : 'Preguntar'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Preguntas sugeridas">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            onClick={() => { setPregunta(s); enviar(s) }}
            className="px-3 py-2 rounded-lg text-sm border-2 border-slate-300 text-slate-900 hover:border-[#013369] focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
          >
            {s}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-4">
        {respuesta && (
          <div className="rounded-xl bg-slate-100 border border-slate-300 p-4 text-slate-900">
            <p id="texto-respuesta" className="leading-relaxed">{respuesta.texto}</p>
            <div className="flex items-center gap-4 mt-3 text-[#013369]">
              <BotonEscuchar obtenerTexto={() => respuesta.texto} etiqueta="Escuchar respuesta" />
              <span className="text-xs text-slate-700">
                {respuesta.ia ? 'Respuesta escrita por IA (Amazon Nova).' : 'Respuesta automática.'}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Movimiento reducido ──────────────────────────────────────────────────────
// Respeta la preferencia del sistema "Reducir movimiento".
export function useAnimar() {
  const consulta = '(prefers-reduced-motion: reduce)'
  const [reducir, setReducir] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches)
  useEffect(() => {
    const m = window.matchMedia(consulta)
    const cambio = () => setReducir(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])
  return !reducir
}
