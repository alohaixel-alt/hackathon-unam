import Explorar from './Explorar'
import { ControlesTamano, ProveedorAccesibilidad } from './Accesibilidad'

export default function App() {
  return (
    <ProveedorAccesibilidad>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-3 focus:text-slate-900 focus:ring-4 focus:ring-orange-400"
        >
          Ir al contenido principal
        </a>

        <header className="border-b-4 border-[#B84A00] bg-[#013369] px-6 py-4 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Presión y clima en jugadas de pase de la NFL</h1>
              <p className="text-sm text-blue-100">Explora qué ocurrió según el down, la distancia, el cuarto y el clima.</p>
            </div>
            <ControlesTamano />
          </div>
        </header>

        <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">
          <Explorar />
        </main>
      </div>
    </ProveedorAccesibilidad>
  )
}
