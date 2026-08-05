import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { typography, radius, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) {
  const { theme: { colors } } = useTheme();

  const bg = {
    primary:   disabled ? colors.surfaceContainerHigh : colors.primary,
    secondary: colors.surfaceHighlight,
    ghost:     'transparent',
    danger:    colors.danger,
  };

  const textColors = {
    primary:   disabled ? colors.textTertiary : colors.textOnPrimary,
    secondary: colors.text,
    ghost:     colors.primary,
    danger:    colors.text,
  };

  const heights   = { sm: 38, md: 50, lg: 56 };
  const fontSizes = { sm: typography.sizes.sm, md: typography.sizes.base, lg: typography.sizes.md };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        { backgroundColor: bg[variant], height: heights[size] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            { color: textColors[variant], fontSize: fontSizes[size] },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  label: {
    fontWeight: typography.weights.bold,
    letterSpacing: 0.3,
  },
});
