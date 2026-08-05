import { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  TextInput, KeyboardAvoidingView, Platform,
  TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRESETS = [5000, 7500, 10000, 12000, 15000];

export default function GoalModal({ input, onChangeInput, onSave, onClose, colors }) {
  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, damping: 18, stiffness: 280, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 0.92, damping: 18, stiffness: 280, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handleSave = () => {
    const n = parseInt(input.replace(/\D/g, ''), 10);
    if (n >= 1000) onSave(n);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={[st.backdrop, { backgroundColor: 'rgba(0,0,0,0.72)' }]} onPress={dismiss}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.kav}>
          <Pressable onPress={() => {}}>
            <Animated.View
              style={[
                st.card,
                { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight },
                { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
              ]}
            >
              <View style={st.cardHeader}>
                <Text style={[st.cardTitle, { color: colors.text }]}>Meta diaria de pasos</Text>
                <TouchableOpacity onPress={dismiss} hitSlop={10}>
                  <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <View style={[st.inputWrap, { backgroundColor: colors.background, borderColor: colors.primary + '88' }]}>
                <Ionicons name="footsteps-outline" size={18} color={colors.primary} />
                <TextInput
                  style={[st.input, { color: colors.text }]}
                  value={input}
                  onChangeText={onChangeInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                  placeholderTextColor={colors.textTertiary}
                  placeholder="Ej: 10000"
                />
                <Text style={[st.inputUnit, { color: colors.textTertiary }]}>pasos</Text>
              </View>

              <View style={st.presets}>
                {PRESETS.map(p => {
                  const active = String(p) === input;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        st.preset,
                        {
                          backgroundColor: active ? colors.primary : colors.primaryDim12,
                          borderColor:     active ? colors.primary : colors.primary + '44',
                        },
                      ]}
                      onPress={() => onChangeInput(String(p))}
                      activeOpacity={0.75}
                    >
                      <Text style={[st.presetText, { color: active ? colors.textInverse : colors.primary }]}>
                        {p >= 1000 ? `${p / 1000}k` : p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[st.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color={colors.textInverse} />
                <Text style={[st.saveBtnText, { color: colors.textInverse }]}>Guardar meta</Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  kav:      { width: '100%' },
  card: {
    borderRadius: 24, borderWidth: 1,
    padding: 22, gap: 18,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12,
  },
  input: {
    flex: 1, fontSize: 26, fontWeight: '900', letterSpacing: -1,
    padding: 0,
  },
  inputUnit: { fontSize: 13, fontWeight: '700' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1.5,
  },
  presetText: { fontSize: 13, fontWeight: '800' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 99, paddingVertical: 15,
  },
  saveBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});