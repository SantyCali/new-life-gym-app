import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, AppState, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';
import { getRegistroPasos } from '../../services/nativeStepService';

// Aviso en Android cuando la batería de la app tiene restricciones. Con
// restricciones, si Android cierra la app el contador de pasos se para y no
// lo dejan volver solo (ver modules/GuardiaPasos.kt): al otro día, 0 pasos
// hasta abrir la app. Si además se paró en las últimas 24 h, lo dice.
// Se revisa al abrir y cada vez que la app vuelve al frente: apenas la persona
// cambia la batería a "Sin restricciones", el aviso se va solo.
// Necesita la build con GuardiaPasos (antes, getRegistroPasos da null y no sale).
const MOSTRAR = Platform.OS === 'android' && Constants.executionEnvironment !== 'storeClient';
const DIA_MS = 24 * 60 * 60 * 1000;

// ¿El registro dice que en las últimas 24 h se paró una hora o más, o que
// Android no lo dejó volver a arrancar?
function seParoHace24h(eventos = []) {
  const desde = Date.now() - DIA_MS;
  return eventos.some((e) => {
    // "2026-10-07 13:42 …" → hora local del celular.
    const t = new Date(`${String(e).slice(0, 16).replace(' ', 'T')}:00`).getTime();
    if (!(t >= desde)) return false;
    return /no_pudo_arrancar/.test(e) || /parado \d+ h/.test(e);
  });
}

export default function AvisoBateria() {
  const { theme: { colors } } = useTheme();
  const [estado, setEstado] = useState(null);   // { restringida, seParo }

  const revisar = useCallback(async () => {
    const r = await getRegistroPasos();
    if (!r) { setEstado(null); return; }
    setEstado({ restringida: !r.bateriaSinRestricciones, seParo: seParoHace24h(r.eventos) });
  }, []);

  useEffect(() => {
    if (!MOSTRAR) return;
    revisar();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setTimeout(revisar, 500); });
    return () => sub.remove();
  }, [revisar]);

  if (!MOSTRAR || !estado?.restringida) return null;

  return (
    <View style={[st.card, { backgroundColor: '#FF9F1A14', borderColor: '#FF9F1A55' }]}>
      <View style={[st.icono, { backgroundColor: '#FF9F1A22' }]}>
        <Ionicons name="battery-charging" size={20} color="#FF9F1A" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[st.titulo, { color: colors.text }]}>
          {estado.seParo ? 'Tus pasos dejaron de contarse' : 'Que tus pasos se cuenten siempre'}
        </Text>
        <Text style={[st.texto, { color: colors.textSecondary }]}>
          {estado.seParo
            ? 'El celular cerró New Life y dejó de contar. Para que no pase más: tocá el botón, entrá a "Batería" y elegí "Sin restricciones".'
            : 'Para que New Life cuente tus pasos con la app cerrada: tocá el botón, entrá a "Batería" y elegí "Sin restricciones".'}
        </Text>
        <TouchableOpacity
          style={[st.boton, { backgroundColor: '#FF9F1A' }]}
          onPress={() => Linking.openSettings().catch(() => {})}
          activeOpacity={0.85}
        >
          <Text style={st.botonTexto}>Abrir Ajustes de la app</Text>
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
