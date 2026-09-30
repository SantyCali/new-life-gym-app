import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  updateSocio, deleteSocio, setFechaVencimiento, separarNombre,
} from '../services/sociosService';
import { avisarGuardado, avisarError } from '../utils/avisos';
import {
  inputAFecha, fechaAInput, hoySinHora, sumarMeses, sumarDias,
} from '../utils/fechas';
import { useSocios } from '../context/SociosContext';
import { ESTADOS } from '../services/estadoCuota';
import { getAllConvenios, createConvenio } from '../services/conveniosService';
import { getUserByDni, combinarSocioConApp } from '../services/usersService';
import {
  getCatalogoPlanes, getPlanesDeSocio, asignarPlan, eliminarPlanAsignado,
} from '../services/planesService';
import {
  subscribeAsistenciasDeSocio, registrarAsistencia, calcularPasesRestantes,
  contarIngresosDelMes,
} from '../services/asistenciasService';
import { fileToCompressedBase64 } from '../utils/image';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Avatar, { iniciales } from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import PhotoLightbox from '../components/PhotoLightbox';
import Icon from '../components/Icon';
import { Skeleton } from '../components/Skeleton';
import { Field, formatDate } from './SociosPage';

const DOT_ESTADO = {
  aldia:    'bg-accent shadow-glowSoft',
  proximo:  'bg-cyan shadow-glowCyan',
  vencido:  'bg-danger',
  inactivo: 'bg-textTertiary',
};

