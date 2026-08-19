import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, radius } from '../../theme';
import useAuth from '../../hooks/useAuth';
import useUserProfile from '../../hooks/useUserProfile';
import { subscribeToAnnouncement } from '../../services/announcementService';
import AnnouncementEditSheet from '../../components/ui/AnnouncementEditSheet';

export default function MisClientesScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');

  const [announcement, setAnnouncement] = useState(null);
  const [annModal, setAnnModal] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then(snap => {
        setAllClients(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => subscribeToAnnouncement(setAnnouncement), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allClients;
    return allClients.filter(c =>
      (c.nombre   ?? '').toLowerCase().includes(q) ||
      (c.apellido ?? '').toLowerCase().includes(q) ||
      (c.email    ?? '').toLowerCase().includes(q) ||
      (c.dni      ?? '').toLowerCase().includes(q),
    );
  }, [allClients, query]);


  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Mis Clientes</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Nombre, apellido, email o DNI…"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Anuncio del Gimnasio */}
      <TouchableOpacity
        style={[styles.misionesCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        onPress={() => setAnnModal(true)}
        activeOpacity={0.8}
      >
        <View style={[styles.misionesIconWrap, { backgroundColor: announcement ? colors.primaryDim12 : colors.surfaceContainer }]}>
          <Ionicons name="megaphone" size={22} color={announcement ? colors.primary : colors.textTertiary} />
        </View>
        <View style={styles.misionesCardContent}>
          <Text style={[styles.misionesCardTitle, { color: colors.text }]}>Anuncio del Gimnasio</Text>
          <Text style={[styles.misionesCardSub, { color: announcement ? colors.primary : colors.textSecondary }]} numberOfLines={1}>
            {announcement ? announcement.title : 'Sin anuncio activo · Toca para crear uno'}
          </Text>
        </View>
        {announcement && (
          <View style={[styles.annDot, { backgroundColor: colors.primary }]} />
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>


      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.uid}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query ? 'Sin resultados' : 'No hay clientes registrados'}
            </Text>
          }
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              colors={colors}
              styles={styles}
              onPress={() => navigation.navigate('ClienteDetail', { cliente: item })}
            />
          )}
        />
      )}

      <AnnouncementEditSheet
        visible={annModal}
        announcement={announcement}
        onClose={() => setAnnModal(false)}
      />
    </SafeAreaView>
  );
}

function ClientRow({ client, colors, styles, onPress }) {
  const initials = (
    (client.nombre?.[0] ?? '') + (client.apellido?.[0] ?? '')
  ).toUpperCase() || '?';

  const photoUri = client.photoBase64
    ? `data:image/jpeg;base64,${client.photoBase64}`
    : null;

  const objetivo = client.objetivo ?? '—';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>
          {client.nombre ?? ''} {client.apellido ?? ''}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {client.email ?? '—'}
        </Text>
        <Text style={styles.rowGoal} numberOfLines={1}>
          {objetivo}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center', justifyContent: 'center',
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.black,
      color: colors.text,
      letterSpacing: -0.3,
    },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      height: 46,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      fontSize: typography.sizes.base,
      color: colors.text,
    },

    misionesCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 0.5,
    },
    misionesIconWrap: {
      width: 42, height: 42, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    misionesCardContent: { flex: 1 },
    misionesCardTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      marginBottom: 2,
    },
    misionesCardSub: { fontSize: typography.sizes.sm },

    list: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
    separator: { height: 1, backgroundColor: colors.borderLight },
    empty: {
      textAlign: 'center',
      color: colors.textTertiary,
      marginTop: 60,
      fontSize: typography.sizes.base,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 14,
    },
    avatar: {
      width: 50, height: 50, borderRadius: 25,
      borderWidth: 2, borderColor: colors.primary,
    },
    avatarFallback: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: colors.primaryDim12,
      borderWidth: 2, borderColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.black,
      color: colors.primary,
    },
    rowInfo: { flex: 1 },
    rowName: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: 2,
    },
    rowSub: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    rowGoal: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },

    annDot: {
      width: 8, height: 8, borderRadius: 4, marginRight: 2,
    },

  });
}