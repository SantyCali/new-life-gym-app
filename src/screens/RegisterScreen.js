import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import useAuth from '../hooks/useAuth';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';


const OBJETIVOS = [
  { id: 'bajar_grasa',   label: 'Bajar grasa'   },
  { id: 'ganar_musculo', label: 'Ganar músculo'  },
  { id: 'mantener',      label: 'Mantener'       },
];

const NIVELES = [
  { id: 'principiante', label: 'Principiante' },
  { id: 'intermedio',   label: 'Intermedio'   },
  { id: 'avanzado',     label: 'Avanzado'     },
];

const SEXOS = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino',  label: 'Femenino'  },
];

function formatFecha(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function RegisterScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signUp, authLoading, authError, clearAuthError } = useAuth();

  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '',
    password: '', confirmPassword: '',
    dni: '', fechaNacimiento: '',
    sexo: '', peso: '', altura: '',
    objetivo: '', nivel: '',
  });
  const [photo, setPhoto]               = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [localError,   setLocalError]   = useState('');

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setLocalError('Se necesitan permisos para acceder a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  function validate() {
    if (!form.nombre.trim())          return 'El nombre es requerido.';
    if (!form.apellido.trim())        return 'El apellido es requerido.';
    if (!form.dni.trim())             return 'El DNI es requerido.';
    if (!form.fechaNacimiento.trim()) return 'La fecha de nacimiento es requerida.';
    if (!form.sexo)                   return 'Seleccioná un sexo.';
    if (!form.email.trim())           return 'El email es requerido.';
    if (!form.password)               return 'La contraseña es requerida.';
    if (form.password.length < 6)     return 'La contraseña debe tener al menos 6 caracteres.';
    if (form.password !== form.confirmPassword) return 'Las contraseñas no coinciden.';
    if (!form.peso   || isNaN(+form.peso))   return 'El peso debe ser un número.';
    if (!form.altura || isNaN(+form.altura)) return 'La altura debe ser un número.';
    if (!form.objetivo)               return 'Seleccioná un objetivo.';
    if (!form.nivel)                  return 'Seleccioná tu nivel de experiencia.';
    return null;
  }

  async function handleRegister() {
    clearAuthError();
    const err = validate();
    if (err) { setLocalError(err); return; }
    setLocalError('');
    try {
      await signUp(form.email.trim().toLowerCase(), form.password, {
        nombre:          form.nombre.trim(),
        apellido:        form.apellido.trim(),
        dni:             form.dni.trim(),
        fechaNacimiento: form.fechaNacimiento.trim(),
        sexo:            form.sexo,
        peso:            Number(form.peso),
        altura:          Number(form.altura),
        objetivo:        form.objetivo,
        nivelFitness:    form.nivel,
        photoBase64:     photo?.base64 ?? null,
      });
    } catch {
      // error en authError del contexto
    }
  }

  const displayError = localError || authError;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { clearAuthError(); setLocalError(''); navigation.goBack(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>New Life</Text>
          </View>

          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Completá tus datos para empezar.</Text>

          {/* ── Foto de perfil ── */}
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} activeOpacity={0.75}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={28} color={colors.primary} />
                  <Text style={styles.photoLabel}>Agregar foto</Text>
                  <Text style={styles.photoOptional}>opcional</Text>
                </>
              )}
            </TouchableOpacity>
            {photo && (
              <TouchableOpacity onPress={() => setPhoto(null)} style={styles.photoRemoveBtn}>
                <Text style={styles.photoRemoveText}>Quitar foto</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Datos personales ── */}
          <SectionLabel>Datos personales</SectionLabel>
          <View style={styles.row}>
            <Field
              label="Nombre"
              containerStyle={styles.flex1}
              value={form.nombre}
              onChangeText={(v) => set('nombre', v)}
              placeholder="Juan"
              autoCapitalize="words"
              returnKeyType="next"
            />
            <View style={styles.gap} />
            <Field
              label="Apellido"
              containerStyle={styles.flex1}
              value={form.apellido}
              onChangeText={(v) => set('apellido', v)}
              placeholder="García"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
          <Field
            label="DNI"
            value={form.dni}
            onChangeText={(v) => set('dni', v.replace(/\D/g, '').slice(0, 8))}
            placeholder="12345678"
            keyboardType="numeric"
            maxLength={8}
            returnKeyType="next"
          />
          <Field
            label="Fecha de nacimiento"
            value={form.fechaNacimiento}
            onChangeText={(v) => set('fechaNacimiento', formatFecha(v))}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            maxLength={10}
            returnKeyType="next"
          />

          {/* Sexo */}
          <Text style={styles.sectionLabel}>Sexo</Text>
          <View style={[styles.chipRow, { marginBottom: spacing.lg }]}>
            {SEXOS.map((s) => {
              const active = form.sexo === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => set('sexo', s.id)}
                  activeOpacity={0.72}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Acceso ── */}
          <SectionLabel>Acceso</SectionLabel>
          <Field
            label="Email"
            value={form.email}
            onChangeText={(v) => set('email', v)}
            placeholder="correo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Field
            label="Contraseña"
            value={form.password}
            onChangeText={(v) => set('password', v)}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="next"
            rightSlot={
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            }
          />
          <Field
            label="Confirmá la contraseña"
            value={form.confirmPassword}
            onChangeText={(v) => set('confirmPassword', v)}
            placeholder="Repetí la contraseña"
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            returnKeyType="done"
            rightSlot={
              <TouchableOpacity
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            }
          />

          {/* ── Físico ── */}
          <SectionLabel>Físico</SectionLabel>
          <View style={styles.row}>
            <Field
              label="Peso (kg)"
              containerStyle={styles.flex1}
              value={form.peso}
              onChangeText={(v) => set('peso', v)}
              placeholder="70"
              keyboardType="decimal-pad"
              maxLength={5}
              returnKeyType="next"
            />
            <View style={styles.gap} />
            <Field
              label="Altura (cm)"
              containerStyle={styles.flex1}
              value={form.altura}
              onChangeText={(v) => set('altura', v)}
              placeholder="170"
              keyboardType="numeric"
              maxLength={3}
              returnKeyType="done"
            />
          </View>

          {/* ── Objetivo ── */}
          <SectionLabel>Objetivo principal</SectionLabel>
          <View style={styles.chipRow}>
            {OBJETIVOS.map((obj) => {
              const active = form.objetivo === obj.id;
              return (
                <TouchableOpacity
                  key={obj.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => set('objetivo', obj.id)}
                  activeOpacity={0.72}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {obj.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Nivel ── */}
          <SectionLabel>Nivel de experiencia</SectionLabel>
          <View style={styles.chipRow}>
            {NIVELES.map((nv) => {
              const active = form.nivel === nv.id;
              return (
                <TouchableOpacity
                  key={nv.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => set('nivel', nv.id)}
                  activeOpacity={0.72}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {nv.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Error ── */}
          {!!displayError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[styles.submitBtn, authLoading && styles.submitLoading]}
            onPress={handleRegister}
            activeOpacity={0.82}
            disabled={authLoading}
          >
            {authLoading
              ? <ActivityIndicator color={colors.textInverse} />
              : <Text style={styles.submitText}>Crear cuenta</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => { clearAuthError(); setLocalError(''); navigation.goBack(); }}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              ¿Ya tenés cuenta?{'  '}
              <Text style={styles.linkAccent}>Iniciá sesión</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Componentes internos ─────────────────────────────────────────────────────

function SectionLabel({ children }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Field({ label, rightSlot, containerStyle, ...inputProps }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <TextInput
          style={styles.inputText}
          placeholderTextColor={colors.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {!!rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
      </View>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(colors) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  kav:  { flex: 1 },
  scroll: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  brandDot: {
    width: 10, height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  brandName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.black,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    marginBottom: spacing['2xl'],
    lineHeight: 22,
  },

  // Foto
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  photoPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 2,
    borderColor: colors.primaryDim,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  photoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  photoLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: 4,
  },
  photoOptional: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  photoRemoveBtn: {
    marginTop: 10,
  },
  photoRemoveText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    fontWeight: typography.weights.semibold,
  },

  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textTertiary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  row:   { flexDirection: 'row' },
  flex1: { flex: 1 },
  gap:   { width: spacing.sm },
  fieldWrap: { marginBottom: spacing.md },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 7,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputBoxFocused: {
    borderColor: colors.primaryDim,
    backgroundColor: colors.surfaceContainerHigh,
  },
  inputText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text,
    paddingVertical: 14,
  },
  rightSlot: { marginLeft: 8 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryDim12,
    borderColor: colors.primaryDim,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.primary },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.danger,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  submitLoading: { opacity: 0.7 },
  submitText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  linkRow: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  linkAccent: { color: colors.primary, fontWeight: typography.weights.bold },
}); }
