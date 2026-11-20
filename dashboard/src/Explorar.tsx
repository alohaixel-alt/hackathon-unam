import { useEffect, useId, useState } from 'react'
import { Asistente, BotonEscuchar, useAnimar, useEscala } from './Accesibilidad'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'

// Paleta: azul (UNAM / NFL) y naranja oscuro (Amazon). Los valores siempre se escriben en texto,
// el color nunca es la única forma de distinguir algo.
const AZUL = '#013369'
const NARANJA = '#B84A00'

interface FilaDown { down: number; jugadas: number; presion: number; yardas: number }
interface FilaCuarto { cuarto: number; jugadas: number; presion: number; yardas: number }
interface FilaClima { clima: string; partidos: number; jugadas: number; presion: number | null; margen: number | null; yardas: number | null }
interface FilaMatriz { clima: string; q1: number | null; q2: number | null; q3: number | null; q4: number | null }
interface Datos {
  archivos: { nombre: string; filas: number; que: string }[]
  temporada: number[]
  partidos: { total: number; conTemperatura: number; interior: number; sinTemperatura: number; tempMin: number; tempMax: number }
  presionGlobal: number
  porDown: FilaDown[]
  porCuarto: FilaCuarto[]
  clima3erCuarto: FilaClima[]
  climaPorCuarto: FilaMatriz[]
  temperaturas: { rango: string; partidos: number }[]
}

