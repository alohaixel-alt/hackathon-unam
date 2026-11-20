import { useEffect, useRef, useState } from 'react'
import { Asistente, BotonEscuchar, useEscala } from './Accesibilidad'
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

function Tarjeta({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  return (
    <section ref={ref} className="bg-white rounded-2xl border border-slate-300 shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-700 mb-4">{subtitulo}</p>
        </div>
        <div className="text-[#013369]">
          <BotonEscuchar obtenerTexto={() => ref.current?.innerText.replace(/Escuchar|Detener/g, '') ?? ''} etiqueta="Escuchar esta sección" />
        </div>
      </div>
      {children}
    </section>
  )
}

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

  return (
    <div className="flex flex-col gap-6">
      <Cabina />
      <Asistente />
      <Tarjeta
        titulo="Qué datos tenemos"
        subtitulo={`Temporada ${datos.temporada.join(', ')} · ${datos.partidos.total} partidos · semanas 1 a 8`}
      >
        <Tabla
          titulo="Archivos cargados"
          columnas={['Archivo', 'Filas', 'Qué contiene']}
          filas={datos.archivos.map((a) => [a.nombre, a.filas.toLocaleString(), a.que])}
        />
        <p className="text-sm text-slate-800 mt-4">
          Presión = jugada en la que algún defensor logró un hit, un hurry o un sack sobre el quarterback.
          En total hubo presión en <strong>{datos.presionGlobal}%</strong> de las jugadas de pase.
        </p>
      </Tarjeta>

      <Tarjeta
        titulo="1 · La presión sube en el 3er down"
        subtitulo="Porcentaje de jugadas de pase con presión al quarterback, según el down"
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.porDown.map((d) => `Down ${d.down}: ${d.presion}% de presión`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos.porDown.map((d) => ({ ...d, nombre: `Down ${d.down}` }))} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis dataKey="nombre" tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis unit="%" domain={[0, 70]} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar dataKey="presion" name="Presión" radius={[6, 6, 0, 0]}>
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
        subtitulo="Porcentaje de jugadas con presión en cada cuarto"
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.porCuarto.map((d) => `Cuarto ${d.cuarto}: ${d.presion}%`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos.porCuarto.map((d) => ({ ...d, nombre: `Cuarto ${d.cuarto}` }))} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis dataKey="nombre" tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis unit="%" domain={[30, 42]} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar dataKey="presion" name="Presión" radius={[6, 6, 0, 0]}>
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
        subtitulo="Porcentaje de jugadas con presión en el 3er cuarto, según la temperatura del partido"
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.clima3erCuarto.map((d) => `${d.clima}: ${pct(d.presion)}`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={Math.round(300 * esc)}>
            <BarChart layout="vertical" data={datos.clima3erCuarto} margin={{ top: 10, right: 60, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis type="number" unit="%" domain={[0, 50]} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis type="category" dataKey="clima" width={Math.round(150 * esc)} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar dataKey="presion" name="Presión" radius={[0, 6, 6, 0]}>
                {datos.clima3erCuarto.map((d) => <Cell key={d.clima} fill={d.clima === tempMasAlta.clima ? NARANJA : AZUL} />)}
                <LabelList dataKey="presion" position="right" formatter={(v: unknown) => `${v}%`} style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-slate-800">
          Es una pista, no una prueba: cada grupo tiene entre 350 y 600 jugadas, y el estadio y el equipo también influyen.
        </p>
        <Tabla
          titulo="Mismos datos en tabla"
          columnas={['Clima', 'Jugadas', 'Con presión', 'Yardas promedio']}
          filas={datos.clima3erCuarto.map((d) => [d.clima, d.jugadas.toLocaleString(), pct(d.presion), d.yardas === null ? 'sin datos' : d.yardas.toFixed(2)])}
        />
        <Tabla
          titulo="Presión por clima y cuarto"
          columnas={['Clima', 'Cuarto 1', 'Cuarto 2', 'Cuarto 3', 'Cuarto 4']}
          filas={datos.climaPorCuarto.map((f) => [f.clima, pct(f.q1), pct(f.q2), pct(f.q3), pct(f.q4)])}
        />
      </Tarjeta>

      <Tarjeta
        titulo="4 · Qué temperaturas hay en los datos"
        subtitulo={`Partidos al aire libre por rango de temperatura (°F). ${datos.partidos.domo} partidos fueron en domo o techo cerrado y no tienen temperatura.`}
      >
        <div role="img" aria-label={`Gráfica de barras. ${datos.temperaturas.map((t) => `${t.rango} °F: ${t.partidos} partidos`).join('. ')}.`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={datos.temperaturas} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis dataKey="rango" tick={{ fontSize: tk, fill: '#0F172A' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: tk, fill: '#0F172A' }} />
              <Bar dataKey="partidos" name="Partidos" fill={AZUL} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="partidos" position="top" style={{ fill: '#0F172A', fontWeight: 700, fontSize: tk }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-slate-800">
          La temperatura va de {datos.partidos.tempMin} a {datos.partidos.tempMax} °F. Hay muy pocos partidos con frío fuerte.
        </p>
      </Tarjeta>
    </div>
  )
}
