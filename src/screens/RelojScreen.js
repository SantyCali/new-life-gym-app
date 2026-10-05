import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, ActivityIndicator, AppState, Alert, Linking } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';
import {
  relojDisponible, estadoReloj, conectarReloj, desconectarReloj,
  leerRelojAhora, abrirHealthConnect,
} from '../services/nativeStepService';
import { relojEnSalud, pedirPermisoSalud, openHealthConnectInstall } from '../services/stepService';

const AMBAR = '#F5A623';
const ES_IOS = Platform.OS === 'ios';

function formatoPasos(n) {
  return Number(n || 0).toLocaleString('es-AR');
}

function haceCuanto(ms) {
  if (!ms) return null;
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : 'hace más de un día';
}

// Conectar un reloj o pulsera (Mi Band, Galaxy Watch, Fitbit, Amazfit…) a los
// pasos de la app. El reloj le pasa los pasos a su app, y esa app los deja en:
//  - Android: Health Connect → la app los lee (ver RelojSalud.kt).
//  - iPhone:  Salud → la app ya lee Salud para todo (el Apple Watch entra solo).
export default function RelojScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [estado, setEstado] = useState(null);   // Android: estadoReloj(); iPhone: relojEnSalud()
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const refrescar = useCallback(async () => {
    const e = ES_IOS ? await relojEnSalud() : await estadoReloj();
    setEstado(e);
    setCargando(false);
  }, []);

  // Al entrar, y al volver de la app del reloj / Health Connect / Ajustes.
  useFocusEffect(useCallback(() => {
    if (!ES_IOS) leerRelojAhora();
    refrescar();
    const t = setTimeout(refrescar, 2500);
    return () => clearTimeout(t);
  }, [refrescar]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (!ES_IOS) leerRelojAhora();
      setTimeout(refrescar, 1500);
    });
    return () => sub.remove();
  }, [refrescar]);

  async function conectar() {
    setOcupado(true);
    try {
      if (ES_IOS) {
        await pedirPermisoSalud();
      } else {
        const r = await conectarReloj();
        if (r === 'sin_hc' || r === 'actualizar') {
          Alert.alert(
            r === 'sin_hc' ? 'Falta Health Connect' : 'Actualizá Health Connect',
            'Es la app de Google donde la app de tu reloj deja los pasos. Instalala (o actualizala) desde Play Store y volvé a tocar Conectar.',
            [{ text: 'Cancelar', style: 'cancel' }, { text: 'Abrir Play Store', onPress: openHealthConnectInstall }],
          );
        } else if (r === 'negado') {
          Alert.alert(
            'Sin permiso',
            'Para contar los pasos del reloj, en Health Connect tenés que permitir "Pasos". Podés volver a intentarlo cuando quieras.',
          );
        } else if (r === 'error') {
          Alert.alert('No se pudo conectar', 'Probá de nuevo en un ratito.');
        }
      }
    } finally {
      await refrescar();
      setTimeout(refrescar, 3000);
      setOcupado(false);
    }
  }

  function desconectar() {
    Alert.alert(
      'Desconectar reloj',
      'La app va a contar solo los pasos del celular. Los pasos que ya sumó hoy el reloj no se pierden.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desconectar', style: 'destructive', onPress: async () => { await desconectarReloj(); refrescar(); } },
      ],
    );
  }

  const apps = (estado?.apps ?? []).filter((a) => a !== 'Este celular');
  const listaApps = apps.join(', ');

  // ── Estado de la conexión ──────────────────────────────────────────────────
  let tarjeta;
  if (cargando) {
    tarjeta = <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />;
  } else if (ES_IOS) {
    const llegan = apps.length > 0;
    tarjeta = (
      <Estado
        styles={styles}
        color={llegan ? colors.primary : AMBAR}
        icono={llegan ? 'checkmark-circle' : 'time-outline'}
        titulo={llegan ? 'Salud está recibiendo pasos' : 'Todavía no llegan pasos de un reloj'}
        texto={llegan
          ? `De: ${listaApps}. La app ya los cuenta.`
          : 'Seguí los pasos de abajo. Cuando la app de tu reloj empiece a pasar los pasos a Salud, acá vas a verla.'}
      />
    );
  } else if (!relojDisponible) {
    tarjeta = (
      <Estado styles={styles} color={AMBAR} icono="cloud-download-outline"
        titulo="Actualizá la app" texto="Esta versión todavía no puede leer relojes. Bajá la última desde Play Store." />
    );
  } else if (estado?.hc === 'sin_hc' || estado?.hc === 'actualizar') {
    tarjeta = (
      <Estado styles={styles} color={AMBAR} icono="alert-circle-outline"
        titulo={estado.hc === 'sin_hc' ? 'Falta Health Connect' : 'Actualizá Health Connect'}
        texto="Es la app de Google donde la app de tu reloj deja los pasos. Instalala desde Play Store y volvé." />
    );
  } else if (estado?.activa && estado?.permiso) {
    const ultima = haceCuanto(estado.ultimaLectura);
    const sinFondo = estado.fondoDisponible && !estado.fondo;
    tarjeta = (
      <>
        <Estado
          styles={styles}
          color={apps.length ? colors.primary : AMBAR}
          icono={apps.length ? 'checkmark-circle' : 'time-outline'}
          titulo={apps.length ? 'Reloj conectado' : 'Conectado, esperando pasos'}
          texto={apps.length
            ? `Recibiendo pasos de: ${listaApps}.${estado.pasosHoy > 0 ? ` Hoy: ${formatoPasos(estado.pasosHoy)} pasos.` : ''}${ultima ? ` Última lectura: ${ultima}.` : ''}`
            : 'Todavía no llegaron pasos de ningún reloj. Revisá el paso 2 y abrí la app del reloj para que se sincronice.'}
        />
        {sinFondo && (
          <Estado styles={styles} color={AMBAR} icono="moon-outline"
            titulo="Falta un permiso"
            texto='Para leer el reloj con la app cerrada, tocá "Conectar de nuevo" y activá "Acceder a los datos en segundo plano".' />
        )}
      </>
    );
  } else {
    tarjeta = (
      <Estado styles={styles} color={colors.textTertiary} icono="watch-outline"
        titulo="Sin conectar" texto="Ahora la app cuenta solo los pasos del celular." />
    );
  }

  const conectada = ES_IOS ? apps.length > 0 : (estado?.activa && estado?.permiso);
  const pasos = ES_IOS
    ? [
        'Abrí la app de tu reloj (Mi Fitness, Zepp, Garmin Connect…) y vinculá el reloj, si no lo hiciste.',
        'En esa app, buscá en Configuración la opción "Apple Salud" (o "Salud") y activala. Permití que escriba Pasos.',
        'Tocá "Revisar conexión". Si New Life nunca te pidió permiso de Salud, te lo pide ahora: permití Pasos.',
      ]
    : [
        'Abrí la app de tu reloj (Mi Fitness, Samsung Health, Fitbit, Zepp…) y vinculá el reloj, si no lo hiciste.',
        'En esa app, buscá en Configuración la opción "Health Connect" y activala. Permití que escriba Pasos.',
        'Volvé acá y tocá "Conectar reloj". En Health Connect, permití Pasos y el acceso en segundo plano.',
      ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reloj o pulsera</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="watch-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Contá los pasos de tu reloj</Text>
          <Text style={styles.heroSub}>
            Mi Band, Galaxy Watch, Fitbit, Amazfit y la mayoría de las marcas. Si caminás sin el celular, la app usa los pasos del reloj. Si llevás los dos, cuenta el que tenga más (no se suman).
          </Text>
        </View>

        {tarjeta}

        <Text style={styles.sectionLabel}>CÓMO CONECTARLO</Text>
        <View style={styles.card}>
          {pasos.map((t, i) => (
            <View key={i} style={[styles.paso, i > 0 && styles.pasoBorde]}>
              <View style={styles.pasoNum}><Text style={styles.pasoNumText}>{i + 1}</Text></View>
              <Text style={styles.pasoText}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.hint}>
          {ES_IOS
            ? '¿Tenés Apple Watch? No hace falta conectarlo acá: sus pasos ya entran solos por Salud.'
            : 'Los relojes Huawei y Honor no pasan los pasos a Health Connect, así que con esos no se puede.'}
        </Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {(!ES_IOS && !relojDisponible) ? null : (
            <Boton
              styles={styles}
              principal
              cargando={ocupado}
              icono={conectada ? 'refresh' : 'link'}
              texto={ES_IOS ? 'Revisar conexión' : conectada ? 'Conectar de nuevo' : 'Conectar reloj'}
              onPress={conectar}
              colors={colors}
            />
          )}
          {ES_IOS && !conectada && (
            <Boton styles={styles} icono="heart-outline" texto="Abrir Salud" colors={colors}
              onPress={() => Linking.openURL('x-apple-health://').catch(() => Linking.openSettings())} />
          )}
          {!ES_IOS && relojDisponible && estado?.hc === 'ok' && (
            <Boton styles={styles} icono="open-outline" texto="Abrir Health Connect" colors={colors}
              onPress={abrirHealthConnect} />
          )}
          {!ES_IOS && (estado?.hc === 'sin_hc' || estado?.hc === 'actualizar') && (
            <Boton styles={styles} icono="logo-google-playstore" texto="Instalar Health Connect" colors={colors}
              onPress={openHealthConnectInstall} />
          )}
          {!ES_IOS && estado?.activa && (
            <Boton styles={styles} peligro icono="unlink-outline" texto="Desconectar" colors={colors}
              onPress={desconectar} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Estado({ styles, color, icono, titulo, texto }) {
  return (
    <View style={[styles.estado, { borderColor: color + '55' }]}>
      <Ionicons name={icono} size={22} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.estadoTitulo, { color }]}>{titulo}</Text>
        <Text style={styles.estadoTexto}>{texto}</Text>
      </View>
    </View>
  );
}

function Boton({ styles, colors, principal, peligro, cargando, icono, texto, onPress }) {
  const color = principal ? colors.textOnPrimary : peligro ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      style={[styles.boton, principal && { backgroundColor: colors.primary }, peligro && { borderColor: colors.danger + '55' }]}
      onPress={onPress}
      disabled={cargando}
      activeOpacity={0.8}
    >
      {cargando
        ? <ActivityIndicator size="small" color={color} />
        : <><Ionicons name={icono} size={18} color={color} /><Text style={[styles.botonText, { color }]}>{texto}</Text></>}
    </TouchableOpacity>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...typography.h3, color: colors.text },
    content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
    hero: { alignItems: 'center', marginBottom: spacing.lg },
    heroIcon: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + '22',
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    },
    heroTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
    heroSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: spacing.xs },
    estado: {
      flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, marginBottom: spacing.md,
    },
    estadoTitulo: { ...typography.body, fontWeight: '700' },
    estadoTexto: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
    sectionLabel: {
      ...typography.caption, color: colors.textTertiary, letterSpacing: 1,
      marginTop: spacing.md, marginBottom: spacing.sm,
    },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
    paso: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, alignItems: 'flex-start' },
    pasoBorde: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    pasoNum: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary + '22',
      alignItems: 'center', justifyContent: 'center',
    },
    pasoNumText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
    pasoText: { ...typography.body, color: colors.text, flex: 1, lineHeight: 21 },
    hint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm, lineHeight: 18 },
    boton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      borderRadius: radius.lg, paddingVertical: spacing.md,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    botonText: { ...typography.body, fontWeight: '700' },
  });
}