function Tarjeta({ titulo, subtitulo, significado, children }: { titulo: string; subtitulo: string; significado: string[]; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-700 mb-4">{subtitulo}</p>
        </div>
        <div className="text-[#013369]">
          <BotonEscuchar obtenerTexto={() => `${titulo}. ${significado.join(' ')}`} etiqueta="Escuchar explicación" />
        </div>
      </div>
      <div className="rounded-xl bg-orange-50 border-l-4 border-[#B84A00] px-4 py-3 mb-4">
        <h3 className="text-base font-bold text-slate-900 mb-1">Qué significa</h3>
        <ul className="list-disc pl-5 space-y-1 text-base text-slate-900">
          {significado.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
      {children}
    </section>
  )
}

const r1 = (x: number) => Math.round(x * 10) / 10

function Tabla({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm border-collapse">
        <caption className="text-left text-sm font-semibold text-slate-700 pb-2">{titulo}</caption>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col" className="text-left p-2 border-b-2 border-slate-300 text-slate-800">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="odd:bg-slate-50">
              {f.map((v, j) =>
                j === 0
                  ? <th key={j} scope="row" className="text-left p-2 font-semibold text-slate-900">{v}</th>
                  : <td key={j} className="p-2 text-slate-900">{v}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const pct = (v: number | null) => (v === null || v === undefined ? 'sin datos' : `${v.toFixed(1)}%`)

function Cabina() {
  const [nar, setNar] = useState<{ texto: string; ia: boolean } | null>(null)
  useEffect(() => {
    fetch('api/narracion')
      .then((r) => (r.ok ? r.json() : null))
      .then(setNar)
      .catch(() => setNar(null))
  }, [])
  return (
    <section aria-labelledby="titulo-cabina" className="bg-[#013369] text-white rounded-2xl p-6">
      <h2 id="titulo-cabina" className="text-base font-bold uppercase tracking-widest text-orange-200 mb-2">En cabina</h2>
      <p aria-live="polite" className="text-base leading-relaxed">{nar ? nar.texto : 'Preparando el resumen…'}</p>
      {nar && (
        <div className="mt-3 text-white"><BotonEscuchar obtenerTexto={() => nar.texto} etiqueta="Escuchar resumen" /></div>
      )}
      {nar && (
        <p className="text-sm text-blue-100 mt-3">
          {nar.ia ? 'Resumen escrito por IA (Amazon Nova) a partir de los números de esta página.' : 'Resumen automático a partir de los números de esta página.'}
        </p>
      )}
    </section>
  )
}

export default function Explorar() {
  const animar = useAnimar()
  const esc = useEscala()
  const tk = Math.round(14 * esc)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('api/explorar')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? `Error ${r.status}`)
        return r.json()
      })
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-300 rounded-2xl p-5 text-red-900">
        <p className="font-semibold">No se pudieron cargar los datos</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }
  if (!datos) {
    return <p role="status" className="text-slate-700 py-10 text-center">Cargando datos…</p>
  }

  const dn = Object.fromEntries(datos.porDown.map((d) => [d.down, d.presion]))
  const qn = Object.fromEntries(datos.porCuarto.map((d) => [d.cuarto, d.presion]))
  const c3 = datos.clima3erCuarto.filter(
    (c) => c.presion !== null && c.clima !== 'Temperatura no disponible'
  ) as (FilaClima & { presion: number; margen: number })[]
  const alto = c3.reduce((a, b) => (a.presion >= b.presion ? a : b))
  const bajo = c3.reduce((a, b) => (a.presion <= b.presion ? a : b))
  const dif = r1(alto.presion - bajo.presion)
  const mDif = r1(Math.sqrt(alto.margen ** 2 + bajo.margen ** 2))
  const fríos = datos.temperaturas.filter((t) => t.rango === '≤50').reduce((a, t) => a + t.partidos, 0)

  const sigDown = [
    'Cada barra muestra un down. Un down es un intento del ataque para avanzar.',
    `En estos datos hubo presión en ${dn[1]}% de los pases de 1er down y en ${dn[3]}% de los pases de 3er down.`,
    'Esta diferencia aparece en miles de jugadas. La gráfica muestra lo que ocurrió, pero no explica por qué ocurrió.',
  ]
  const sigCuarto = [
    'Cada barra muestra una parte del partido. Una barra más alta significa que hubo presión más veces.',
    `La presión fue ${qn[1]}% en el 1er cuarto, ${qn[2]}% en el 2do, ${qn[3]}% en el 3ro y ${qn[4]}% en el 4to.`,
    `Del 1er al 4to cuarto la diferencia fue de ${r1(qn[4] - qn[1])} puntos. Es pequeña. No sabemos si se debe al cansancio, al marcador o a las jugadas elegidas.`,
  ]
  const sigClima = [
    'Cada barra muestra un tipo de clima. Solo contamos jugadas del 3er cuarto.',
    `La presión fue mayor con ${alto.clima}: ${alto.presion}%. Fue menor con ${bajo.clima}: ${bajo.presion}%. La diferencia fue de ${dif} puntos.`,
    dif > mDif
      ? `La duda estimada es de más o menos ${mDif} puntos. La diferencia apenas la supera. Es una pista, no una conclusión.`
      : `La duda estimada es de más o menos ${mDif} puntos. Es mayor que la diferencia. El resultado puede deberse al azar.`,
    'Los partidos sin temperatura aparecen en un grupo separado. No los usamos para comparar el clima.',
  ]
  const sigTemp = [
    'Cada barra cuenta partidos al aire libre. La temperatura está en grados Fahrenheit.',
    `Solo ${fríos} partidos fueron a 50 °F o menos. Hubo ${datos.partidos.interior} partidos en interior. En ${datos.partidos.sinTemperatura} partidos no conocemos la temperatura.`,
    'Hay pocos partidos con frío fuerte. Por eso no podemos sacar una conclusión firme sobre el frío extremo.',
  ]

  return (
    <div className="flex flex-col gap-6">
      <PlanCoach />
      <Cabina />
      <Asistente />
      <p className="text-base text-slate-800 bg-white border-l-4 border-[#B84A00] rounded-r-xl px-4 py-3">
        <strong>Qué medimos:</strong> hay <strong>presión</strong> cuando un defensor obliga al quarterback a lanzar rápido,
        lo golpea o lo derriba antes del pase. Ocurrió en <strong>{datos.presionGlobal}%</strong> de las {datos.porDown.reduce((a, d) => a + d.jugadas, 0).toLocaleString()} jugadas de pase
        de la temporada {datos.temporada.join(', ')} (semanas 1 a 8, {datos.partidos.total} partidos).
      </p>

      <Tarjeta
        titulo="1 · La presión sube en el 3er down"
        significado={sigDown}
        subtitulo="Porcentaje de jugadas de pase con presión al quarterback, según el down"
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.porDown.map((d) => `Down ${d.down}: ${d.presion}% de presión`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos.porDown.map((d) => ({ ...d, nombre: `Down ${d.down}` }))} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis dataKey="nombre" tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis unit="%" domain={[0, 70]} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar isAnimationActive={animar} dataKey="presion" name="Presión" radius={[6, 6, 0, 0]}>
                {datos.porDown.map((d) => <Cell key={d.down} fill={d.down >= 3 ? NARANJA : AZUL} />)}
                <LabelList dataKey="presion" position="top" formatter={(v: unknown) => `${v}%`} style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Tabla
          titulo="Mismos datos en tabla"
          columnas={['Down', 'Jugadas', 'Con presión', 'Yardas promedio']}
          filas={datos.porDown.map((d) => [`Down ${d.down}`, d.jugadas.toLocaleString(), pct(d.presion), d.yardas.toFixed(2)])}
        />
      </Tarjeta>

      <Tarjeta
        titulo="2 · Presión durante el partido"
        significado={sigCuarto}
        subtitulo="Cuántas jugadas tuvieron presión en cada cuarto"
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.porCuarto.map((d) => `Cuarto ${d.cuarto}: ${d.presion}%`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos.porCuarto.map((d) => ({ ...d, nombre: `Cuarto ${d.cuarto}` }))} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis dataKey="nombre" tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis unit="%" domain={[30, 42]} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar isAnimationActive={animar} dataKey="presion" name="Presión" radius={[6, 6, 0, 0]}>
                {datos.porCuarto.map((d) => <Cell key={d.cuarto} fill={d.cuarto === 3 ? NARANJA : AZUL} />)}
                <LabelList dataKey="presion" position="top" formatter={(v: unknown) => `${v}%`} style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-slate-800">
          El eje empieza en 30% para que se vea la diferencia. Las diferencias entre cuartos son pequeñas (de 36% a 39%).
        </p>
        <Tabla
          titulo="Mismos datos en tabla"
          columnas={['Cuarto', 'Jugadas', 'Con presión', 'Yardas promedio']}
          filas={datos.porCuarto.map((d) => [`Cuarto ${d.cuarto}`, d.jugadas.toLocaleString(), pct(d.presion), d.yardas.toFixed(2)])}
        />
      </Tarjeta>

      <Tarjeta
        titulo="3 · El clima en el 3er cuarto"
        significado={sigClima}
        subtitulo="Porcentaje de jugadas con presión en el 3er cuarto, según la temperatura del partido"
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.clima3erCuarto.map((d) => `${d.clima}: ${pct(d.presion)}`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={Math.round(300 * esc)}>
            <BarChart layout="vertical" data={datos.clima3erCuarto} margin={{ top: 10, right: 60, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis type="number" unit="%" domain={[0, 50]} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis type="category" dataKey="clima" width={Math.round(150 * esc)} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar isAnimationActive={animar} dataKey="presion" name="Presión" radius={[0, 6, 6, 0]}>
                {datos.clima3erCuarto.map((d) => <Cell key={d.clima} fill={d.clima === alto.clima ? NARANJA : AZUL} />)}
                <LabelList dataKey="presion" position="right" formatter={(v: unknown) => `${v}%`} style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Tabla
          titulo="Mismos datos en tabla"
          columnas={['Clima', 'Partidos', 'Jugadas', 'Con presión', 'Duda estimada', 'Yardas promedio']}
          filas={datos.clima3erCuarto.map((d) => [d.clima, d.partidos, d.jugadas.toLocaleString(), pct(d.presion), d.margen === null ? '—' : `± ${d.margen} puntos`, d.yardas === null ? 'sin datos' : d.yardas.toFixed(2)])}
        />
        <Tabla
          titulo="Presión por clima y cuarto"
          columnas={['Clima', 'Cuarto 1', 'Cuarto 2', 'Cuarto 3', 'Cuarto 4']}
          filas={datos.climaPorCuarto.map((f) => [f.clima, pct(f.q1), pct(f.q2), pct(f.q3), pct(f.q4)])}
        />
      </Tarjeta>

      <Tarjeta
        titulo="4 · Qué temperaturas hay en los datos"
        significado={sigTemp}
        subtitulo={`Partidos al aire libre por temperatura. ${datos.partidos.interior} partidos fueron en interior. En ${datos.partidos.sinTemperatura} partidos no conocemos la temperatura.`}
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.temperaturas.map((t) => `${t.rango} °F: ${t.partidos} partidos`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={datos.temperaturas} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis dataKey="rango" tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar isAnimationActive={animar} dataKey="partidos" name="Partidos" fill={AZUL} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="partidos" position="top" style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>
      <TarjetaVelocidad />
      <TarjetaEfectividad />
      <footer className="text-sm text-slate-700 border-t border-slate-300 pt-4">
        <p>
          <strong>Fuentes:</strong> NFL Big Data Bowl (Next Gen Stats y Pro Football Focus), temporada 2021, semanas 1 a 8.
          Temperatura y tipo de estadio: nflverse. Los resultados muestran asociaciones, no causas.
        </p>
      </footer>
    </div>
  )
}


// ── Velocidad (datos de seguimiento) ─────────────────────────────────────────

interface FilaVel {
  grupo: string | number
  partidos: number
  jugadas: number
  qb: number
  rush: number
  margenQb: number | null
  margenRush: number | null
}
interface DatosVel { partidos: number; jugadas: number; muestra: string; porClima: FilaVel[]; porCuarto: FilaVel[]; presion: FilaVel[] }

function TarjetaVelocidad() {
  const animar = useAnimar()
  const [v, setV] = useState<DatosVel | null>(null)
  const [error, setError] = useState(false)
  const esc = useEscala()
  const tk = Math.round(14 * esc)

  useEffect(() => {
    fetch('api/velocidad').then((r) => (r.ok ? r.json() : Promise.reject())).then(setV).catch(() => setError(true))
  }, [])

  if (error) return null
  if (!v) return <p role="status" className="text-slate-700">Calculando velocidades…</p>

  const min = Math.min(...v.porClima.map((c) => c.rush))
  const max = Math.max(...v.porClima.map((c) => c.rush))
  const maxDuda = Math.max(...v.porClima.map((c) => c.margenRush ?? 0))
  const sigVel = [
    'Cada barra muestra la velocidad promedio de los defensores que corren hacia el quarterback.',
    `Los promedios van de ${min} a ${max} yardas por segundo. La duda estimada llega a más o menos ${maxDuda} yardas por segundo. Los rangos se enciman.`,
    `No encontramos una diferencia clara entre los climas. Esto no prueba que el clima nunca afecte la velocidad. Solo describe esta muestra de ${v.partidos} partidos.`,
    v.muestra,
  ]

  return (
    <Tarjeta
      titulo="5 · ¿El clima cambia la velocidad?"
      significado={sigVel}
      subtitulo={`Velocidad en yardas por segundo. Esta parte usa una muestra de ${v.partidos} partidos y ${v.jugadas.toLocaleString()} jugadas.`}
    >
      <div role="img" aria-label={`Gráfica de barras. Velocidad de los defensores que presionan: ${v.porClima.map((c) => `${c.grupo}: ${c.rush} yardas por segundo`).join('. ')}.`}>
        <ResponsiveContainer width="100%" height={Math.round(300 * esc)}>
          <BarChart layout="vertical" data={v.porClima} margin={{ top: 10, right: 60, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
            <XAxis type="number" domain={[0, 5]} tick={{ fontSize: tk, fill: '#0F172A' }} />
            <YAxis type="category" dataKey="grupo" width={Math.round(150 * esc)} tick={{ fontSize: tk, fill: '#0F172A' }} />
            <Bar isAnimationActive={animar} dataKey="rush" name="Defensores que presionan" fill={AZUL} radius={[0, 6, 6, 0]}>
              <LabelList dataKey="rush" position="right" style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Tabla
        titulo="Velocidad por clima"
        columnas={['Clima', 'Partidos', 'Jugadas', 'Defensores', 'Duda entre partidos', 'Quarterback']}
        filas={v.porClima.map((c) => [String(c.grupo), c.partidos, c.jugadas.toLocaleString(), `${c.rush} yds/s`, c.margenRush === null ? '—' : `± ${c.margenRush} yds/s`, `${c.qb} yds/s`])}
      />
      <Tabla
        titulo="Velocidad por cuarto"
        columnas={['Cuarto', 'Jugadas', 'Defensores que presionan', 'Quarterback']}
        filas={v.porCuarto.map((c) => [`Cuarto ${c.grupo}`, c.jugadas.toLocaleString(), `${c.rush} yds/s`, `${c.qb} yds/s`])}
      />
      <Tabla
        titulo="Con y sin presión"
        columnas={['Jugada', 'Jugadas', 'Defensores que presionan', 'Quarterback']}
        filas={v.presion.map((c) => [String(c.grupo), c.jugadas.toLocaleString(), `${c.rush} yds/s`, `${c.qb} yds/s`])}
      />
    </Tarjeta>
  )
}


// ── Qué funcionó en el 3er down ──────────────────────────────────────────────

interface FilaEf { grupo: string; partidos: number; jugadas: number; conversion: number | null; margen: number | null }
interface Escenario { escenario: string; general: FilaEf; presion: FilaEf[]; playAction: FilaEf[]; coberturas: FilaEf[] }

// Compara dos grupos y dice, en lenguaje sencillo, cuánto confiar en la diferencia.
function comparar(a: FilaEf, b: FilaEf) {
  if (a.conversion === null || b.conversion === null || a.margen === null || b.margen === null) {
    return { dif: null as number | null, m: null as number | null, texto: 'Faltan datos para comparar con seguridad.' }
  }
  const dif = r1(a.conversion - b.conversion)
  const m = r1(Math.sqrt(a.margen ** 2 + b.margen ** 2))
  const texto = Math.abs(dif) > m * 1.5
    ? 'La diferencia es mayor que la duda estimada en esta muestra.'
    : Math.abs(dif) > m
      ? `La diferencia apenas supera la duda estimada de ${m} puntos. Es una pista.`
      : `La duda estimada es de ${m} puntos. La diferencia puede ser azar.`
  return { dif, m, texto }
}

function TarjetaEfectividad() {
  const animar = useAnimar()
  const esc = useEscala()
  const tk = Math.round(14 * esc)
  const [esc_, setEsc] = useState<Escenario[] | null>(null)
  const [i, setI] = useState(0)

  useEffect(() => {
    fetch('api/efectividad').then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setEsc(j.escenarios)).catch(() => setEsc([]))
  }, [])

  if (!esc_) return <p role="status" className="text-slate-700">Calculando qué funcionó mejor…</p>
  if (!esc_.length) return null

  const e = esc_[i]
  const [sinP, conP] = e.presion
  const [sinPA, conPA] = e.playAction
  const cPA = comparar(conPA, sinPA)
  const mejor = e.coberturas[0]
  const peor = e.coberturas[e.coberturas.length - 1]
  const cCob = mejor && peor && mejor !== peor ? comparar(peor, mejor) : null

  const significado = [
    `Escenario: 3er down, ${e.escenario.toLowerCase()}. El ataque consiguió un nuevo primer down en ${e.general.conversion}% de ${e.general.jugadas.toLocaleString()} jugadas.`,
    `Sin presión, el ataque lo consiguió ${sinP.conversion}% de las veces. Con presión, ${conP.conversion}%. Es una comparación; no prueba que la presión sea la única causa.`,
    mejor && peor && cCob
      ? `La defensa permitió menos primeros downs con ${mejor.grupo}: ${mejor.conversion}%. Con ${peor.grupo} permitió ${peor.conversion}%. ${cCob.texto}`
      : 'No hay suficientes jugadas para comparar las coberturas.',
    conPA.jugadas >= 15
      ? `Con una carrera fingida antes del pase, el ataque consiguió el primer down ${conPA.conversion}% de las veces. Sin fingir la carrera, ${sinPA.conversion}%. ${cPA.texto}${i === 0 ? ' Esta jugada se usa más cuando faltan pocas yardas. Usa los botones para hacer una comparación más justa.' : ''}`
      : `Solo hubo ${conPA.jugadas} jugadas con una carrera fingida. Son muy pocas para comparar.`,
  ]

  return (
    <Tarjeta
      titulo="6 · ¿Qué funcionó mejor en el 3er down?"
      subtitulo="Porcentaje de veces que el ataque consiguió el primer down. Elige cuántas yardas le faltaban."
      significado={significado}
    >
      <div role="group" aria-label="Escenario: yardas por ganar" className="flex flex-wrap gap-2 mb-4">
        {esc_.map((x, k) => (
          <button
            key={x.escenario}
            onClick={() => setI(k)}
            aria-pressed={i === k}
            className={`px-4 py-2 rounded-lg font-semibold border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 ${
              i === k ? 'bg-[#013369] text-white border-[#013369]' : 'bg-white text-slate-900 border-slate-400 hover:border-[#013369]'
            }`}
          >
            {x.escenario}
          </button>
        ))}
      </div>

      <h3 className="text-base font-bold text-slate-900">Conversiones permitidas por cada cobertura defensiva (menos es mejor para la defensa)</h3>
      <div role="img" aria-label={`Gráfica de barras. ${e.coberturas.map((c) => `${c.grupo}: ${c.conversion}% de conversiones`).join('. ')}.`}>
        <ResponsiveContainer width="100%" height={Math.round((80 + e.coberturas.length * 44) * esc)}>
          <BarChart layout="vertical" data={e.coberturas} margin={{ top: 10, right: 60, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
            <XAxis type="number" unit="%" domain={[0, 80]} tick={{ fontSize: tk, fill: '#0F172A' }} />
            <YAxis type="category" dataKey="grupo" width={Math.round(110 * esc)} tick={{ fontSize: tk, fill: '#0F172A' }} />
            <Bar isAnimationActive={animar} dataKey="conversion" name="Conversiones" radius={[0, 6, 6, 0]}>
              {e.coberturas.map((c) => <Cell key={c.grupo} fill={c === mejor ? NARANJA : AZUL} />)}
              <LabelList dataKey="conversion" position="right" formatter={(v: unknown) => `${v}%`} style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-slate-800">La barra naranja es la cobertura que mejor defendió. Solo aparecen coberturas con 40 jugadas o más, sin las de zona roja ni las de fin de partido.</p>

      <Tabla
        titulo="Ataque: presión y play action"
        columnas={['Situación', 'Partidos', 'Jugadas', 'El ataque consiguió el primer down', 'Duda estimada']}
        filas={[...e.presion, ...e.playAction].map((f) => [
          f.grupo, f.partidos, f.jugadas.toLocaleString(), pct(f.conversion),
          f.margen === null ? 'faltan datos' : `± ${f.margen} puntos`,
        ])}
      />
      <Tabla
        titulo="Defensa: coberturas"
        columnas={['Cobertura', 'Partidos', 'Jugadas', 'Primeros downs permitidos', 'Duda estimada']}
        filas={e.coberturas.map((f) => [f.grupo, f.partidos, f.jugadas.toLocaleString(), pct(f.conversion), f.margen === null ? '—' : `± ${f.margen} puntos`])}
      />
    </Tarjeta>
  )
}


// ── Plan de juego para el coach ──────────────────────────────────────────────

interface FilaPlan { grupo: string; partidos: number; jugadas: number; exito: number | null; margen: number | null }
interface Plan {
  jugadas: number; exito: number | null; presion: FilaPlan[]
  ataque: { formacion: FilaPlan[]; playAction: FilaPlan[]; salida: FilaPlan[] }
  defensa: { cobertura: FilaPlan[]; tipo: FilaPlan[] }
}
type Nivel = 'clara' | 'pista' | 'azar' | 'pocas'

// Compara las dos opciones con mejor resultado. La duda se calcula entre partidos.
function mejorOpcion(filas: FilaPlan[], mayorEsMejor: boolean) {
  const validas = filas
    .filter((f) => f.exito !== null)
    .sort((a, b) => mayorEsMejor ? (b.exito as number) - (a.exito as number) : (a.exito as number) - (b.exito as number))
  if (validas.length < 2) {
    return { nivel: 'pocas' as Nivel, mejor: validas[0], segunda: undefined as FilaPlan | undefined, m: null as number | null }
  }
  const [mejor, segunda] = validas
  if (mejor.margen === null || segunda.margen === null) {
    return { nivel: 'pocas' as Nivel, mejor, segunda, m: null as number | null }
  }
  const dif = Math.abs((mejor.exito as number) - (segunda.exito as number))
  const m = r1(Math.sqrt(mejor.margen ** 2 + segunda.margen ** 2))
  const nivel: Nivel = dif > m * 1.5 ? 'clara' : dif > m ? 'pista' : 'azar'
  return { nivel, mejor, segunda, m }
}

const ETIQUETA_NIVEL: Record<Nivel, { texto: string; clase: string }> = {
  clara: { texto: '✔ Diferencia clara en esta muestra', clase: 'bg-[#013369] text-white' },
  pista: { texto: '◐ Puede ser una pista', clase: 'bg-orange-100 text-slate-900 border border-[#B84A00]' },
  azar: { texto: '○ No hay una diferencia clara', clase: 'bg-slate-100 text-slate-900 border border-slate-400' },
  pocas: { texto: '— Faltan datos', clase: 'bg-slate-100 text-slate-900 border border-slate-400' },
}

function frase(cat: string, r: ReturnType<typeof mejorOpcion>, defensa: boolean) {
  const resultado = defensa ? 'primeros downs permitidos' : 'jugadas exitosas'
  if (r.nivel === 'pocas' || !r.mejor || !r.segunda) return `${cat}: faltan datos para comparar.`
  const base = `${cat}: ${r.mejor.grupo} tuvo ${r.mejor.exito}% de ${resultado}. La siguiente opción fue ${r.segunda.grupo}, con ${r.segunda.exito}%.`
  if (r.nivel === 'clara') return `${base} La diferencia es mayor que la duda estimada en esta muestra.`
  if (r.nivel === 'pista') return `${base} La diferencia apenas supera la duda estimada. Puede ser una pista.`
  return `${base} La diferencia puede ser azar. No hay una opción claramente mejor.`
}

function Selector<T extends string>({ etiqueta, opciones, valor, onCambio }: { etiqueta: string; opciones: [T, string][]; valor: T; onCambio: (v: T) => void }) {
  const id = useId()
  return (
    <div>
      <p className="text-sm font-bold text-slate-900 mb-1" id={id}>{etiqueta}</p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {opciones.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onCambio(v)}
            aria-pressed={valor === v}
            className={`px-3 py-2 rounded-lg font-semibold border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 ${
              valor === v ? 'bg-[#013369] text-white border-[#013369]' : 'bg-white text-slate-900 border-slate-400 hover:border-[#013369]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlanCoach() {
  const [down, setDown] = useState<'todos' | '1' | '2' | '3' | '4'>('3')
  const [dist, setDist] = useState<'todas' | 'corta' | 'media' | 'larga'>('todas')
  const [cuarto, setCuarto] = useState<'todos' | '1' | '2' | '3' | '4'>('todos')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
    fetch(`api/plan?down=${down}&distancia=${dist}&cuarto=${cuarto}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPlan)
      .catch(() => setError(true))
  }, [down, dist, cuarto])

  const escenario = `${down === 'todos' ? 'cualquier down' : `${down}º down`}, ${dist === 'todas' ? 'cualquier distancia' : `distancia ${dist}`}, ${cuarto === 'todos' ? 'todo el partido' : `${cuarto}º cuarto`}`

  let significado: string[] = ['Elige un escenario para ver qué funcionó mejor.']
  let ataque: { cat: string; r: ReturnType<typeof mejorOpcion> }[] = []
  let defensa: { cat: string; r: ReturnType<typeof mejorOpcion> }[] = []
  if (plan && plan.jugadas > 0) {
    ataque = [
      { cat: 'Formación', r: mejorOpcion(plan.ataque.formacion, true) },
      { cat: 'Carrera fingida antes del pase', r: mejorOpcion(plan.ataque.playAction, true) },
      { cat: 'Dónde lanza el quarterback', r: mejorOpcion(plan.ataque.salida, true) },
    ]
    defensa = [
      { cat: 'Cobertura', r: mejorOpcion(plan.defensa.cobertura, false) },
      { cat: 'Hombre a hombre o zona', r: mejorOpcion(plan.defensa.tipo, false) },
    ]
    const [sp, cp] = plan.presion
    significado = [
      `Elegiste: ${escenario}. Encontramos ${plan.jugadas.toLocaleString()} jugadas de pase. El ataque tuvo éxito en ${plan.exito}%.`,
      `En las jugadas sin presión, el ataque tuvo éxito ${sp.exito}% de las veces. En las jugadas con presión, ${cp.exito}%. Esto describe lo ocurrido; no prueba que la presión fuera la única causa.`,
      `Para el ataque. ${ataque.map((a) => frase(a.cat, a.r, false)).join(' ')}`,
      `Para la defensa. ${defensa.map((a) => frase(a.cat, a.r, true)).join(' ')}`,
    ]
    if (plan.jugadas < 150) significado.push('Este escenario tiene pocas jugadas: toma estos resultados con cautela.')
  }

  const Bloque = ({ titulo, items, def }: { titulo: string; items: typeof ataque; def: boolean }) => (
    <div className="rounded-xl border-2 border-slate-300 p-4">
      <h3 className="text-lg font-bold text-slate-900 mb-3">{titulo}</h3>
      <ul className="space-y-3">
        {items.map(({ cat, r }) => (
          <li key={cat}>
            <p className="text-sm font-semibold text-slate-700">{cat}</p>
            <p className="text-base font-bold text-slate-900">
              {r.mejor ? r.mejor.grupo : 'Sin datos suficientes'}
              {r.mejor && <span className="font-normal"> · {r.mejor.exito}% {def ? 'de éxito del ataque' : 'de éxito'}</span>}
            </p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-sm font-semibold ${ETIQUETA_NIVEL[r.nivel].clase}`}>{ETIQUETA_NIVEL[r.nivel].texto}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <Tarjeta
      titulo="Plan de juego para el coach"
      subtitulo="Elige la situación y mira qué funcionó mejor en ataque y en defensa durante la temporada 2021 (semanas 1 a 8)."
      significado={significado}
    >
      <div className="flex flex-col gap-4 mb-5">
        <Selector etiqueta="Down" valor={down} onCambio={setDown} opciones={[['todos', 'Todos'], ['1', '1º'], ['2', '2º'], ['3', '3º'], ['4', '4º']]} />
        <Selector etiqueta="Yardas por ganar" valor={dist} onCambio={setDist} opciones={[['todas', 'Todas'], ['corta', 'Corta (1–3)'], ['media', 'Media (4–6)'], ['larga', 'Larga (7 o más)']]} />
        <Selector etiqueta="Cuarto" valor={cuarto} onCambio={setCuarto} opciones={[['todos', 'Todo el partido'], ['1', '1º'], ['2', '2º'], ['3', '3º'], ['4', '4º']]} />
      </div>

      {error && <p role="alert" className="text-red-900">No se pudo calcular el plan. Intenta de nuevo.</p>}
      {plan && plan.jugadas === 0 && <p role="status" className="text-slate-900">No hay jugadas en esta combinación.</p>}
      {plan && plan.jugadas > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-live="polite">
            <Bloque titulo="🏈 Si atacas" items={ataque} def={false} />
            <Bloque titulo="🛡️ Si defiendes" items={defensa} def={true} />
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 mt-4 text-sm text-slate-900">
            <p><strong>Cómo leer el resultado:</strong> “Diferencia clara” significa que la separación fue mayor que la duda estimada entre partidos. “Puede ser una pista” pide más datos. “No hay una diferencia clara” significa que no conviene elegir una opción solo por este porcentaje.</p>
            <p className="mt-2"><strong>Importante:</strong> esta herramienta compara lo que ocurrió en 2021. No garantiza qué pasará en el siguiente partido.</p>
          </div>
          <p className="text-sm text-slate-800 mt-3">
            <strong>Jugada exitosa:</strong> en 1er down, el ataque gana al menos 40% de las yardas que necesita; en 2do, 60%; en 3ro y 4to, consigue un nuevo primer down.
            Solo mostramos opciones con suficientes jugadas para evitar resultados engañosos.
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold text-[#013369] focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 rounded">Ver todas las opciones en tablas</summary>
            {[
              ['Ataque: formación', plan.ataque.formacion, 'Jugadas exitosas'],
              ['Ataque: carrera fingida', plan.ataque.playAction, 'Jugadas exitosas'],
              ['Ataque: lugar del lanzamiento', plan.ataque.salida, 'Jugadas exitosas'],
              ['Defensa: cobertura (menos es mejor)', plan.defensa.cobertura, 'Primeros downs permitidos'],
              ['Defensa: hombre a hombre o zona (menos es mejor)', plan.defensa.tipo, 'Primeros downs permitidos'],
              ['Presión', plan.presion, 'Jugadas exitosas del ataque'],
            ].map(([t, f, c]) => (
              <Tabla
                key={t as string}
                titulo={t as string}
                columnas={['Opción', 'Partidos', 'Jugadas', c as string, 'Duda estimada']}
                filas={(f as FilaPlan[]).map((x) => [x.grupo, x.partidos, x.jugadas.toLocaleString(), pct(x.exito), x.margen === null ? '—' : `± ${x.margen} puntos`])}
              />
            ))}
          </details>
        </>
      )}
    </Tarjeta>
  )
}
