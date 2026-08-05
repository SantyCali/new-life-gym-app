import { View, Text, StyleSheet } from 'react-native';
import { typography, radius, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function Badge({ label, variant = 'default', icon, style }) {
  const { theme: { colors } } = useTheme();

  const variants = {
    default: { bg: colors.surfaceHighlight,  text: colors.textSecondary },
    primary: { bg: colors.primaryDim12,      text: colors.primary        },
    streak:  { bg: colors.streakDim,         text: colors.streak         },
    success: { bg: colors.successDim,        text: colors.success        },
    coin:    { bg: colors.coinDim,           text: colors.coin           },
    level:   { bg: colors.primaryDim10,      text: colors.primary        },
  };

  const v = variants[variant] ?? variants.default;

  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.full,
    gap: 4,
  },
  icon:  { fontSize: 13 },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
