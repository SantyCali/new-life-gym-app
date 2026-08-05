function hexToHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return h * 360;
}

// Returns accent colors for the announcement card based on the primary hue
export function getAnnouncementAccent(primaryHex, isDark) {
  let h = 0;
  try { h = hexToHue(primaryHex); } catch (_) {}

  const palettes = [
    // hue range      accent hex    label
    { min: 195, max: 265, hex: '#FF6B6B' }, // Blue   → Coral
    { min: 80,  max: 165, hex: '#F59E0B' }, // Green  → Amber
    { min: 25,  max: 55,  hex: '#8B5CF6' }, // Orange → Violet
    { min: 265, max: 310, hex: '#EAB308' }, // Violet → Yellow
    { min: 310, max: 345, hex: '#14B8A6' }, // Pink   → Teal
    { min: 165, max: 195, hex: '#FB7185' }, // Cyan   → Rose
  ];

  // Red/warm catch-all
  const isWarm = h < 25 || h >= 345;

  const match = palettes.find(p => h >= p.min && h < p.max);
  const accent = match?.hex ?? (isWarm ? '#06B6D4' : '#FF6B6B');

  return isDark
    ? { bg: accent + '1A', border: accent + '50', text: accent, icon: accent }
    : { bg: accent + '18', border: accent + '45', text: shiftDark(accent), icon: accent };
}

// Slightly darken hex for light-mode text readability
function shiftDark(hex) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 50);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 50);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 50);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}