export default function SocioDetailPage() {
  const { dni } = useParams();
  const navigate = useNavigate();

  // El socio sale del listener compartido del padrón: si alguien lo edita
  // desde otra PC o desde la app, la ficha se actualiza sola.
  const { socios, loading: cargandoSocios } = useSocios();
  const [convenios, setConvenios]   = useState([]);
  const [planesHistorial, setPlanesHistorial] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [cuentaApp, setCuentaApp]   = useState(null);
  const [cargandoResto, setCargandoResto] = useState(true);
  const [showEdit, setShowEdit]     = useState(false);
  const [showPlanes, setShowPlanes] = useState(false);
  const [zoomFoto, setZoomFoto]     = useState(false);
  const [busy, setBusy]             = useState(false);
  const [fallidas, setFallidas]     = useState([]);
  const [tab, setTab]               = useState('asistencias');
  const [showRenovar, setShowRenovar] = useState(false);

  useEffect(() => {
    setCargandoResto(true);
    load();
  }, [dni]);

  // Asistencias en vivo: un ingreso por el kiosco aparece al instante.
  useEffect(() => subscribeAsistenciasDeSocio(dni, setAsistencias, (error) => {
    console.error('[admin-web] asistencias:', error);
    setFallidas((prev) => (prev.includes('asistencias') ? prev : [...prev, 'asistencias']));
  }), [dni]);

  // Convenios, planes y asistencias viven en colecciones que la app mobile no
  // usaba. Si una falla (reglas de Firestore, índice faltante), la ficha tiene
  // que abrir igual con esa sección vacía en vez de quedarse cargando.
  async function safe(promise, fallback, seccion, errores) {
    try {
      return await promise;
    } catch (error) {
      console.error(`[admin-web] ${seccion}:`, error);
      errores.push(seccion);
      return fallback;
    }
  }

  async function load() {
    const errores = [];
    try {
      const [c, p, u] = await Promise.all([
        safe(getAllConvenios(), [], 'convenios', errores),
        safe(getPlanesDeSocio(dni), [], 'planes', errores),
        safe(getUserByDni(dni), null, 'cuenta de la app', errores),
      ]);
      setConvenios(c);
      setPlanesHistorial(p);
      setCuentaApp(u);
      setFallidas(errores);
    } finally {
      setCargandoResto(false);
    }
  }

  const base  = socios.find((s) => s.dni === dni);
  const socio = base ? combinarSocioConApp(base, cuentaApp) : null;

  if (cargandoSocios || cargandoResto) return <SocioSkeleton />;

  if (!socio) {
    // Recién eliminado: el listener lo saca antes de que termine la navegación.
    if (busy) return null;
    return (
      <EmptyState
        icon={<Icon name="person_off" className="text-xl" />}
        title="No se encontró el socio"
        description={`No existe ningún socio con DNI ${dni}.`}
        action={<Link to="/socios" className="btn-outline btn-sm">Volver a Socios</Link>}
      />
    );
  }

  const convenio       = convenios.find((c) => c.id === socio.convenioId);
  const planVigente    = planesHistorial.find((p) => p.habilitado) ?? planesHistorial[0] ?? null;
  const pasesRestantes = calcularPasesRestantes(planVigente, asistencias);
  const estado         = ESTADOS[socio.estado];
  const ingresosMes    = contarIngresosDelMes(asistencias);
  const ultimoAcceso   = asistencias[0] ?? null;
  // La foto cargada en recepción manda; si no hay, se usa la del perfil de la
  // app mobile cuando el socio tiene cuenta vinculada por DNI.
  const fotoPerfil     = socio.fotoBase64 ?? socio.fotoApp ?? null;

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${socio.nombre}? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    try {
      const { excel } = await deleteSocio(dni);
      avisarGuardado('Socio eliminado', excel);
      navigate('/socios');
    } catch (error) {
      avisarError('No se pudo eliminar el socio', error);
      setBusy(false);
    }
  }

  // La confirmación la da la notificación de ingreso del panel, que salta
  // apenas el listener recibe el registro.
  async function handleRegistrarAsistencia() {
    setBusy(true);
    try {
      await registrarAsistencia(socio.nombre, dni);
    } catch (error) {
      avisarError('No se pudo registrar la asistencia', error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <nav className="flex items-center gap-2 pb-4 text-sm">
        <Link to="/socios" className="flex items-center gap-1 text-textSecondary transition-colors hover:text-text">
          <Icon name="arrow_back" className="text-base" />
          Socios
        </Link>
        <span className="text-textTertiary/50">/</span>
        <span className="text-text">Ficha de socio</span>
      </nav>

      {fallidas.length > 0 && (
        <p role="alert" className="mb-4 rounded-lg bg-cyan/10 px-3 py-2 text-sm text-cyan">
          No se pudo cargar: {fallidas.join(', ')}. Revisá la consola del navegador
          para ver el error exacto (puede ser un permiso de Firestore).
        </p>
      )}

      {/* Cabecera del socio */}
      <section className="card mb-4 p-5">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {fotoPerfil ? (
                <button
                  onClick={() => setZoomFoto(true)}
                  aria-label="Ampliar foto"
                  title="Ampliar foto"
                  className="block cursor-zoom-in overflow-hidden rounded-xl transition hover:ring-2 hover:ring-accent"
                >
                  <img
                    src={fotoSrc(fotoPerfil)}
                    alt={`Foto de ${socio.nombre}`}
                    className="h-20 w-20 object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surfaceHighest font-display text-2xl font-bold text-cyan">
                  {iniciales(socio.nombre)}
                </div>
              )}
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-surfaceContainer ${DOT_ESTADO[socio.estado]}`} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-text">
                  {socio.nombre} {socio.apellido}
                </h1>
                <Badge variant={estado.variant}>{estado.label}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-textSecondary">
                <span className="num">DNI {socio.dni}</span>
                {planVigente && (
                  <>
                    <span className="text-textTertiary/50">·</span>
                    <span className="font-display font-semibold text-text">{planVigente.nombrePlan}</span>
                  </>
                )}
                {cuentaApp && (
                  <>
                    <span className="text-textTertiary/50">·</span>
                    <span className="flex items-center gap-1 text-cyan">
                      <Icon name="smartphone" className="text-sm" />
                      App vinculada
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button onClick={handleRegistrarAsistencia} disabled={busy} className="btn-primary">
              <Icon name="check_circle" className="text-lg" />
              Registrar asistencia
            </button>
            <button onClick={() => setShowRenovar(true)} className="btn-outline">
              <Icon name="event_repeat" className="text-lg" />
              Renovar cuota
            </button>
            <MenuAcciones
              socio={socio}
              onEditar={() => setShowEdit(true)}
              onPlanes={() => setShowPlanes(true)}
              onEliminar={handleDelete}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Columna izquierda */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <section className="card flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
                Estado de membresía
              </span>
              <Badge variant={estado.variant}>{estado.label}</Badge>
            </div>

            <div>
              {planVigente ? (
                <p className="kpi text-text">
                  ${Number(planVigente.precio).toLocaleString('es-AR')}
                  <span className="ml-1 text-xs font-normal text-textSecondary">/ plan</span>
                </p>
              ) : (
                <p className="font-display text-lg font-bold text-textTertiary">Sin plan asignado</p>
              )}
              <p className="mt-1 text-xs text-textSecondary">
                Vence el{' '}
                <strong className="num font-display font-bold text-text">
                  {formatDate(socio.fechaVencimiento)}
                </strong>
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-surfaceLowest p-3">
              <div>
                <p className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
                  Balance
                </p>
                <p className={`num font-display text-sm font-bold ${socio.balance < 0 ? 'text-danger' : 'text-accent'}`}>
                  ${Number(socio.balance ?? 0).toLocaleString('es-AR')}
                  {!socio.balance && ' (sin deuda)'}
                </p>
              </div>
              {pasesRestantes !== null && (
                <div className="text-right">
                  <p className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
                    Pases
                  </p>
                  <p className="num font-display text-sm font-bold text-cyan">{pasesRestantes} restantes</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => setShowRenovar(true)} className="btn-primary btn-sm">
                <Icon name="event_repeat" className="text-base" />
                Renovar cuota
              </button>
              <button onClick={() => setShowPlanes(true)} className="flex items-center gap-1 font-display text-xs font-bold text-cyan transition-colors hover:text-cyanSoft">
                Gestionar plan
                <Icon name="arrow_forward" className="text-sm" />
              </button>
            </div>
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <span className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
              Contacto y documentación
            </span>

            <ContactoRow
              icono="phone_iphone"
              label="Teléfono / WhatsApp"
              valor={socio.telefono}
              accion={socio.telefono && (
                <a
                  href={whatsappLink(socio.telefono)}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir WhatsApp"
                  className="rounded-lg bg-surfaceHigh p-2 text-cyan transition-colors hover:bg-surfaceHighest"
                >
                  <Icon name="chat" className="text-base" />
                </a>
              )}
            />
            <ContactoRow icono="mail" label="Correo electrónico" valor={socio.email} />
            <ContactoRow icono="home" label="Dirección" valor={[socio.direccion, socio.localidad].filter(Boolean).join(', ')} />
            <ContactoRow icono="badge" label="RFID" valor={socio.rfid} mono />
            {socio.tieneConvenio && (
              <ContactoRow icono="handshake" label="Convenio" valor={convenio?.nombre} />
            )}
            {cuentaApp && (
              <>
                <ContactoRow icono="cake" label="Nacimiento" valor={cuentaApp.fechaNacimiento} mono />
                <ContactoRow icono="person" label="Sexo" valor={formatSexo(cuentaApp.sexo)} />
              </>
            )}

            <div className="flex items-center justify-between rounded-lg bg-surfaceLowest p-2.5">
              <div className="flex items-center gap-2.5">
                <Icon
                  name="health_and_safety"
                  className={`text-lg ${socio.certificadoMedico ? 'text-accent' : 'text-danger'}`}
                />
                <div>
                  <p className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
                    Apto médico
                  </p>
                  <p className={`font-display text-xs font-bold ${socio.certificadoMedico ? 'text-accent' : 'text-danger'}`}>
                    {socio.certificadoMedico ? 'Presentado' : 'No presentado'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowEdit(true)} className="btn-outline btn-sm">
                {socio.certificadoMedico ? 'Editar' : 'Cargar'}
              </button>
            </div>
          </section>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <section className="card flex flex-col gap-4 p-5">
            <div className="flex items-center gap-5 border-b border-border">
              <Tab activo={tab === 'asistencias'} onClick={() => setTab('asistencias')}>
                Últimas asistencias
              </Tab>
              <Tab activo={tab === 'planes'} onClick={() => setTab('planes')}>
                Historial de planes
              </Tab>
            </div>

            {tab === 'asistencias' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surfaceHigh px-3 py-2 text-xs text-textSecondary">
                  <span className="flex items-center gap-1.5">
                    <Icon name="trending_up" className="text-base text-accent" />
                    <strong className="num font-display font-bold text-text">{ingresosMes} ingresos</strong>
                    registrados este mes
                  </span>
                  {ultimoAcceso && (
                    <span>
                      Último acceso:{' '}
                      <strong className="num font-display font-bold text-text">
                        {formatDateTime(ultimoAcceso.fechaHora)}
                      </strong>
                    </span>
                  )}
                </div>

                {asistencias.length === 0 ? (
                  <EmptyState
                    icon={<Icon name="sensor_door" className="text-xl" />}
                    title="Sin asistencias registradas"
                    description="Los ingresos aparecen acá apenas el socio pase por el control."
                  />
                ) : (
                  <>
                    <div>
                      <div className="grid grid-cols-12 px-3 py-2 font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
                        <div className="col-span-6 sm:col-span-5">Fecha y hora</div>
                        <div className="col-span-3 hidden sm:block">Origen</div>
                        <div className="col-span-6 text-right sm:col-span-4">Estado en el ingreso</div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {asistencias.slice(0, 8).map((a, i) => (
                          <div
                            key={a.id}
                            className="grid grid-cols-12 items-center rounded-lg px-3 py-2.5 transition-colors hover:bg-surfaceHigh"
                          >
                            <div className="col-span-6 flex items-center gap-2 sm:col-span-5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-accent' : 'bg-surfaceHighest'}`} />
                              <span className="num text-sm text-text">{formatDateTime(a.fechaHora)}</span>
                            </div>
                            <div className="col-span-3 hidden text-sm text-textSecondary sm:block">
                              {a.estado === 'manual' ? 'Recepción' : 'Control de ingreso'}
                            </div>
                            <div className="col-span-6 text-right sm:col-span-4">
                              {/* El kiosco guarda acá el estado de cuota del socio al entrar. */}
                              <span className="rounded bg-surfaceHighest px-2 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-caps text-accent">
                                {a.estado === 'manual' ? 'Carga manual' : a.estado}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-textSecondary">
                      Mostrando {Math.min(8, asistencias.length)} de {asistencias.length} asistencias
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                {planesHistorial.length === 0 ? (
                  <EmptyState
                    icon={<Icon name="card_membership" className="text-xl" />}
                    title="Sin planes asignados"
                    description="Asigná un plan para fijar la fecha de vencimiento de la cuota."
                    action={
                      <button onClick={() => setShowPlanes(true)} className="btn-primary btn-sm">
                        Asignar plan
                      </button>
                    }
                  />
                ) : (
                  <div>
                    <div className="grid grid-cols-12 px-3 py-2 font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
                      <div className="col-span-5">Plan</div>
                      <div className="col-span-4">Vigencia</div>
                      <div className="col-span-3 text-right">Precio</div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {planesHistorial.map((p, i) => (
                        <div key={p.id} className="grid grid-cols-12 items-center rounded-lg px-3 py-2.5 transition-colors hover:bg-surfaceHigh">
                          <div className="col-span-5 flex items-center gap-2">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-accent' : 'bg-surfaceHighest'}`} />
                            <span className="truncate text-sm text-text">{p.nombrePlan}</span>
                          </div>
                          <div className="num col-span-4 text-xs text-textSecondary">
                            {formatDate(p.fechaInicio)} → {formatDate(p.fechaVencimiento)}
                          </div>
                          <div className="num col-span-3 text-right text-sm text-text">
                            ${Number(p.precio).toLocaleString('es-AR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {showRenovar && (
        <RenovarCuotaModal socio={socio} onClose={() => setShowRenovar(false)} />
      )}

      {zoomFoto && (
        <PhotoLightbox
          foto={fotoPerfil}
          alt={`Foto de ${socio.nombre} ${socio.apellido ?? ''}`.trim()}
          onClose={() => setZoomFoto(false)}
        />
      )}

      {showEdit && (
        <EditSocioModal
          socio={socio}
          convenios={convenios}
          fotoApp={socio.fotoApp}
          onClose={() => setShowEdit(false)}
          onSaved={async () => { setShowEdit(false); await load(); }}
          onConvenioCreated={(c) => setConvenios((prev) => [...prev, c])}
        />
      )}

      {showPlanes && (
        <PlanesModal
          dni={dni}
          historial={planesHistorial}
          onClose={() => setShowPlanes(false)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function Tab({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px cursor-pointer pb-2.5 font-display text-sm font-bold transition-colors ${
        activo
          ? 'text-accent shadow-[inset_0_-2px_0_0_#c3f400]'
          : 'text-textSecondary hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function ContactoRow({ icono, label, valor, mono, accion }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg p-2 transition-colors hover:bg-surfaceHigh">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon name={icono} className="shrink-0 text-lg text-textTertiary" />
        <div className="min-w-0">
          <p className="font-display text-[0.6875rem] font-bold uppercase tracking-caps text-textSecondary">
            {label}
          </p>
          <p className={`truncate text-sm ${valor ? 'text-text' : 'text-textTertiary'} ${mono ? 'num' : ''}`}>
            {valor || '—'}
          </p>
        </div>
      </div>
      {accion}
    </div>
  );
}

function MenuAcciones({ socio, onEditar, onPlanes, onEliminar }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Más acciones"
        className="btn-outline px-2.5"
      >
        <Icon name="more_vert" className="text-xl" />
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-surfaceHigh py-1 shadow-2xl">
          <MenuItem icono="edit" onClick={() => { setAbierto(false); onEditar(); }}>
            Editar datos
          </MenuItem>
          <MenuItem icono="card_membership" onClick={() => { setAbierto(false); onPlanes(); }}>
            Gestionar planes
          </MenuItem>
          {socio.telefono && (
            <a
              href={whatsappLink(socio.telefono)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setAbierto(false)}
              className="flex w-full items-center gap-2 px-4 py-2 font-display text-sm font-semibold text-text transition-colors hover:bg-surfaceContainer"
            >
              <Icon name="chat" className="text-base" />
              WhatsApp
            </a>
          )}
          <MenuItem icono="delete" onClick={() => { setAbierto(false); onEliminar(); }} peligro>
            Eliminar socio
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icono, onClick, children, peligro }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-4 py-2 font-display text-sm font-semibold transition-colors hover:bg-surfaceContainer ${
        peligro ? 'text-danger' : 'text-text'
      }`}
    >
      <Icon name={icono} className="text-base" />
      {children}
    </button>
  );
}

// Los teléfonos se cargan a mano y vienen con espacios, guiones o paréntesis;
// wa.me solo acepta dígitos.
function whatsappLink(telefono) {
  return `https://wa.me/${String(telefono).replace(/\D/g, '')}`;
}

function fotoSrc(base64) {
  return base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
}

function SocioSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="mb-4 h-32 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl lg:col-span-8" />
      </div>
    </div>
  );
}

function formatSexo(sexo) {
  if (!sexo) return null;
  return sexo === 'masculino' ? 'Masculino' : sexo === 'femenino' ? 'Femenino' : sexo;
}

function formatDateTime(ts) {
  if (!ts?.toDate) return '—';
  const fecha = ts.toDate();
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (fecha.toDateString() === hoy.toDateString())  return `Hoy, ${hora} hs`;
  if (fecha.toDateString() === ayer.toDateString()) return `Ayer, ${hora} hs`;
  return `${fecha.toLocaleDateString('es-AR')}, ${hora} hs`;
}

// Renovar = mover la fecha de vencimiento. Los atajos calculan desde el
// vencimiento actual si todavía no pasó (así no se le "comen" días a quien
// paga antes) y desde hoy si ya estaba vencido.
function RenovarCuotaModal({ socio, onClose }) {
  const hoy = hoySinHora();
  const actual = socio.fechaVencimiento?.toDate?.() ?? null;
  const base = actual && actual >= hoy ? actual : hoy;

  const [fecha, setFecha] = useState(fechaAInput(sumarMeses(base, 1)));
  const [saving, setSaving] = useState(false);

  const atajos = [
    { label: '+1 mes',   valor: sumarMeses(base, 1) },
    { label: '+15 días', valor: sumarDias(base, 15) },
    { label: '+3 meses', valor: sumarMeses(base, 3) },
  ];

  async function handleGuardar() {
    const nueva = inputAFecha(fecha);
    if (!nueva) return;
    setSaving(true);
    try {
      const { excel } = await setFechaVencimiento(socio.dni, nueva);
      avisarGuardado(`Cuota renovada hasta el ${nueva.toLocaleDateString('es-AR')}`, excel);
      onClose();
    } catch (error) {
      avisarError('No se pudo renovar la cuota', error);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Renovar cuota · ${socio.nombre}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg bg-surfaceLowest p-3 text-sm">
          <span className="text-textSecondary">Vence actualmente</span>
          <span className="num font-display font-bold text-text">
            {actual ? actual.toLocaleDateString('es-AR') : 'Sin fecha'}
          </span>
        </div>

        <div>
          <span className="label">Atajos {actual && actual >= hoy ? '(desde el vencimiento actual)' : '(desde hoy)'}</span>
          <div className="flex flex-wrap gap-2">
            {atajos.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setFecha(fechaAInput(a.valor))}
                className={`btn-sm btn ${fecha === fechaAInput(a.valor) ? 'bg-accent text-onAccent' : 'bg-surfaceHigh text-text hover:bg-surfaceHighest'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Nuevo vencimiento">
          <input type="date" className="input num" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>

        <p className="text-xs text-textTertiary">
          Se actualiza en la app, en este panel y en el Excel, que es lo que consulta el control de acceso de la entrada.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving || !fecha} className="btn-primary">
            {saving ? 'Guardando...' : 'Renovar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditSocioModal({ socio, convenios, fotoApp, onClose, onSaved, onConvenioCreated }) {
  // En Firestore y en el Excel el nombre va junto; acá se separa con la misma
  // regla que usa la planilla para que al guardar quede igual en los dos lados.
  const partes = separarNombre(socio.nombre);
  const [form, setForm] = useState({
    nombre: partes.nombre,
    apellido: partes.apellido,
    vencimiento: fechaAInput(socio.fechaVencimiento),
    email: socio.email ?? '',
    telefono: socio.telefono ?? '',
    telefonoEmergencia: socio.telefonoEmergencia ?? '',
    direccion: socio.direccion ?? '',
    localidad: socio.localidad ?? '',
    rfid: socio.rfid ?? '',
    tieneConvenio: socio.tieneConvenio ?? false,
    convenioId: socio.convenioId ?? '',
    certificadoMedico: socio.certificadoMedico ?? false,
  });
  const [fotoBase64, setFotoBase64] = useState(socio.fotoBase64 ?? null);
  const [saving, setSaving] = useState(false);
  const [nuevoConvenio, setNuevoConvenio] = useState('');

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoBase64(await fileToCompressedBase64(file));
  }

  async function handleCrearConvenio() {
    if (!nuevoConvenio.trim()) return;
    const id = await createConvenio({ nombre: nuevoConvenio, descuentoPorcentaje: 0 });
    onConvenioCreated({ id, nombre: nuevoConvenio.trim(), descuentoPorcentaje: 0, activo: true });
    set('convenioId', id);
    setNuevoConvenio('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { nombre, apellido, vencimiento, ...resto } = form;
    try {
      const { excel } = await updateSocio(socio.dni, {
        ...resto,
        nombre: `${nombre} ${apellido}`.trim(),
        fechaVencimiento: inputAFecha(vencimiento),
        convenioId: form.tieneConvenio ? (form.convenioId || null) : null,
        fotoBase64,
      });
      avisarGuardado('Socio actualizado', excel);
      onSaved();
    } catch (error) {
      avisarError('No se pudo guardar el socio', error);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Editar socio · DNI ${socio.dni}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        {socio.tieneCuentaApp && (
          <p className="rounded-lg bg-cyan/10 px-3 py-2 text-xs text-cyan">
            Este socio tiene la app vinculada. Los campos que el gimnasio no tenía
            cargados vienen de su perfil; al guardar quedan copiados en su ficha.
          </p>
        )}

        <div className="flex items-center gap-4">
          <Avatar nombre={form.nombre} apellido={form.apellido} foto={fotoBase64 ?? fotoApp} size="lg" />
          <div>
            <span className="label">
              Foto {!fotoBase64 && fotoApp && '(usando la de la app)'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFoto}
              className="block w-full cursor-pointer text-sm text-textSecondary file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surfaceHigh file:px-3 file:py-1.5 file:font-display file:text-sm file:font-bold file:text-text hover:file:bg-surfaceHighest"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
          </Field>
          <Field label="Apellido">
            <input className="input" value={form.apellido} onChange={(e) => set('apellido', e.target.value)} />
          </Field>
          <Field label="Vencimiento de cuota">
            <input className="input num" type="date" value={form.vencimiento} onChange={(e) => set('vencimiento', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="RFID">
            <input className="input num" value={form.rfid} onChange={(e) => set('rfid', e.target.value)} placeholder="Carga manual" />
          </Field>
          <Field label="Teléfono">
            <input className="input num" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
          </Field>
          <Field label="Tel. emergencia">
            <input className="input num" value={form.telefonoEmergencia} onChange={(e) => set('telefonoEmergencia', e.target.value)} />
          </Field>
          <Field label="Dirección">
            <input className="input" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} />
          </Field>
          <Field label="Localidad">
            <input className="input" value={form.localidad} onChange={(e) => set('localidad', e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3 rounded-lg bg-surfaceLowest p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-textSecondary">
            <input
              type="checkbox"
              checked={form.certificadoMedico}
              onChange={(e) => set('certificadoMedico', e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border accent-accent"
            />
            Certificado médico presentado
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-textSecondary">
            <input
              type="checkbox"
              checked={form.tieneConvenio}
              onChange={(e) => set('tieneConvenio', e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border accent-accent"
            />
            Tiene convenio
          </label>

          {form.tieneConvenio && (
            <div className="space-y-2 pl-6">
              <select className="input" value={form.convenioId} onChange={(e) => set('convenioId', e.target.value)}>
                <option value="">Seleccionar convenio...</option>
                {convenios.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Crear convenio nuevo..."
                  value={nuevoConvenio}
                  onChange={(e) => setNuevoConvenio(e.target.value)}
                />
                <button type="button" onClick={handleCrearConvenio} className="btn-outline shrink-0">
                  Agregar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlanesModal({ dni, historial, onClose, onChanged }) {
  const [catalogo, setCatalogo] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getCatalogoPlanes().then(setCatalogo); }, []);

  const selected = catalogo.find((p) => p.id === selectedId);

  async function handleAsignar() {
    if (!selected) return;
    setSaving(true);
    try {
      const { vencimiento, excel } = await asignarPlan(dni, selected);
      avisarGuardado(`Plan asignado, vence el ${vencimiento.toLocaleDateString('es-AR')}`, excel);
      await onChanged();
      setSelectedId('');
    } catch (error) {
      avisarError('No se pudo asignar el plan', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Quitar este plan del historial del socio?')) return;
    await eliminarPlanAsignado(dni, id);
    await onChanged();
  }

  return (
    <Modal title="Planes del socio" onClose={onClose} wide>
      <div className="space-y-6">
        <div>
          <h3 className="label">Asignar plan del catálogo</h3>
          {catalogo.length === 0 ? (
            <p className="text-sm text-textTertiary">
              No hay planes en el catálogo todavía.{' '}
              <Link to="/planes" className="text-cyan hover:underline">Crear uno</Link>.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <select className="input max-w-xs" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  <option value="">Seleccionar plan...</option>
                  {catalogo.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <button onClick={handleAsignar} disabled={!selected || saving} className="btn-primary">
                  {saving ? 'Asignando...' : 'Asignar'}
                </button>
              </div>
              {selected && (
                <p className="num mt-2 text-xs text-textSecondary">
                  {selected.grupoActividad && `${selected.grupoActividad} · `}
                  {selected.cantidadMeses} {selected.cantidadMeses === 1 ? 'mes' : 'meses'} ·{' '}
                  {selected.diasPorMes} días/mes · ${Number(selected.precio).toLocaleString('es-AR')}
                </p>
              )}
            </>
          )}
        </div>

        <div>
          <h3 className="label">Historial</h3>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            {historial.length === 0 ? (
              <EmptyState title="Sin planes cargados" />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surfaceHigh font-display text-[0.6875rem] uppercase tracking-caps text-textSecondary">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-bold">Plan</th>
                    <th scope="col" className="px-3 py-2 font-bold">Inicio</th>
                    <th scope="col" className="px-3 py-2 font-bold">Vencimiento</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Precio</th>
                    <th scope="col" className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {historial.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2 text-text">{p.nombrePlan}</td>
                      <td className="num px-3 py-2 text-textSecondary">{formatDate(p.fechaInicio)}</td>
                      <td className="num px-3 py-2 text-textSecondary">{formatDate(p.fechaVencimiento)}</td>
                      <td className="num px-3 py-2 text-right text-textSecondary">
                        ${Number(p.precio).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => handleEliminar(p.id)} className="btn-danger btn-sm">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-ghost">Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}
