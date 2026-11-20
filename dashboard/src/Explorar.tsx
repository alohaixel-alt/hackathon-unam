import { useEffect, useState } from 'react'
import { Asistente, BotonEscuchar, useAnimar, useEscala } from './Accesibilidad'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'

// Paleta: azul (UNAM / NFL) y naranja oscuro (Amazon). Los valores siempre se escriben en texto,
// el color nunca es la única forma de distinguir algo.
const AZUL = '#013369'
const NARANJA = '#B84A00'

interface FilaDown { down: number; jugadas: number; presion: number; yardas: number }
interface FilaCuarto { cuarto: number; jugadas: number; presion: number; yardas: number }
interface FilaClima { clima: string; jugadas: number; presion: number | null; yardas: number | null }
interface FilaMatriz { clima: string; q1: number | null; q2: number | null; q3: number | null; q4: number | null }
interface Datos {
  archivos: { nombre: string; filas: number; que: string }[]
  temporada: number[]
  partidos: { total: number; conTemperatura: number; domo: number; tempMin: number; tempMax: number }
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

// Margen de error al 95% para un porcentaje (en puntos porcentuales).
const margen = (pctV: number, n: number) => 1.96 * Math.sqrt((pctV / 100) * (1 - pctV / 100) / n) * 100
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

  const tempMasAlta = datos.clima3erCuarto
    .filter((c) => c.presion !== null)
    .reduce((a, b) => ((a.presion ?? 0) >= (b.presion ?? 0) ? a : b))

  const dn = Object.fromEntries(datos.porDown.map((d) => [d.down, d.presion]))
  const qn = Object.fromEntries(datos.porCuarto.map((d) => [d.cuarto, d.presion]))
  const c3 = datos.clima3erCuarto.filter((c) => c.presion !== null) as (FilaClima & { presion: number })[]
  const alto = c3.reduce((a, b) => (a.presion >= b.presion ? a : b))
  const bajo = c3.reduce((a, b) => (a.presion <= b.presion ? a : b))
  const dif = r1(alto.presion - bajo.presion)
  const mDif = r1(Math.sqrt(margen(alto.presion, alto.jugadas) ** 2 + margen(bajo.presion, bajo.jugadas) ** 2))
  const fríos = datos.temperaturas.filter((t) => t.rango === '≤50').reduce((a, t) => a + t.partidos, 0)

  const sigDown = [
    'Cada barra es un down. Mientras más alta, más veces presionaron al quarterback.',
    `La presión sube de ${dn[1]}% en el 1er down a ${dn[3]}% en el 3er down, y llega a ${dn[4]}% en el 4to.`,
    'Es la diferencia más clara de la app y sale de miles de jugadas, así que es confiable. Las barras naranjas marcan el 3er y el 4to down.',
  ]
  const sigCuarto = [
    'Cada barra es un cuarto del partido. Mientras más alta, más presión hubo en ese cuarto.',
    `La presión sube poco a poco: ${qn[1]}% en el 1er cuarto, ${qn[2]}% en el 2do, ${qn[3]}% en el 3ro y ${qn[4]}% en el 4to.`,
    `Del 1er al 4to cuarto la diferencia es de ${r1(qn[4] - qn[1])} puntos: es pequeña y gradual. Habla de un desgaste que se acumula, no de un salto en un solo cuarto.`,
  ]
  const sigClima = [
    'Cada barra es un tipo de clima, contando solo las jugadas del 3er cuarto. Mientras más larga, más presión.',
    `La barra más larga es ${alto.clima} con ${alto.presion}%, y la más corta es ${bajo.clima} con ${bajo.presion}%. La diferencia es de ${dif} puntos.`,
    dif > mDif
      ? `El margen de error de esa diferencia es de más o menos ${mDif} puntos. La diferencia apenas lo supera, así que es una pista que vale la pena seguir, no una prueba.`
      : `El margen de error de esa diferencia es de más o menos ${mDif} puntos, mayor que la diferencia. Podría ser solo azar.`,
  ]
  const sigTemp = [
    'Cada barra cuenta cuántos partidos al aire libre se jugaron en ese rango de temperatura, en grados Fahrenheit.',
    `La mayoría se jugó entre 61 y 80 °F. Solo ${fríos} partidos fueron a 50 °F o menos, y ${datos.partidos.domo} fueron en domo o con techo cerrado.`,
    'Por eso este análisis casi no puede decir nada del frío extremo: hay muy pocos partidos así.',
  ]

