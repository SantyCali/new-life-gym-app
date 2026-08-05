import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import useAuth from '../hooks/useAuth';
import useUserProfile from '../hooks/useUserProfile';
import {
  saveBodyMeasurements,
  kgToLb,
  lbToKg,
} from '../services/bodyMeasurementsService';
import { addBodyWeightRecord } from '../services/progressService';

// ── Rangos ────────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const PESOS_KG = Array.from({ length: 226 }, (_, i) => 25 + i);   // 25–250
const PESOS_LB = Array.from({ length: 496 }, (_, i) => 55 + i);   // 55–550
const ALTURAS  = Array.from({ length: 121 }, (_, i) => 120 + i);  // 120–240
const MIN_DATE = new Date(1920, 0, 1);
const MAX_DATE = new Date();

const PICKER_HEIGHT = Platform.OS === 'ios' ? 220 : 180;
const WHEEL_ITEM_H  = 52;

// ── Helpers fecha ─────────────────────────────────────────────────────────────
function dateToFecha(date) {
  if (!date || isNaN(date.getTime())) return null;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function fechaToDate(fecha) {
  if (!fecha) return new Date(CURRENT_YEAR - 25, 0, 1);
  const parts = fecha.split('/');
  if (parts.length !== 3) return new Date(CURRENT_YEAR - 25, 0, 1);
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return new Date(CURRENT_YEAR - 25, 0, 1);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? new Date(CURRENT_YEAR - 25, 0, 1) : date;
}

function clamp(val, arr) {
  return arr.includes(val) ? val : arr[0];
}

// ── WheelPicker (Android) ─────────────────────────────────────────────────────
function WheelPicker({ items, selectedValue, onValueChange, style }) {
  const { theme: { colors } } = useTheme();
  const scrollRef = useRef(null);

  const [currentIdx, setCurrentIdx] = useState(() => {
    const idx = items.findIndex(i => (i.value ?? i) === selectedValue);
    return Math.max(0, idx);
  });

  useEffect(() => {
    const idx = items.findIndex(i => (i.value ?? i) === selectedValue);
    const safeIdx = Math.max(0, idx);
    setCurrentIdx(safeIdx);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: safeIdx * WHEEL_ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = useCallback((e) => {
    const raw = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(Math.round(raw / WHEEL_ITEM_H), items.length - 1));
    setCurrentIdx(idx);
    const item = items[idx];
    onValueChange(item?.value ?? item);
  }, [items, onValueChange]);

  return (
    <View style={[{ height: WHEEL_ITEM_H * 5, overflow: 'hidden' }, style]}>
      {/* Highlight lines around the selected row */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: WHEEL_ITEM_H * 2,
          height: WHEEL_ITEM_H,
          left: 0,
          right: 0,
          borderTopWidth: StyleSheet.hairlineWidth * 2,
          borderBottomWidth: StyleSheet.hairlineWidth * 2,
          borderColor: colors.primary,
          opacity: 0.65,
          zIndex: 2,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * 2 }}
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
      >
        {items.map((item, i) => {
          const lbl = item.label ?? String(item);
          const isCenter = i === currentIdx;
          return (
            <View
              key={i}
              style={{ height: WHEEL_ITEM_H, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text
                style={{
                  color:      isCenter ? colors.text : colors.textTertiary,
                  fontSize:   isCenter ? 22 : 18,
                  fontWeight: isCenter ? '700' : '400',
                }}
              >
                {lbl}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function BodyMeasurementsScreen({ navigation }) {
  const { theme: { colors } } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const insets             = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const { profile }        = useUserProfile();

  // ── Committed values ───────────────────────────────────────────────────────
  const [sexo,       setSexo]       = useState('masculino');
  const [fechaDate,  setFechaDate]  = useState(new Date(CURRENT_YEAR - 25, 0, 1));
  const [peso,       setPeso]       = useState(70);
  const [pesoUnidad, setPesoUnidad] = useState('kg');
  const [altura,     setAltura]     = useState(170);
  const [loaded,     setLoaded]     = useState(false);

  // ── Picker temp values ─────────────────────────────────────────────────────
  const [activePicker,   setActivePicker]   = useState(null);
  const [tempSexo,       setTempSexo]       = useState('masculino');
  const [tempFecha,      setTempFecha]      = useState(new Date(CURRENT_YEAR - 25, 0, 1));
  const [tempPeso,       setTempPeso]       = useState(70);
  const [tempPesoUnidad, setTempPesoUnidad] = useState('kg');
  const [tempAltura,     setTempAltura]     = useState(170);

  const [showAndroidDate, setShowAndroidDate] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load from Firestore ────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile || loaded) return;
    if (profile.sexo)       setSexo(profile.sexo);
    setFechaDate(fechaToDate(profile.fechaNacimiento));
    if (profile.peso)       setPeso(profile.peso);
    if (profile.pesoUnidad) setPesoUnidad(profile.pesoUnidad);
    if (profile.altura)     setAltura(profile.altura);
    setLoaded(true);
  }, [profile, loaded]);

  // ── Computed display ───────────────────────────────────────────────────────
  const sexoLabel    = sexo === 'masculino' ? 'Masculino' : 'Femenino';
  const fechaDisplay = dateToFecha(fechaDate) ?? '--';
  const pesoDisplay  = pesoUnidad === 'lb' ? `${kgToLb(peso)} lb` : `${peso} kg`;

  // ── Open picker ────────────────────────────────────────────────────────────
  const handleRowPress = useCallback((field) => {
    if (Platform.OS === 'android' && field === 'fecha') {
      setTempFecha(new Date(fechaDate.getTime()));
      setShowAndroidDate(true);
      return;
    }
    if (field === 'sexo')   setTempSexo(sexo);
    if (field === 'fecha')  setTempFecha(new Date(fechaDate.getTime()));
    if (field === 'peso') {
      setTempPesoUnidad(pesoUnidad);
      setTempPeso(pesoUnidad === 'lb' ? kgToLb(peso) : peso);
    }
    if (field === 'altura') setTempAltura(altura);
    setActivePicker(field);
  }, [sexo, fechaDate, peso, pesoUnidad, altura]);

  const cancelPicker = useCallback(() => setActivePicker(null), []);

  // ── Confirm picker ─────────────────────────────────────────────────────────
  const confirmPicker = useCallback(async () => {
    if (!authUser?.uid) return;
    setSaving(true);
    try {
      const updates = {};
      if (activePicker === 'sexo') {
        setSexo(tempSexo);
        updates.sexo = tempSexo;
      }
      if (activePicker === 'fecha') {
        setFechaDate(tempFecha);
        const str = dateToFecha(tempFecha);
        if (str) updates.fechaNacimiento = str;
      }
      let pesoKgToRecord = null;
      if (activePicker === 'peso') {
        const kg = tempPesoUnidad === 'lb' ? lbToKg(tempPeso) : tempPeso;
        setPeso(kg);
        setPesoUnidad(tempPesoUnidad);
        updates.peso       = kg;
        updates.pesoUnidad = tempPesoUnidad;
        pesoKgToRecord     = kg;
      }
      if (activePicker === 'altura') {
        setAltura(tempAltura);
        updates.altura = tempAltura;
      }
      await saveBodyMeasurements(authUser.uid, updates);
      if (pesoKgToRecord) addBodyWeightRecord(authUser.uid, pesoKgToRecord);
    } finally {
      setSaving(false);
      setActivePicker(null);
    }
  }, [activePicker, authUser, tempSexo, tempFecha, tempPeso, tempPesoUnidad, tempAltura]);

  const handleUnitChange = useCallback((newUnit) => {
    if (newUnit === tempPesoUnidad) return;
    const converted = newUnit === 'lb' ? kgToLb(tempPeso) : lbToKg(tempPeso);
    setTempPeso(clamp(converted, newUnit === 'lb' ? PESOS_LB : PESOS_KG));
    setTempPesoUnidad(newUnit);
  }, [tempPeso, tempPesoUnidad]);

  // ── Row list ───────────────────────────────────────────────────────────────
  const rows = [
    { field: 'sexo',   emoji: '🚶',  label: 'Sexo',               value: sexoLabel      },
    { field: 'fecha',  emoji: '🎂',  label: 'Fecha de nacimiento', value: fechaDisplay   },
    { field: 'peso',   emoji: '⚖️', label: 'Peso',               value: pesoDisplay    },
    { field: 'altura', emoji: '🧍', label: 'Talla corporal',     value: `${altura} cm` },
  ];

  const pickerTitle = {
    sexo:   'Sexo',
    fecha:  'Fecha de nacimiento',
    peso:   'Peso',
    altura: 'Talla corporal',
  };

  // ── iOS picker content ────────────────────────────────────────────────────
  function renderIOSContent() {
    if (activePicker === 'fecha') {
      return (
        <DateTimePicker
          value={tempFecha}
          mode="date"
          display="spinner"
          onChange={(e, date) => date && setTempFecha(date)}
          maximumDate={MAX_DATE}
          minimumDate={MIN_DATE}
          locale="es-AR"
          themeVariant="dark"
          textColor={colors.text}
          style={{ height: PICKER_HEIGHT }}
        />
      );
    }
    if (activePicker === 'sexo') {
      return (
        <Picker
          selectedValue={tempSexo}
          onValueChange={setTempSexo}
          style={[styles.picker, { height: PICKER_HEIGHT }]}
          itemStyle={styles.pickerItem}
          themeVariant="dark"
        >
          <Picker.Item label="Masculino" value="masculino" />
          <Picker.Item label="Femenino"  value="femenino"  />
        </Picker>
      );
    }
    if (activePicker === 'peso') {
      const range = tempPesoUnidad === 'lb' ? PESOS_LB : PESOS_KG;
      return (
        <View style={styles.doublePicker}>
          <Picker
            key={`ios-peso-${tempPesoUnidad}`}
            selectedValue={tempPeso}
            onValueChange={setTempPeso}
            style={[styles.picker, { flex: 3, height: PICKER_HEIGHT }]}
            itemStyle={styles.pickerItem}
            themeVariant="dark"
          >
            {range.map(v => <Picker.Item key={v} label={String(v)} value={v} />)}
          </Picker>
          <Picker
            selectedValue={tempPesoUnidad}
            onValueChange={handleUnitChange}
            style={[styles.picker, { flex: 1, height: PICKER_HEIGHT }]}
            itemStyle={styles.pickerItem}
            themeVariant="dark"
          >
            <Picker.Item label="kg" value="kg" />
            <Picker.Item label="lb" value="lb" />
          </Picker>
        </View>
      );
    }
    if (activePicker === 'altura') {
      return (
        <View style={styles.doublePicker}>
          <Picker
            selectedValue={tempAltura}
            onValueChange={setTempAltura}
            style={[styles.picker, { flex: 3, height: PICKER_HEIGHT }]}
            itemStyle={styles.pickerItem}
            themeVariant="dark"
          >
            {ALTURAS.map(v => <Picker.Item key={v} label={String(v)} value={v} />)}
          </Picker>
          <Picker
            selectedValue="cm"
            style={[styles.picker, { flex: 1, height: PICKER_HEIGHT }]}
            itemStyle={styles.pickerItem}
            themeVariant="dark"
            enabled={false}
          >
            <Picker.Item label="cm" value="cm" />
          </Picker>
        </View>
      );
    }
    return null;
  }

  // ── Android picker content ─────────────────────────────────────────────────
  function renderAndroidContent() {
    if (activePicker === 'sexo') {
      return (
        <WheelPicker
          items={[
            { label: 'Masculino', value: 'masculino' },
            { label: 'Femenino',  value: 'femenino'  },
          ]}
          selectedValue={tempSexo}
          onValueChange={setTempSexo}
        />
      );
    }
    if (activePicker === 'peso') {
      const range = tempPesoUnidad === 'lb' ? PESOS_LB : PESOS_KG;
      return (
        <View style={styles.doublePicker}>
          <WheelPicker
            key={`android-peso-${tempPesoUnidad}`}
            items={range}
            selectedValue={tempPeso}
            onValueChange={setTempPeso}
            style={{ flex: 3 }}
          />
          <WheelPicker
            items={[
              { label: 'kg', value: 'kg' },
              { label: 'lb', value: 'lb' },
            ]}
            selectedValue={tempPesoUnidad}
            onValueChange={handleUnitChange}
            style={{ flex: 1 }}
          />
        </View>
      );
    }
    if (activePicker === 'altura') {
      return (
        <View style={styles.doublePicker}>
          <WheelPicker
            items={ALTURAS}
            selectedValue={tempAltura}
            onValueChange={setTempAltura}
            style={{ flex: 3 }}
          />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>cm</Text>
          </View>
        </View>
      );
    }
    return null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medidas corporales</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Card con filas */}
      <View style={styles.card}>
        {rows.map((row, idx) => (
          <React.Fragment key={row.field}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleRowPress(row.field)}
              activeOpacity={0.6}
            >
              <Text style={styles.rowEmoji}>{row.emoji}</Text>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            {idx < rows.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))}
      </View>

      <Text style={styles.note}>
        La edad se calcula automáticamente a partir de tu fecha de nacimiento.{'\n'}
        Los datos se guardan automáticamente en la nube.
      </Text>

      {/* Android native date picker */}
      {Platform.OS === 'android' && showAndroidDate && (
        <DateTimePicker
          value={tempFecha}
          mode="date"
          display="spinner"
          onChange={(event, date) => {
            setShowAndroidDate(false);
            if (event.type === 'set' && date && authUser?.uid) {
              setFechaDate(date);
              const str = dateToFecha(date);
              if (str) saveBodyMeasurements(authUser.uid, { fechaNacimiento: str });
            }
          }}
          maximumDate={MAX_DATE}
          minimumDate={MIN_DATE}
        />
      )}

      {/* Bottom-sheet picker modal */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={cancelPicker}
      >
        <View style={styles.modalWrapper}>
          <Pressable style={styles.backdrop} onPress={cancelPicker} />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {/* Toolbar */}
            <View style={styles.toolbar}>
              <TouchableOpacity onPress={cancelPicker} style={styles.toolbarBtn}>
                <Text style={styles.toolbarCancel}>Cancelar</Text>
              </TouchableOpacity>

              <Text style={styles.toolbarTitle}>
                {pickerTitle[activePicker] ?? ''}
              </Text>

              <TouchableOpacity onPress={confirmPicker} style={styles.toolbarBtn} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={styles.toolbarDone}>Listo</Text>
                }
              </TouchableOpacity>
            </View>

            <View style={styles.toolbarDivider} />

            {Platform.OS === 'ios' ? renderIOSContent() : renderAndroidContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(colors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    color: colors.text,
  },
  card: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowEmoji: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  rowValue: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 30 + spacing.md + spacing.lg,
  },
  note: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    fontSize: typography.sizes.xs,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayMedium,
  },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  toolbarBtn: {
    minWidth: 70,
    paddingVertical: 6,
  },
  toolbarCancel: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  toolbarTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  toolbarDone: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'right',
  },
  toolbarDivider: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  picker: {
    color: colors.text,
    backgroundColor: 'transparent',
  },
  pickerItem: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
  },
  doublePicker: {
    flexDirection: 'row',
  },
}); }
