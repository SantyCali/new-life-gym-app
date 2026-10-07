import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { Alert } from 'react-native';
import useAuth from '../hooks/useAuth';
import {
  subscribeTorneoParticipantes,
  subscribeTorneo,
  fetchParticipantStats,
  addParticipant,
  eliminarParticipante,
  finalizarTorneo,
  eliminarTorneo,
  searchUsers,
  busquedaCompleta,
  tiempoRestante,
  textoDuracion,
  torneoTerminado,
  torneoCerrado,
  puntosEnTorneo,
  puntosDeFila,
  congelarResultado,
  salirDelTorneo,
  PRIZES,
} from '../services/torneoService';

const MEDAL = ['🥇', '🥈', '🥉'];

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// "2026-10-06" → "Lun 6/10"
function etiquetaDia(fecha) {
  const [y, m, d] = String(fecha).split('-').map(Number);
  if (!y || !m || !d) return fecha;
  return `${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]} ${d}/${m}`;
}

const miles = (n) => Number(n ?? 0).toLocaleString('es-AR');

// Timestamp → "lun 5/10 a las 18:32"
function cuandoEntro(ts) {
  const d = ts?.toDate?.();
  if (!d) return null;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DIAS_SEMANA[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1} a las ${hora}`;
}

function getInitials(nombre, apellido) {
  return `${(nombre ?? '')[0] ?? ''}${(apellido ?? '')[0] ?? ''}`.toUpperCase();
}

function avatarColor(uid) {
  const palette = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}


export default function TorneoDetailScreen({ route, navigation }) {
  const { torneoId, nombre } = route.params;
  const { theme: { colors } } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [torneo,       setTorneo]       = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [stats,        setStats]        = useState({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsDe,      setStatsDe]      = useState('');   // uids de la última lectura de stats
  const [finalizando,  setFinalizando]  = useState(false);
  const [resultModal,  setResultModal]  = useState(false);
  const [detalleUid,   setDetalleUid]   = useState(null);   // a quién se le mira el detalle

  const [searchModal,   setSearchModal]   = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [feedback,      setFeedback]      = useState({});

  const participantesRef = useRef([]);
  const searchTimerRef   = useRef(null);
  const searchSeqRef     = useRef(0);

  useEffect(() => subscribeTorneo(torneoId, setTorneo), [torneoId]);

  useEffect(() => {
    const unsub = subscribeTorneoParticipantes(torneoId, data => {
      setParticipantes(data);
      participantesRef.current = data;
    });
    return unsub;
  }, [torneoId]);

  const isCreator = torneo?.creadoPor === user?.uid;
  const isActivo  = torneo?.activo !== false;
  // Pasó la fecha de fin o se finalizó: la tabla queda congelada.
  const terminado = torneoTerminado(torneo);
  const cerrado = torneoCerrado(torneo);
  // Solo pasos: el gym no suma (ver xpDeJuego).
  const soloPasos = !!torneo?.soloPasos;

  const refreshStats = useCallback(async () => {
    const parts = participantesRef.current;
    if (!parts.length) { setLoadingStats(false); return; }
    setLoadingStats(true);
    try {
      const uids = parts.map(p => p.uid);
      const result = await fetchParticipantStats(uids);
      setStats(result);
      setStatsDe(uids.slice().sort().join(','));
    } catch {}
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    if (participantes.length > 0) refreshStats();
  }, [participantes.length]);

  useFocusEffect(useCallback(() => {
    refreshStats();
  }, [refreshStats]));

  const leaderboard = useMemo(() => {
    return participantes
      .map(p => {
        const current = stats[p.uid] ?? {};
        const { xpGanado, gymGanado } = puntosDeFila(torneo, p, current, terminado);
        const nivel     = current.nivelJuego ?? 1;
        // Foto actual del perfil (la de la fila es la de cuando lo sumaron).
        return { ...p, photoBase64: current.photoBase64 ?? p.photoBase64, xpGanado, gymGanado, nivel, actual: current };
      })
      .sort((a, b) => b.xpGanado - a.xpGanado);
  }, [participantes, stats, terminado, torneo]);

  // Torneo ya cerrado sin tabla congelada (de antes de este cambio): se
  // congela con los números de ahora, así deja de subir.
  const congeladoRef = useRef(false);
  useEffect(() => {
    if (!torneo || torneo.activo !== false || torneo.resultado || congeladoRef.current) return;
    if (!participantes.length || loadingStats) return;
    if (statsDe !== participantes.map(p => p.uid).sort().join(',')) return;
    congeladoRef.current = true;
    congelarResultado(torneoId, leaderboard).catch(() => { congeladoRef.current = false; });
  }, [torneo, participantes, loadingStats, statsDe, leaderboard, torneoId]);

  // Venció y nadie lo finalizó: se cierra (y se premia) al abrirlo, con la
  // tabla congelada en la fecha de fin. Espera a tener los puntos de todos.
  const cierreAutoRef = useRef(false);
  useEffect(() => {
    if (!torneo || torneo.activo === false || !cerrado || cierreAutoRef.current) return;
    if (!participantes.length || loadingStats) return;
    if (statsDe !== participantes.map(p => p.uid).sort().join(',')) return;
    cierreAutoRef.current = true;
    finalizarTorneo(torneoId, leaderboard)
      .then(cerro => { if (cerro && leaderboard.length >= 2) setResultModal(true); })
      .catch(() => { cierreAutoRef.current = false; });
  }, [torneo, cerrado, participantes, loadingStats, statsDe, leaderboard, torneoId]);

  const existingUids = useMemo(() => new Set(participantes.map(p => p.uid)), [participantes]);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    // Por privacidad no hay sugerencias: se busca recién con el nombre y
    // apellido completos, o el DNI (ver searchUsers).
    if (!busquedaCompleta(q)) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeqRef.current;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(q);
        if (seq !== searchSeqRef.current) return; // descartá respuesta vieja
        setSearchResults(results.filter(u => !existingUids.has(u.uid)));
      } catch {}
      if (seq === searchSeqRef.current) setSearching(false);
    }, 300);
  }, [existingUids]);

  const handleAdd = useCallback(async (targetUid) => {
    setFeedback(prev => ({ ...prev, [targetUid]: 'loading' }));
    try {
      const result = await addParticipant(torneoId, targetUid, user?.uid);
      setFeedback(prev => ({ ...prev, [targetUid]: result }));
      if (result === 'ok') {
        setSearchResults(prev => prev.filter(u => u.uid !== targetUid));
      }
    } catch {
      setFeedback(prev => ({ ...prev, [targetUid]: 'error' }));
    }
  }, [torneoId, user?.uid]);

  // El creador saca a alguien. Al que sacaron no le llega ningún aviso.
  const handleSacar = useCallback((item) => {
    const nombre = `${item.nombre ?? ''} ${item.apellido ?? ''}`.trim() || 'este participante';
    Alert.alert(
      'Sacar del torneo',
      `¿Querés sacar a ${nombre} del torneo? No le va a llegar ningún aviso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sacar',
          style: 'destructive',
          onPress: () => { eliminarParticipante(torneoId, item.id, item.uid).catch(() => {}); },
        },
      ]
    );
  }, [torneoId]);

  // Salir del torneo (cualquiera, también el creador).
  const handleSalir = useCallback(() => {
    const mensaje = participantes.length <= 1
      ? 'Sos el último: si salís, el torneo se elimina. ¿Seguro?'
      : isCreator
        ? 'Vas a dejar el torneo y pasa a manos de otro participante. ¿Seguro?'
        : 'Vas a dejar el torneo y tus puntos dejan de contar acá. ¿Seguro?';
    Alert.alert('Salir del torneo', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try {
            await salirDelTorneo(torneoId, user?.uid);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'No se pudo salir del torneo. Probá de nuevo.');
          }
        },
      },
    ]);
  }, [torneoId, user?.uid, isCreator, participantes.length, navigation]);

  const handleEliminar = useCallback(() => {
    Alert.alert(
      'Eliminar torneo',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarTorneo(torneoId);
              navigation.goBack();
            } catch {}
          },
        },
      ]
    );
  }, [torneoId, navigation]);

  const handleFinalizar = useCallback(async () => {
    if (finalizando || !leaderboard.length) return;
    setFinalizando(true);
    try {
      const cerro = await finalizarTorneo(torneoId, leaderboard);
      if (cerro) setResultModal(true);
    } catch {}
    setFinalizando(false);
  }, [torneoId, leaderboard, finalizando]);

  const renderRow = useCallback(({ item, index }) => {
    const medal = MEDAL[index] ?? null;
    const initials = getInitials(item.nombre, item.apellido);
    const bg = avatarColor(item.uid);
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setDetalleUid(item.uid)}
        style={[styles.row, { backgroundColor: colors.surfaceElevated, borderColor: index === 0 ? '#FBBF2440' : colors.border }]}
      >
        <View style={styles.rankWrap}>
          {medal
            ? <Text style={styles.medal}>{medal}</Text>
            : <Text style={[styles.rankNum, { color: colors.textSecondary }]}>{index + 1}</Text>
          }
        </View>
        <View style={[styles.avatar, { backgroundColor: bg }]}>
          {item.photoBase64
            ? <Image source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }} style={styles.avatarImg} />
            : <Text style={styles.initials}>{initials}</Text>
          }
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
            {`${item.nombre} ${item.apellido}`.trim() || 'Sin nombre'}
          </Text>
          <View style={styles.rowMeta}>
            <View style={[styles.nivelChip, { backgroundColor: colors.primaryDim12, borderColor: colors.primaryBorder }]}>
              <Text style={[styles.nivelText, { color: colors.primary }]}>Nv. {item.nivel}</Text>
            </View>
            {!soloPasos && (
              <Text style={[styles.gymCount, { color: colors.textSecondary }]}>{item.gymGanado} gym</Text>
            )}
          </View>
        </View>
        <Text style={styles.xpGanado}>+{item.xpGanado} XP</Text>
        {isCreator && !terminado && item.uid !== user?.uid && (
          <TouchableOpacity onPress={() => handleSacar(item)} hitSlop={10} style={{ marginLeft: 10 }}>
            <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [colors, styles, isCreator, terminado, user?.uid, handleSacar, soloPasos]);

  // Fila que se está mirando, siempre con los números de ahora.
  const detalle = detalleUid ? leaderboard.find(p => p.uid === detalleUid) : null;
  const detallePuesto = detalle ? leaderboard.indexOf(detalle) : -1;
  // En solo pasos, los días que solo fue al gym no se muestran.
  const diasDetalle = (detalle?.detalleTorneo ?? []).filter(d => !soloPasos || d.pasos > 0 || d.xpPasos > 0);

  const renderSearchResult = useCallback(({ item }) => {
    const fb = feedback[item.uid];
    return (
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchAvatar, { backgroundColor: avatarColor(item.uid) }]}>
          {item.photoBase64
            ? <Image source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }} style={styles.avatarImg} />
            : <Text style={styles.initials}>{getInitials(item.nombre, item.apellido)}</Text>
          }
        </View>
        <View style={styles.searchBody}>
          <Text style={[styles.searchName, { color: colors.text }]} numberOfLines={1}>
            {`${item.nombre ?? ''} ${item.apellido ?? ''}`.trim() || 'Sin nombre'}
          </Text>
          <Text style={[styles.searchEmail, { color: colors.textSecondary }]} numberOfLines={1}>{`Nivel ${item.nivelJuego ?? 1}`}</Text>
        </View>
        {fb === 'loading' ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : fb === 'ok' ? (
          <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
        ) : fb === 'already' ? (
          <Text style={[styles.fbText, { color: colors.textTertiary }]}>Ya está</Text>
        ) : (
          <TouchableOpacity onPress={() => handleAdd(item.uid)} style={[styles.addRowBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={18} color="#000" />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [colors, feedback, handleAdd]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{nombre}</Text>
        <TouchableOpacity
          style={[styles.updateBtn, { borderColor: colors.border }]}
          onPress={refreshStats}
          disabled={loadingStats}
        >
          {loadingStats
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh" size={18} color={colors.primary} />
          }
        </TouchableOpacity>
      </View>

      <View style={styles.actionsArea}>
        {/* Duración */}
        {torneo?.fechaFin && (() => {
          const t = tiempoRestante(torneo.fechaFin);
          return (
            <View style={[styles.timerRow, { backgroundColor: t.vencido ? '#EF444415' : colors.surfaceElevated, borderColor: t.vencido ? '#EF444430' : colors.border }]}>
              <Ionicons name="time-outline" size={14} color={t.vencido ? '#EF4444' : colors.textSecondary} />
              <Text style={[styles.timerText, { color: t.vencido ? '#EF4444' : colors.textSecondary }]}>
                {t.vencido ? 'El torneo terminó' : `${t.texto} · Dura ${textoDuracion(torneo)}`}
              </Text>
            </View>
          );
        })()}

        {/* Cómo se juega: lo eligió el creador al armarlo. */}
        {torneo && (
          <View style={[styles.timerRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={styles.modoIcono}>{soloPasos ? '👟' : '👟🏋️'}</Text>
            <Text style={[styles.timerText, { color: colors.textSecondary }]}>
              {soloPasos ? 'Solo pasos · el gym no suma' : 'Pasos y gym · 150 XP por día de gym'}
            </Text>
          </View>
        )}

        {/* Agregar jugador */}
        {!terminado && (
          <TouchableOpacity
            style={[styles.addPlayerBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => { setSearchModal(true); setSearchQuery(''); setSearchResults([]); setFeedback({}); }}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
            <Text style={[styles.addPlayerText, { color: colors.primary }]}>Agregar jugador</Text>
          </TouchableOpacity>
        )}

        {/* Finalizado badge */}
        {!isActivo && (
          <View style={[styles.finalizadoBadge, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}>
            <Ionicons name="flag" size={14} color="#EF4444" />
            <Text style={styles.finalizadoText}>Torneo finalizado</Text>
          </View>
        )}

        {/* Finalizar torneo — solo creador, torneo activo, mínimo 2 jugadores */}
        {isCreator && !terminado && leaderboard.length >= 2 && (
          <TouchableOpacity
            style={[styles.finalizarBtn, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}
            onPress={handleFinalizar}
            disabled={finalizando}
            activeOpacity={0.82}
          >
            {finalizando ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <View style={styles.finalizarInner}>
                <View style={styles.finalizarLeft}>
                  <Ionicons name="flag" size={20} color="#EF4444" />
                  <View>
                    <Text style={styles.finalizarTitle}>Finalizar torneo</Text>
                    <Text style={styles.finalizarSub}>Los ganadores recibirán XP</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#EF4444" />
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Salir y eliminar, uno al lado del otro (eliminar solo el creador). */}
        <View style={styles.salirFila}>
          <TouchableOpacity
            style={[styles.salirBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={handleSalir}
            activeOpacity={0.75}
          >
            <Ionicons name="exit-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.salirText, { color: colors.textSecondary }]}>Salir del torneo</Text>
          </TouchableOpacity>
          {isCreator && (
            <TouchableOpacity
              style={[styles.salirBtn, { backgroundColor: '#EF444412', borderColor: '#EF444433' }]}
              onPress={handleEliminar}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={[styles.salirText, { color: '#EF4444' }]}>Eliminar torneo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {leaderboard.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Sin participantes aún</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de resultados finales */}
      <Modal visible={resultModal} transparent animationType="fade" onRequestClose={() => setResultModal(false)} statusBarTranslucent navigationBarTranslucent>
        <View style={styles.resultOverlay}>
          <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: '#FBBF2440' }]}>
            <Text style={styles.resultTrophy}>🏆</Text>
            <Text style={[styles.resultTitle, { color: colors.text }]}>¡Torneo finalizado!</Text>
            <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
              Los ganadores recibieron sus premios
            </Text>
            {leaderboard.slice(0, 3).map((p, i) => (
              <View key={p.uid} style={[styles.resultRow, { borderBottomColor: colors.border }]}>
                <Text style={styles.resultMedal}>{MEDAL[i]}</Text>
                <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                  {`${p.nombre} ${p.apellido}`.trim() || 'Sin nombre'}
                </Text>
                <View style={styles.resultPrize}>
                  <Text style={styles.resultXP}>+{PRIZES[i].xp} XP</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.resultBtn, { backgroundColor: '#FBBF24' }]}
              onPress={() => { setResultModal(false); navigation.goBack(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.resultBtnText}>¡Genial!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Detalle de un participante: cómo sumó sus puntos, día por día. Tocar
          afuera lo cierra. */}
      <Modal
        visible={!!detalle}
        transparent
        animationType="fade"
        onRequestClose={() => setDetalleUid(null)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.detalleOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetalleUid(null)} />
          {detalle && (
            <View style={[styles.detalleCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: insets.bottom + spacing.lg }]}>
              <View style={styles.detalleHead}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(detalle.uid) }]}>
                  {detalle.photoBase64
                    ? <Image source={{ uri: `data:image/jpeg;base64,${detalle.photoBase64}` }} style={styles.avatarImg} />
                    : <Text style={styles.initials}>{getInitials(detalle.nombre, detalle.apellido)}</Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                    {`${detalle.nombre} ${detalle.apellido}`.trim() || 'Sin nombre'}
                  </Text>
                  <Text style={[styles.detalleSub, { color: colors.textSecondary }]}>
                    {`${MEDAL[detallePuesto] ?? `${detallePuesto + 1}°`} en el torneo · `}
                    {soloPasos ? 'solo pasos' : `${detalle.gymGanado} ${detalle.gymGanado === 1 ? 'día' : 'días'} de gym`}
                  </Text>
                  {/* Cuándo entró al torneo (o lo creó). */}
                  {cuandoEntro(detalle.joinedAt) && (
                    <Text style={[styles.detalleSub, { color: colors.textTertiary, marginTop: 1 }]}>
                      {/* "Creó" solo si entró al arrancar el torneo: si el creador
                          se fue, el que quedó a cargo entró después. */}
                      {`${torneo?.creadoPor === detalle.uid
                        && Math.abs((detalle.joinedAt?.toMillis?.() ?? 0) - (torneo?.fechaInicio?.toMillis?.() ?? 0)) < 60_000
                        ? 'Creó el torneo' : 'Entró'} el ${cuandoEntro(detalle.joinedAt)}`}
                    </Text>
                  )}
                </View>
                <Text style={styles.xpGanado}>+{detalle.xpGanado} XP</Text>
              </View>

              {diasDetalle.length ? (
                <ScrollView style={styles.detalleLista} showsVerticalScrollIndicator={false}>
                  {diasDetalle.map((d) => (
                    <View key={d.fecha} style={[styles.detalleFila, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.detalleDia, { color: colors.text }]}>{etiquetaDia(d.fecha)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detallePasos, { color: colors.textSecondary }]}>
                          {`👟 ${miles(d.pasos)} pasos`}
                          {d.xpPasos > 0 ? <Text style={styles.detalleXp}>{`  +${d.xpPasos} XP`}</Text> : null}
                        </Text>
                        {!soloPasos && d.xpGym > 0 && (
                          <Text style={[styles.detallePasos, { color: colors.textSecondary }]}>
                            {'🏋️ Fue al gym'}
                            <Text style={styles.detalleXp}>{`  +${d.xpGym} XP`}</Text>
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.detalleTotal, { color: colors.text }]}>{`+${(d.xpPasos ?? 0) + (soloPasos ? 0 : (d.xpGym ?? 0))}`}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.detalleVacio}>
                  <Ionicons name="time-outline" size={28} color={colors.textTertiary} />
                  <Text style={[styles.noResultsText, { color: colors.textSecondary, fontSize: 14 }]}>
                    {detalle.xpGanado > 0
                      ? 'Todavía no hay detalle. Aparece cuando abra la app actualizada.'
                      : 'Todavía no sumó puntos en este torneo.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.detalleCerrar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setDetalleUid(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.salirText, { color: colors.text }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Pantalla completa, también detrás de las barras del sistema: sin esto
          en Android se veía la pantalla de atrás por abajo. Los márgenes salen
          de la pantalla (adentro del Modal el SafeAreaView no los conoce y en
          iOS la flecha quedaba debajo del notch). */}
      <Modal
        visible={searchModal}
        animationType="slide"
        onRequestClose={() => setSearchModal(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={[styles.searchScreen, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.searchHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setSearchModal(false)} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.sheetTitle, { color: colors.text, flex: 1 }]}>Agregar jugador</Text>
            </View>

            {/* Search input */}
            <View style={[styles.searchInputWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Nombre y apellido, o DNI"
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {/* Results */}
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.uid}
                renderItem={renderSearchResult}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: spacing.xl }}
              />
            ) : busquedaCompleta(searchQuery) && !searching ? (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={36} color={colors.textTertiary} />
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>No encontramos a nadie con ese nombre o DNI</Text>
                <Text style={[styles.noResultsText, { color: colors.textTertiary, fontSize: 13, marginTop: 6 }]}>Revisá que esté escrito igual que en su perfil.</Text>
              </View>
            ) : !searching ? (
              <View style={styles.noResults}>
                <Ionicons name="lock-closed-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>Escribí el nombre y apellido completos, o el DNI</Text>
                <Text style={[styles.noResultsText, { color: colors.textTertiary, fontSize: 13, marginTop: 6 }]}>Para cuidar la privacidad de todos, no mostramos sugerencias.</Text>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 0.5,
    },
    backBtn: { padding: 4, marginRight: spacing.sm },
    headerTitle: {
      flex: 1,
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
    },
    updateBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionsArea: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    timerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    timerText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    addPlayerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    addPlayerText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    list: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing['3xl'],
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 0.5,
      padding: spacing.md,
      gap: spacing.sm,
    },
    rankWrap: {
      width: 28,
      alignItems: 'center',
    },
    medal: { fontSize: 20 },
    rankNum: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    initials: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.black,
      color: '#fff',
    },
    rowBody: { flex: 1 },
    rowName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      marginBottom: 3,
    },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    nivelChip: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    nivelText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
    },
    gymCount: {
      fontSize: typography.sizes.xs,
    },
    xpGanado: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.black,
      color: '#22C55E',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    emptyText: {
      fontSize: typography.sizes.base,
    },
    searchScreen: {
      flex: 1,
    },
    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 0.5,
      marginBottom: spacing.md,
    },
    sheetTitle: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.black,
    },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.sizes.base,
      height: 36,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 0.5,
      gap: spacing.md,
      paddingHorizontal: 0,
    },
    searchAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    searchBody: { flex: 1 },
    searchName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    searchEmail: {
      fontSize: typography.sizes.sm,
    },
    addRowBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fbText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
    },
    noResults: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
    },
    noResultsText: {
      fontSize: typography.sizes.base,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },

    finalizadoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    finalizadoText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: '#EF4444',
    },
    finalizarBtn: {
      borderWidth: 1,
      borderRadius: radius.xl,
      padding: spacing.lg,
    },
    finalizarInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    finalizarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    finalizarTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: '#EF4444',
      marginBottom: 2,
    },
    finalizarSub: {
      fontSize: typography.sizes.xs,
      color: '#EF444499',
    },

    salirFila: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    salirBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    salirText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },

    modoIcono: { fontSize: 13 },
    detalleOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.lg,
    },
    detalleCard: {
      borderRadius: 28,
      borderWidth: 0.5,
      padding: spacing.lg,
      maxHeight: '80%',
    },
    detalleHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    detalleSub: { fontSize: typography.sizes.xs },
    detalleLista: { flexGrow: 0 },
    detalleFila: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 0.5,
      gap: spacing.md,
    },
    detalleDia: {
      width: 64,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
    },
    detallePasos: { fontSize: typography.sizes.sm, lineHeight: 20 },
    detalleXp: { color: '#22C55E', fontWeight: typography.weights.bold },
    detalleTotal: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.black,
    },
    detalleVacio: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xl,
    },
    detalleCerrar: {
      marginTop: spacing.md,
      alignItems: 'center',
      paddingVertical: spacing.sm + 4,
      borderRadius: radius.full,
      borderWidth: 1,
    },

    resultOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    resultCard: {
      width: '100%',
      borderRadius: radius.xl,
      borderWidth: 1.5,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    resultTrophy: { fontSize: 52, marginBottom: 4 },
    resultTitle: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.black,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    resultSub: {
      fontSize: typography.sizes.sm,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingVertical: spacing.sm,
      borderBottomWidth: 0.5,
      gap: spacing.sm,
    },
    resultMedal: { fontSize: 22, width: 32, textAlign: 'center' },
    resultName: {
      flex: 1,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    resultPrize: { alignItems: 'flex-end' },
    resultXP: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.black,
      color: '#22C55E',
    },
    resultCoins: { fontSize: typography.sizes.xs },
    resultBtn: {
      marginTop: spacing.lg,
      borderRadius: radius.full,
      paddingVertical: 13,
      paddingHorizontal: 48,
    },
    resultBtnText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.black,
      color: '#000',
    },
  });
}
