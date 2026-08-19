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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  finalizarTorneo,
  eliminarTorneo,
  searchUsers,
  tiempoRestante,
  PRIZES,
} from '../services/torneoService';

const MEDAL = ['🥇', '🥈', '🥉'];

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
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [torneo,       setTorneo]       = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [stats,        setStats]        = useState({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [finalizando,  setFinalizando]  = useState(false);
  const [resultModal,  setResultModal]  = useState(false);

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

  const refreshStats = useCallback(async () => {
    const parts = participantesRef.current;
    if (!parts.length) { setLoadingStats(false); return; }
    setLoadingStats(true);
    try {
      const uids = parts.map(p => p.uid);
      const result = await fetchParticipantStats(uids);
      setStats(result);
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
        const xpGanado  = Math.max(0, (current.xpTotal ?? 0) - (p.xpTotalInicio ?? 0));
        const gymGanado = Math.max(0, (current.gymVisitCount ?? 0) - (p.gymInicio ?? 0));
        const nivel     = current.nivelJuego ?? 1;
        return { ...p, xpGanado, gymGanado, nivel };
      })
      .sort((a, b) => b.xpGanado - a.xpGanado);
  }, [participantes, stats]);

  const existingUids = useMemo(() => new Set(participantes.map(p => p.uid)), [participantes]);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
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
      const result = await addParticipant(torneoId, targetUid);
      setFeedback(prev => ({ ...prev, [targetUid]: result }));
      if (result === 'ok') {
        setSearchResults(prev => prev.filter(u => u.uid !== targetUid));
      }
    } catch {
      setFeedback(prev => ({ ...prev, [targetUid]: 'error' }));
    }
  }, [torneoId]);

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
      await finalizarTorneo(torneoId, leaderboard);
      setResultModal(true);
    } catch {}
    setFinalizando(false);
  }, [torneoId, leaderboard, finalizando]);

  const renderRow = useCallback(({ item, index }) => {
    const medal = MEDAL[index] ?? null;
    const initials = getInitials(item.nombre, item.apellido);
    const bg = avatarColor(item.uid);
    return (
      <View style={[styles.row, { backgroundColor: colors.surfaceElevated, borderColor: index === 0 ? '#FBBF2440' : colors.border }]}>
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
            <Text style={[styles.gymCount, { color: colors.textSecondary }]}>{item.gymGanado} gym</Text>
          </View>
        </View>
        <Text style={styles.xpGanado}>+{item.xpGanado} XP</Text>
      </View>
    );
  }, [colors, styles]);

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
            {`${item.nombre ?? ''} ${item.apellido ?? ''}`.trim() || item.email}
          </Text>
          <Text style={[styles.searchEmail, { color: colors.textSecondary }]} numberOfLines={1}>{item.email}</Text>
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
                {t.vencido ? 'El torneo terminó' : `${t.texto} · Dura 2 semanas`}
              </Text>
            </View>
          );
        })()}

        {/* Agregar jugador */}
        {isActivo && (
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
        {isCreator && isActivo && leaderboard.length >= 2 && (
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

        {isCreator && (
          <TouchableOpacity style={styles.eliminarBtn} onPress={handleEliminar} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.eliminarText, { color: colors.textTertiary }]}>Eliminar torneo</Text>
          </TouchableOpacity>
        )}
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
      <Modal visible={resultModal} transparent animationType="fade" onRequestClose={() => setResultModal(false)}>
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

      <Modal
        visible={searchModal}
        animationType="slide"
        onRequestClose={() => setSearchModal(false)}
      >
        <SafeAreaView style={[styles.searchScreen, { backgroundColor: colors.background }]} edges={['top']}>
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
                placeholder="Buscar por nombre o email"
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
            ) : searchQuery.trim().length > 0 && !searching ? (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={36} color={colors.textTertiary} />
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>Sin resultados para "{searchQuery}"</Text>
              </View>
            ) : !searchQuery.trim() ? (
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: colors.textTertiary }]}>Escribí un nombre o email para buscar</Text>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
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
    eliminarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    eliminarText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
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
