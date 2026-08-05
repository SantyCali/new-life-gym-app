import { View, StyleSheet } from 'react-native';
import { radius, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function Card({
  children,
  style,
  variant = 'default',
  padding = true,
}) {
  const { theme: { colors } } = useTheme();

  const bgColors = {
    default:   colors.surfaceElevated,
    elevated:  colors.surfaceHighlight,
    highlight: colors.surfaceActive,
    primary:   colors.primaryDim,
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bgColors[variant] ?? colors.surfaceElevated,
          borderColor: colors.border,
        },
        padding && styles.padding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 0.5,
  },
  padding: {
    padding: spacing.lg,
  },
});
