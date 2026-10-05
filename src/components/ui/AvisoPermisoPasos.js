import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, AppState, Linking } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';
import { startNativeStepService, nativeServiceAvailable } from '../../services/nativeStepService';

// Aviso en Android cuando falta el permiso de "Actividad física". Sin ese
// permiso el contador de pasos no arranca (en Android 14+ ni siquiera el
// servicio) y la app quedaba en 0 sin decir nada: Android pregunta una sola
// vez y, si la persona dijo que no, no vuelve a preguntar. Se revisa al abrir
// y cada vez que la app vuelve al frente (por ejemplo, después de Ajustes).
// En Expo Go no aplica: Expo Go no tiene este permiso y el aviso saldría siempre.
const MOSTRAR = Platform.OS === 'android' && Constants.executionEnvironment !== 'storeClient';

export default function AvisoPermisoPasos() {
  const { theme: { colors } } = useTheme();
  const [permiso, setPermiso] = useState(null); // { granted, canAskAgain }

  const revisar = useCallback(async () => {
    try {
      const r = await Pedometer.getPermissionsAsync();
      setPermiso((antes) => {
        // Recién dado (volvió de Ajustes): arranca el contador.
        if (r.granted && antes && !antes.granted && nativeServiceAvailable) {
          startNativeStepService().catch(() => {});
        }
        return r;
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!MOSTRAR) return;
    revisar();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') revisar(); });
    return () => sub.remove();
  }, [revisar]);

  if (!MOSTRAR || !permiso || permiso.granted) return null;

  const activar = async () => {
    if (permiso.canAskAgain) {
      try {
        const r = await Pedometer.requestPermissionsAsync();
        setPermiso(r);
        if (r.granted && nativeServiceAvailable) startNativeStepService().catch(() => {});
        if (r.granted || r.canAskAgain) return;
      } catch {}
    }
    // Android ya no deja preguntar: hay que darlo desde Ajustes de la app.
    Linking.openSettings().catch(() => {});
  };

  return (
    <View style={[st.card, { backgroundColor: '#F59E0B14', borderColor: '#F59E0B55' }]}>
      <View style={[st.icono, { backgroundColor: '#F59E0B22' }]}>
        <Ionicons name="footsteps" size={20} color="#F59E0B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.titulo, { color: colors.text }]}>Tus pasos no se están contando</Text>
        <Text style={[st.texto, { color: colors.textSecondary }]}>
          {permiso.canAskAgain
            ? 'Falta el permiso de actividad física. Sin él no sumás pasos, puntos ni racha.'
            : 'Activá "Actividad física" en Permisos de la app. Sin eso no sumás pasos, puntos ni racha.'}
        </Text>
        <TouchableOpacity style={[st.boton, { backgroundColor: '#F59E0B' }]} onPress={activar} activeOpacity={0.85}>
          <Text style={st.botonTexto}>{permiso.canAskAgain ? 'Activar permiso' : 'Abrir Ajustes'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card:       { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 16 },
  icono:      { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo:     { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  texto:      { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  boton:      { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  botonTexto: { color: '#111', fontWeight: '800', fontSize: 13 },
});
