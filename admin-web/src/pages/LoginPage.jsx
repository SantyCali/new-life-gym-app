import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

export default function LoginPage() {
  const { user, isTrainer, initializing, signIn, resetPassword, authError } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [verPass, setVerPass]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [aviso, setAviso]       = useState(null);

  if (!initializing && user && isTrainer) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setAviso(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password, recordar);
    } catch {
      // authError ya queda seteado por el AuthContext
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setAviso({ tipo: 'error', texto: 'Escribí tu email arriba y volvé a tocar el enlace.' });
      return;
    }
    try {
      await resetPassword(email.trim());
      setAviso({ tipo: 'ok', texto: `Te enviamos un correo a ${email.trim()} para restablecer la contraseña.` });
    } catch {
      // authError ya queda seteado por el AuthContext
    }
  }

  const sinPermisos = !initializing && user && !isTrainer;

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-bg bg-ambient">
      <div className="pointer-events-none fixed inset-0 grid-overlay" />

      <main className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-7 text-center">
            <div className="mb-4 flex justify-center">
              <div className="group relative rounded-2xl border border-border bg-surfaceContainer/90 p-2.5 shadow-2xl backdrop-blur-xl">
                <div className="absolute -inset-1 rounded-2xl bg-accent/20 opacity-30 blur transition duration-500 group-hover:opacity-70" />
                <img src="/logo-nlg.png" alt="New Life Gym" className="relative h-14 w-14 rounded-xl" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text">
              New Life Gym
            </h1>
            <div className="mt-1.5 flex items-center justify-center gap-2">
              <span className="h-px w-6 bg-accent/50" />
              <p className="font-display text-[0.6875rem] font-extrabold uppercase tracking-caps text-accent drop-shadow-[0_0_12px_rgba(195,244,0,0.4)]">
                Panel de administración
              </p>
              <span className="h-px w-6 bg-accent/50" />
            </div>
          </div>

          <section className="relative overflow-hidden rounded-2xl border border-border bg-surfaceContainer/90 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-textTertiary">
                    <Icon name="alternate_email" className="text-lg" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input py-3 pl-11"
                    placeholder="entrenador@newlife.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="label">Contraseña</label>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="mb-1.5 cursor-pointer font-display text-[0.6875rem] font-bold text-accent transition hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-textTertiary">
                    <Icon name="lock" className="text-lg" />
                  </span>
                  <input
                    id="password"
                    type={verPass ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input py-3 pl-11 pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass((v) => !v)}
                    aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className={`absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 transition ${
                      verPass ? 'text-accent' : 'text-textTertiary hover:text-text'
                    }`}
                  >
                    <Icon name={verPass ? 'visibility_off' : 'visibility'} className="text-lg" />
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-border accent-accent"
                />
                <span className="text-xs text-textSecondary">Mantener la sesión iniciada</span>
              </label>

              {(authError || sinPermisos) && (
                <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
                  <Icon name="error" className="mt-0.5 shrink-0 text-base" />
                  {sinPermisos
                    ? 'Esta cuenta no tiene permisos de entrenador.'
                    : authError}
                </p>
              )}

              {aviso && (
                <p
                  role="status"
                  className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                    aviso.tipo === 'ok' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'
                  }`}
                >
                  <Icon name={aviso.tipo === 'ok' ? 'mark_email_read' : 'info'} className="mt-0.5 shrink-0 text-base" />
                  {aviso.texto}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 uppercase tracking-caps active:scale-[0.99]"
              >
                {loading ? 'Ingresando...' : 'Ingresar al sistema'}
                {!loading && <Icon name="arrow_forward" className="text-base" />}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between border-t border-border/70 pt-5 text-[11px] text-textTertiary">
              <span className="flex items-center gap-1.5">
                <Icon name="verified_user" className="text-sm text-accent" />
                Conexión cifrada
              </span>
              <span className="num">New Life Gym · Merlo</span>
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-textTertiary">
            Acceso exclusivo para personal autorizado del gimnasio.
          </p>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/40 px-6 py-4 text-center text-xs text-textTertiary">
        © {new Date().getFullYear()} <span className="font-semibold text-textSecondary">New Life Gym</span> · Merlo, San Luis
      </footer>
    </div>
  );
}
