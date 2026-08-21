/**
 * PremiumTabBar — Custom animated bottom navigation.
 *
 * Unified iOS + Android — single code path, no Platform.select for behavior.
 *
 * COLOR REACTIVITY
 * ─────────────────
 * useAnimatedProps worklets only re-run when a referenced SharedValue changes.
 * Plain JS closure strings (colors.primary) captured at render time become
 * stale after a theme switch unless position also moves. Fix: store colors in
 * SharedValues and update them via useEffect. Direct SharedValue assignment
 * triggers a synchronous UI-thread re-run so icons update immediately.
 *
 * GESTURE COEXISTENCE ON iOS
 * ───────────────────────────
 * RN Pressable uses the native UIGestureRecognizer system, which is exclusive
 * on iOS: the first recognizer to activate consumes the touch, blocking the
 * parent RNGH Pan gesture from ever starting.
 * Fix: use Gesture.Tap() inside a nested GestureDetector. Both the outer Pan
 * and inner Tap live in the RNGH recognizer tree, which uses a cooperative
 * model that lets hold-then-drag work identically on iOS and Android.
 *
 * API MODERNISATION
 * ─────────────────
 * • TouchableOpacity from RNGH → deprecated → Gesture.Tap() + GestureDetector
 * • runOnJS → deprecated in Reanimated v4; JS functions can be called directly
 *   from worklets — the runtime handles thread bridging automatically.
 */

import { useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

const { width: SW } = Dimensions.get('window');
const N     = 4;
const TAB_W = SW / N;
const IND_W = 44;
const IND_H = 3;

const SPRING = {
  damping:           26,
  stiffness:         320,
  mass:              0.55,
  overshootClamping: false,
};

const ICON = {
  Inicio: { filled: 'home',    outline: 'home-outline'    },
  Rutina: { filled: 'barbell', outline: 'barbell-outline' },
  Retos:  { filled: 'medal',   outline: 'medal-outline'   },
  Perfil: { filled: 'person',  outline: 'person-outline'  },
};

// ── Single tab button ─────────────────────────────────────────────────────────
function TabItem({ route, index, position, indScale, onPress }) {
  const meta = ICON[route.name] ?? { filled: 'ellipse', outline: 'ellipse-outline' };
  const { theme: { colors } } = useTheme();

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(
        Math.abs(position.value - index),
        [0, 1], [1.07, 0.93],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  // Opacity cross-fade between accent and gray icons.
  // Ionicons is a JS/SVG component — animating its `color` prop via
  // useAnimatedProps doesn't work reliably. Opacity animation on a wrapper
  // View is fully native and works identically on iOS and Android.
  const activeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.value - index), [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const inactiveOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.value - index), [0, 0.5], [0, 1], Extrapolation.CLAMP),
  }));

  // Animations run directly on UI thread — no JS-thread round-trip before visual feedback.
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet';
      indScale.value = withSequence(
        withTiming(0, { duration: 55,  easing: Easing.out(Easing.quad)  }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
      );
      position.value = withSpring(index, SPRING);
      runOnJS(onPress)();
    });

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={st.tabBtn}>
        <Animated.View style={scaleStyle}>
          <View style={[st.iconBox, st.center]}>
            <Animated.View style={[StyleSheet.absoluteFill, st.center, inactiveOpacity]}>
              <Ionicons name={meta.filled} size={24} color={colors.textTertiary} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, st.center, activeOpacity]}>
              <Ionicons name={meta.filled} size={24} color={colors.primary} />
            </Animated.View>
          </View>

          <View style={st.labelBox}>
            <Animated.Text style={[st.label, { color: colors.textTertiary }, inactiveOpacity]}>
              {route.name}
            </Animated.Text>
            <Animated.Text style={[st.label, StyleSheet.absoluteFill, st.center, { color: colors.primary }, activeOpacity]}>
              {route.name}
            </Animated.Text>
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Premium Tab Bar ───────────────────────────────────────────────────────────
export default function PremiumTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { theme: { colors } } = useTheme();

  const position       = useSharedValue(state.index);
  const indScale       = useSharedValue(1);
  const startPos       = useSharedValue(0);
  const lastHapticIdx  = useSharedValue(state.index);

  // Indicator + container colors as SharedValues so they update with theme
  const primarySV = useSharedValue(colors.primary);
  const bgSV      = useSharedValue(colors.surfaceLowest);
  const borderSV  = useSharedValue(colors.borderLight);

  useEffect(() => {
    primarySV.value = colors.primary;
    bgSV.value      = colors.surfaceLowest;
    borderSV.value  = colors.borderLight;
  }, [colors.primary, colors.surfaceLowest, colors.borderLight]);

  useEffect(() => {
    position.value = withSpring(state.index, SPRING);
  }, [state.index]);

  const navigateTo = useCallback((name) => {
    navigation.navigate(name);
  }, [navigation]);

  const triggerHaptic = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  // Animations are started on the UI thread in TabItem's tapGesture worklet.
  // handlePress only dispatches the navigation (JS thread concern).
  const handlePress = useCallback((index) => {
    Haptics.selectionAsync();
    navigateTo(state.routes[index].name);
  }, [state.routes, navigateTo]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      'worklet';
      startPos.value     = position.value;
      indScale.value     = 1;
      lastHapticIdx.value = Math.round(position.value);
    })
    .onUpdate((e) => {
      'worklet';
      const next    = startPos.value + e.translationX / TAB_W;
      const clamped = Math.max(0, Math.min(N - 1, next));
      position.value = clamped;
      const rounded = Math.round(clamped);
      if (rounded !== lastHapticIdx.value) {
        lastHapticIdx.value = rounded;
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd((e) => {
      const projected = position.value + (e.velocityX / TAB_W) * 0.12;
      const target    = Math.max(0, Math.min(N - 1, Math.round(projected)));
      position.value  = withSpring(target, SPRING);
      indScale.value  = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
      // Reanimated v4: JS functions called directly from worklets are
      // automatically bridged to the JS thread by the runtime.
      if (target !== state.index) {
        runOnJS(triggerHaptic)();
        runOnJS(navigateTo)(state.routes[target].name);
      }
    });

  // Indicator: transform + reactive colors in one animated style
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value * TAB_W + (TAB_W - IND_W) / 2 },
      { scaleX:     indScale.value },
    ],
    backgroundColor: primarySV.value,
    shadowColor:     primarySV.value,
  }));

  // Container: background + border reactive to theme
  const containerDynStyle = useAnimatedStyle(() => ({
    backgroundColor: bgSV.value,
    borderTopColor:  borderSV.value,
  }));

  const contentH  = 56;
  const bottomPad = insets.bottom + (Platform.OS === 'ios' ? 6 : 2);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          st.container,
          containerDynStyle,
          { height: contentH + bottomPad, paddingBottom: bottomPad },
        ]}
      >
        {/* Neon indicator bar */}
        <Animated.View pointerEvents="none" style={[st.indicator, indicatorStyle]} />

        {/* Tab buttons — each has its own nested Gesture.Tap() detector */}
        <View style={st.row}>
          {state.routes.map((route, index) => (
            <TabItem
              key={route.key}
              route={route}
              index={index}
              position={position}
              indScale={indScale}
              onPress={() => handlePress(index)}
            />
          ))}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Layout-only styles — all colors live in SharedValues above ────────────────
const st = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  iconBox: {
    width: 24,
    height: 24,
  },
  labelBox: {
    marginTop: 3,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  indicator: {
    position:     'absolute',
    top:          0,
    left:         0,
    width:        IND_W,
    height:       IND_H,
    borderRadius: IND_H,
    shadowOpacity: 0.9,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 0 },
    elevation:     8,
  },
});
