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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuth from '../hooks/useAuth';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, authLoading, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleLogin() {
    setLocalError('');
    clearAuthError();
    if (!email.trim()) { setLocalError('Ingresá tu email.'); return; }
    if (!password) { setLocalError('Ingresá tu contraseña.'); return; }
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch {
      // El error queda en authError del contexto
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
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>New Life</Text>
          </View>

          <Text style={styles.title}>Bienvenido de vuelta</Text>
          <Text style={styles.subtitle}>Iniciá sesión para continuar tu progreso.</Text>

          <Field
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="correo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Field
            label="Contraseña"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
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

          {!!displayError && <ErrorBox message={displayError} />}

          <TouchableOpacity
            style={[styles.submitBtn, authLoading && styles.submitLoading]}
            onPress={handleLogin}
            activeOpacity={0.82}
            disabled={authLoading}
          >
            {authLoading
              ? <ActivityIndicator color={colors.textInverse} />
              : <Text style={styles.submitText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => { clearAuthError(); setLocalError(''); navigation.navigate('Register'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              ¿No tenés cuenta?{'  '}
              <Text style={styles.linkAccent}>Registrate</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Componentes internos ─────────────────────────────────────────────────────

// El focused state vive acá adentro: nunca re-renderiza el padre al hacer foco.
function Field({ label, icon, rightSlot, containerStyle, ...inputProps }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        {!!icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.primaryDim : colors.textTertiary}
            style={styles.inputIcon}
          />
        )}
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

function ErrorBox({ message }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

function makeStyles(colors) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['4xl'],
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 48,
  },
  brandDot: {
    width: 10,
    height: 10,
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
    marginBottom: spacing['3xl'],
    lineHeight: 22,
  },
  fieldWrap: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 7,
    letterSpacing: 0.1,
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
  inputIcon: { marginRight: 10 },
  inputText: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text,
    paddingVertical: 14,
  },
  rightSlot: { marginLeft: 8 },
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
    marginBottom: spacing.xl,
  },
  submitLoading: { opacity: 0.7 },
  submitText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
    letterSpacing: 0.3,
  },
  linkRow: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  linkAccent: { color: colors.primary, fontWeight: typography.weights.bold },
}); }