  return (
    <div className="flex flex-col gap-6">
      <Cabina />
      <Asistente />
      <p className="text-base text-slate-800 bg-white border-l-4 border-[#B84A00] rounded-r-xl px-4 py-3">
        <strong>Qué medimos:</strong> hay <strong>presión</strong> cuando algún defensor golpea (hit), apura (hurry) o derriba (sack)
        al quarterback. Pasó en <strong>{datos.presionGlobal}%</strong> de las {datos.porDown.reduce((a, d) => a + d.jugadas, 0).toLocaleString()} jugadas de pase
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
        titulo="2 · El desgaste a lo largo del partido"
        significado={sigCuarto}
        subtitulo="Porcentaje de jugadas con presión en cada cuarto"
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
                {datos.clima3erCuarto.map((d) => <Cell key={d.clima} fill={d.clima === tempMasAlta.clima ? NARANJA : AZUL} />)}
                <LabelList dataKey="presion" position="right" formatter={(v: unknown) => `${v}%`} style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Tabla
          titulo="Mismos datos en tabla"
          columnas={['Clima', 'Jugadas', 'Con presión', 'Margen de error', 'Yardas promedio']}
          filas={datos.clima3erCuarto.map((d) => [d.clima, d.jugadas.toLocaleString(), pct(d.presion), d.presion === null ? '—' : `± ${r1(margen(d.presion, d.jugadas))} puntos`, d.yardas === null ? 'sin datos' : d.yardas.toFixed(2)])}
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
        subtitulo={`Partidos al aire libre por rango de temperatura (°F). ${datos.partidos.domo} partidos fueron en domo o techo cerrado y no tienen temperatura.`}
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

interface FilaVel { grupo: string | number; partidos: number; jugadas: number; qb: number; rush: number }
interface DatosVel { partidos: number; jugadas: number; porClima: FilaVel[]; porCuarto: FilaVel[]; presion: FilaVel[] }

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
  const qMin = Math.min(...v.porCuarto.map((c) => c.rush))
  const qMax = Math.max(...v.porCuarto.map((c) => c.rush))
  const sin = v.presion.find((p) => p.grupo === 'Sin presión')
  const con = v.presion.find((p) => p.grupo === 'Con presión')
  const sigVel = [
    'Cada barra es la velocidad máxima promedio de los defensores que van por el quarterback, en yardas por segundo. Mientras más larga, más rápido.',
    `Todas las barras miden casi lo mismo: de ${min} a ${max} yardas por segundo. Entre el 1er y el 4to cuarto tampoco cambia (de ${qMin} a ${qMax}).`,
    `Cuando hay presión, los defensores sí corren más (${con?.rush} contra ${sin?.rush} yardas por segundo), pero eso pasa en cualquier clima. En estos datos, lo que cambia la presión es la situación del juego, no la temperatura.`,
  ]

  return (
    <Tarjeta
      titulo="5 · ¿El clima cambia la velocidad?"
      significado={sigVel}
      subtitulo={`Velocidad máxima después del snap, en yardas por segundo. Muestra de ${v.partidos} partidos y ${v.jugadas.toLocaleString()} jugadas.`}
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
        columnas={['Clima', 'Partidos', 'Jugadas', 'Defensores que presionan', 'Quarterback']}
        filas={v.porClima.map((c) => [String(c.grupo), c.partidos, c.jugadas.toLocaleString(), `${c.rush} yds/s`, `${c.qb} yds/s`])}
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

interface FilaEf { grupo: string; jugadas: number; conversion: number | null }
interface Escenario { escenario: string; general: FilaEf; presion: FilaEf[]; playAction: FilaEf[]; coberturas: FilaEf[] }

// Compara dos grupos y dice, en lenguaje sencillo, cuánto confiar en la diferencia.
function comparar(a: FilaEf, b: FilaEf) {
  if (a.conversion === null || b.conversion === null || a.jugadas < 15 || b.jugadas < 15) {
    return { dif: null as number | null, m: null as number | null, texto: 'Hay muy pocas jugadas para comparar.' }
  }
  const dif = r1(a.conversion - b.conversion)
  const m = r1(Math.sqrt(margen(a.conversion, a.jugadas) ** 2 + margen(b.conversion, b.jugadas) ** 2))
  const texto = Math.abs(dif) > m * 1.5
    ? 'Es una diferencia clara: supera de sobra el margen de error.'
    : Math.abs(dif) > m
      ? `Supera apenas el margen de error (más o menos ${m} puntos), así que es una pista.`
      : `Cabe dentro del margen de error (más o menos ${m} puntos): podría ser azar.`
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
  const cP = comparar(sinP, conP)
  const cPA = comparar(conPA, sinPA)
  const mejor = e.coberturas[0]
  const peor = e.coberturas[e.coberturas.length - 1]
  const cCob = mejor && peor && mejor !== peor ? comparar(peor, mejor) : null

  const significado = [
    `Escenario: 3er down, ${e.escenario.toLowerCase()}. "Convertir" quiere decir que el ataque ganó las yardas que le faltaban para el primer down. En este escenario lo logró en ${e.general.conversion}% de ${e.general.jugadas.toLocaleString()} jugadas.`,
    `Presión: sin presión el ataque convirtió ${sinP.conversion}% de las veces; con presión, solo ${conP.conversion}%. ${cP.texto}`,
    mejor && peor && cCob
      ? `Defensa: la cobertura que menos conversiones permitió fue ${mejor.grupo} (${mejor.conversion}%), y la que más, ${peor.grupo} (${peor.conversion}%). ${cCob.texto}`
      : 'Defensa: no hay suficientes jugadas por cobertura para comparar en este escenario.',
    conPA.jugadas >= 15
      ? `Play action (fingir una carrera antes de lanzar): con play action convirtió ${conPA.conversion}% y sin él ${sinPA.conversion}%. ${cPA.texto}${i === 0 ? ' Ojo: el play action se usa sobre todo cuando faltan pocas yardas, y eso infla su resultado. Compara por distancia con los botones.' : ''}`
      : `Play action: solo hubo ${conPA.jugadas} jugadas con play action en este escenario, muy pocas para comparar.`,
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
        columnas={['Situación', 'Jugadas', 'El ataque convirtió', 'Margen de error']}
        filas={[...e.presion, ...e.playAction].map((f) => [
          f.grupo, f.jugadas.toLocaleString(), pct(f.conversion),
          f.conversion === null || f.jugadas < 15 ? 'muy pocas jugadas' : `± ${r1(margen(f.conversion, f.jugadas))} puntos`,
        ])}
      />
      <Tabla
        titulo="Defensa: coberturas"
        columnas={['Cobertura', 'Jugadas', 'Conversiones permitidas', 'Margen de error']}
        filas={e.coberturas.map((f) => [f.grupo, f.jugadas.toLocaleString(), pct(f.conversion), f.conversion === null ? '—' : `± ${r1(margen(f.conversion, f.jugadas))} puntos`])}
      />
    </Tarjeta>
  )
}
