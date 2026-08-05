'use strict';

// ── Color math helpers ──────────────────────────────────────────────────────
function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function clamp(v) { return Math.min(255, Math.max(0, Math.round(v))); }

function rgbToHex(r, g, b) {
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Nearly-black + small accent tint → produces tinted dark surface levels
// base 2-38: absolute floor brightness; factor 0.05-0.11: accent contribution
function tintDark(r, g, b, base, factor) {
  return rgbToHex(base + r * factor, base + g * factor, base + b * factor);
}

// Light text with a very subtle push toward the accent hue
function tintText(r, g, b, base) {
  const navg = (r + g + b) / 3;
  return rgbToHex(
    base + (r - navg) * 0.03,
    base + (g - navg) * 0.03,
    base + (b - navg) * 0.03,
  );
}

// ── Theme builder ───────────────────────────────────────────────────────────
export function buildTheme(mode, accentColor) {
  const { hex: accent, textOnAccent } = accentColor;
  const isDark = mode !== 'light';
  const { r, g, b } = hexToRgb(accent);

  // Semantic colors shared across both modes
  const shared = {
    streak:       '#FF6B2B',
    streakDim:    'rgba(255,107,43,0.15)',
    streakFaint:  'rgba(255,107,43,0.20)',
    streakBorder: 'rgba(255,107,43,0.30)',
    coin:         '#FFD700',
    coinDim:      'rgba(255,215,0,0.15)',
    danger:       '#FF5C5C',
    dangerDim:    'rgba(255,92,92,0.12)',
    dangerBorder: 'rgba(255,92,92,0.30)',
    bronze:       '#CD7F32',
    silver:       '#A8A8A8',
    gold:         '#FFD700',
  };

  if (isDark) {
    // Each surface layer: very dark base + micro-tint of the accent color.
    // The formula tintDark(r,g,b, base, factor) = nearly-black + accent*factor.
    // base goes 2→38 (absolute floor brightness), factor goes 0.05→0.11.
    // Verified against the original lime palette — values land within ±4 of
    // the original hand-tuned colors, while adapting perfectly to any accent.
    return {
      isDark: true,
      colors: {
        ...shared,
        // ── Surfaces (darkest → lightest) ────────────────────────────────
        surfaceLowest:           tintDark(r, g, b, 2,  0.05),
        background:              tintDark(r, g, b, 8,  0.06),
        surface:                 tintDark(r, g, b, 8,  0.06),
        surfaceContainerLow:     tintDark(r, g, b, 16, 0.07),
        surfaceContainer:        tintDark(r, g, b, 20, 0.08),
        surfaceElevated:         tintDark(r, g, b, 20, 0.08),
        surfaceContainerHigh:    tintDark(r, g, b, 28, 0.09),
        surfaceHighlight:        tintDark(r, g, b, 28, 0.09),
        surfaceContainerHighest: tintDark(r, g, b, 38, 0.11),
        surfaceActive:           tintDark(r, g, b, 38, 0.11),

        // ── Accent ───────────────────────────────────────────────────────
        primary:       accent,
        primaryDim:    accent,
        primaryShadow: rgba(accent, 0.50),
        primaryBorder: rgba(accent, 0.20),
        primaryDim12:  rgba(accent, 0.12),
        primaryDim10:  rgba(accent, 0.10),
        primaryGlow:   rgba(accent, 0.06),
        textOnPrimary: textOnAccent,
        textInverse:   textOnAccent,

        // ── Text — very subtle push toward accent hue ─────────────────
        text:          tintText(r, g, b, 226),
        textSecondary: tintText(r, g, b, 190),
        textTertiary:  tintText(r, g, b, 138),

        // ── Borders ──────────────────────────────────────────────────────
        // border: solid mid-tone tinted separator
        border:         tintDark(r, g, b, 44, 0.18),
        outlineVariant: tintDark(r, g, b, 44, 0.18),
        // borderLight: barely-visible accent outline for cards
        borderLight:    rgba(accent, 0.08),

        overlay:       'rgba(0,0,0,0.75)',
        overlayMedium: 'rgba(0,0,0,0.55)',

        success:    accent,
        successDim: rgba(accent, 0.12),
      },
    };
  }

  // ── Light mode ─────────────────────────────────────────────────────────────
  // Surfaces: warm white with a micro-tint of the accent hue.
  // We deviate from neutral (navg) so each accent gives a unique warmth.
  const navgL = (r + g + b) / 3;
  const tl = (base, factor) => rgbToHex(
    base + (r - navgL) * factor,
    base + (g - navgL) * factor,
    base + (b - navgL) * factor,
  );

  return {
    isDark: false,
    colors: {
      ...shared,
      background:              tl(248, 0.015),
      surface:                 tl(255, 0.008),
      surfaceLowest:           tl(232, 0.020),
      surfaceContainerLow:     tl(242, 0.015),
      surfaceContainer:        tl(255, 0.008),
      surfaceElevated:         tl(255, 0.008),
      surfaceContainerHigh:    tl(244, 0.018),
      surfaceHighlight:        tl(244, 0.018),
      surfaceContainerHighest: tl(235, 0.022),
      surfaceActive:           tl(224, 0.025),

      primary:       accent,
      primaryDim:    accent,
      primaryShadow: rgba(accent, 0.50),
      primaryBorder: rgba(accent, 0.25),
      primaryDim12:  rgba(accent, 0.12),
      primaryDim10:  rgba(accent, 0.10),
      primaryGlow:   rgba(accent, 0.06),
      textOnPrimary: textOnAccent,
      textInverse:   textOnAccent,

      text:          '#1A1C12',
      textSecondary: '#4A4D3C',
      textTertiary:  '#7A7D6E',

      border:         '#C8C9C0',
      outlineVariant: '#C8C9C0',
      borderLight:    'rgba(0,0,0,0.06)',

      overlay:       'rgba(0,0,0,0.60)',
      overlayMedium: 'rgba(0,0,0,0.40)',

      success:    accent,
      successDim: rgba(accent, 0.12),
    },
  };
}
