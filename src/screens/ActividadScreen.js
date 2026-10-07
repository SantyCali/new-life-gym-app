import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { subscribeActividad } from '../services/actividadService';
import { todayDateString } from '../services/stepService';
import { clientesGuardados, cargarClientes } from '../services/clientesService';

// Solo testers: quién está usando la app ahora (EN VIVO), cuándo fue la
// última vez de cada uno y cuántas veces la abrió.
const EN_VIVO_MS = 4.5 * 60 * 1000; // el latido es cada 2 min: margen para atrasos

// Para buscar: sin mayúsculas, tildes ni espacios de más.
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

function haceCuanto(ms, ahora) {
  if (!ms) return 'nunca';
  const min = Math.max(0, Math.round((ahora - ms) / 60000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

export default function ActividadScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [filas, setFilas] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  const [clientes, setClientes] = useState({});  // uid → perfil completo (la lista de Mis clientes)
  const [filtro, setFiltro] = useState('todos'); // 'vivo' | 'hoy' | 'todos'
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => subscribeActividad(setFilas), []);
  useEffect(() => {
    // Primero la copia guardada (al instante, sin fotos) y después la lista
    // completa, con fotos.
    const mapa = (lista) => Object.fromEntries(lista.map((u) => [u.uid, u]));
    // La guardada solo si todavía no llegó la completa (si no, borraría las fotos).
    clientesGuardados().then((lista) => { if (lista) setClientes((prev) => (Object.keys(prev).length ? prev : mapa(lista))); });
    cargarClientes().then((lista) => { if (lista) setClientes(mapa(lista)); }).catch(() => {});
  }, []);
  // El "en vivo" depende de la hora: se recalcula cada 20 s.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 20 * 1000);
    return () => clearInterval(t);
  }, []);

  const hoy = todayDateString();
  const lista = useMemo(() => (filas ?? [])
    .map((f) => {
      const ultima = f.ultima?.toMillis?.() ?? 0;
      return { ...f, ultimaMs: ultima, enVivo: f.enApp !== false && ahora - ultima < EN_VIVO_MS, hoy: f.dias?.[hoy] ?? 0 };
    })
    .sort((a, b) => (b.enVivo - a.enVivo) || (b.ultimaMs - a.ultimaMs)), [filas, ahora, hoy]);

  const enVivo = lista.filter((f) => f.enVivo).length;
  const activosHoy = lista.filter((f) => f.hoy > 0).length;
  const porFiltro = filtro === 'vivo' ? lista.filter((f) => f.enVivo)
    : filtro === 'hoy' ? lista.filter((f) => f.hoy > 0)
    : lista;
  // Búsqueda por nombre o DNI (el DNI sale de la lista de Mis clientes), junto
  // con el filtro de arriba.
  const q = normalizar(busqueda);
  const qDni = q.replace(/[.\s]/g, '');
  const visibles = !q ? porFiltro : porFiltro.filter((f) => {
    const c = clientes[f.uid] ?? {};
    const nombre = normalizar(`${f.nombre ?? c.nombre ?? ''} ${f.apellido ?? c.apellido ?? ''}`);
    if (q.split(' ').every((p) => nombre.includes(p))) return true;
    return /^\d+$/.test(qDni) && [c.dni, c.gymDni].some((d) => String(d ?? '').includes(qDni));
  });

  // Tocar a alguien abre su perfil, igual que desde Mis clientes.
  const abrir = async (uid) => {
    let cliente = clientes[uid];
    if (!cliente) {
      const lista = await cargarClientes({ forzar: true }).catch(() => null);
      cliente = lista?.find((u) => u.uid === uid);
    }
    if (cliente) navigation.navigate('ClienteDetail', { cliente });
  };

  const renderFila = ({ item }) => {
    const foto = clientes[item.uid]?.photoBase64;
    const nombre = `${item.nombre ?? ''} ${item.apellido ?? ''}`.trim() || 'Sin nombre';
    const iniciales = nombre.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    return (
      <TouchableOpacity
        style={[st.fila, { borderColor: item.enVivo ? '#22C55E55' : colors.border }]}
        onPress={() => abrir(item.uid)}
        activeOpacity={0.75}
      >
        <View style={[st.avatar, { backgroundColor: colors.surfaceContainerHigh }]}>
          {foto
            ? <Image source={{ uri: `data:image/jpeg;base64,${foto}` }} style={st.foto} />
            : <Text style={[st.iniciales, { color: colors.text }]}>{iniciales}</Text>}
          {item.enVivo && <View style={[st.punto, { borderColor: colors.background }]} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[st.nombre, { color: colors.text }]} numberOfLines={1}>{nombre}</Text>
          <Text style={[st.sub, { color: item.enVivo ? '#22C55E' : colors.textSecondary }]}>
            {item.enVivo ? 'EN VIVO' : `Activo ${haceCuanto(item.ultimaMs, ahora)}`}
          </Text>
          <Text style={[st.meta, { color: colors.textSecondary }]}>
            {item.aperturas ?? 0} aperturas · hoy {item.hoy} · {item.plataforma === 'ios' ? 'iPhone' : 'Android'}{item.version ? ` · v${item.version}` : ''}
          </Text>
          {/* Con la batería restringida, Android puede parar el contador de
              pasos y no dejar que vuelva solo (ver GuardiaPasos.kt). */}
          {item.contador?.bateriaSinRestricciones === false && (
            <Text style={[st.meta, { color: '#FF9F1A' }]}>🔋 Batería con restricciones: puede dejar de contar pasos</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity style={[st.atras, { backgroundColor: colors.surfaceContainer }]} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[st.titulo, { color: colors.text }]}>Actividad</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={st.resumen}>
        {/* Tocar un dato filtra la lista */}
        {[
          { id: 'vivo', n: enVivo, label: 'En vivo', color: '#22C55E' },
          { id: 'hoy', n: activosHoy, label: 'Activos hoy', color: colors.primary },
          { id: 'todos', n: lista.length, label: 'Usuarios', color: colors.text },
        ].map((r) => {
          const elegido = filtro === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              onPress={() => setFiltro(r.id)}
              activeOpacity={0.8}
              style={[st.dato, {
                backgroundColor: elegido ? r.color + '22' : colors.surfaceContainer,
                borderColor: elegido ? r.color : colors.border,
              }]}
            >
              <Text style={[st.datoN, { color: r.color }]}>{r.n}</Text>
              <Text style={[st.datoLabel, { color: elegido ? colors.text : colors.textSecondary }]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Buscar por nombre o DNI */}
      <View style={[st.buscador, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
        <Ionicons name="search" size={17} color={colors.textTertiary} />
        <TextInput
          style={[st.buscadorInput, { color: colors.text }]}
          placeholder="Buscar por nombre o DNI"
          placeholderTextColor={colors.textTertiary}
          value={busqueda}
          onChangeText={setBusqueda}
          autoCorrect={false}
          returnKeyType="search"
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {filas === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(f) => f.uid}
          renderItem={renderFila}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={(
            <Text style={[st.vacio, { color: colors.textSecondary }]}>
              {lista.length === 0
                ? 'Todavía no hay actividad. Se empieza a registrar cuando cada uno abre la versión nueva de la app.'
                : q ? 'No hay nadie con ese nombre o DNI.'
                : filtro === 'vivo' ? 'Nadie está usando la app en este momento.' : 'Nadie abrió la app hoy.'}
            </Text>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    atras:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    titulo:    { fontSize: 20, fontWeight: '800' },
    resumen:   { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
    buscador:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
    buscadorInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
    dato:      { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
    datoN:     { fontSize: 24, fontWeight: '900' },
    datoLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    fila:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
    avatar:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    iniciales: { fontSize: 15, fontWeight: '800' },
    foto:      { width: 44, height: 44, borderRadius: 22 },
    punto:     { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2 },
    nombre:    { fontSize: 15, fontWeight: '800' },
    sub:       { fontSize: 12, fontWeight: '700', marginTop: 1 },
    meta:      { fontSize: 13, marginTop: 3, lineHeight: 18 },
    vacio:     { textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
  });
}
