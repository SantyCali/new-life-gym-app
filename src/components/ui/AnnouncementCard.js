import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../theme';
import { getAnnouncementAccent } from '../../utils/accentColor';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AnnouncementCard({ announcement, colors, isDark }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  const accent = getAnnouncementAccent(colors.primary, isDark);

  return (
    <Animated.View
      style={[
        st.card,
        {
          backgroundColor: accent.bg,
          borderColor: accent.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={st.row}>
        <View style={[st.iconWrap, { backgroundColor: accent.border }]}>
          <Ionicons name="megaphone" size={18} color={accent.icon} />
        </View>
        <View style={st.texts}>
          <Text style={[st.title, { color: accent.text }]}>{announcement.title}</Text>
          <Text style={[st.message, { color: colors.text }]}>{announcement.message}</Text>
          <View style={st.meta}>
            <Text style={[st.metaText, { color: colors.textTertiary }]}>
              {announcement.trainerName}
            </Text>
            {announcement.createdAt && (
              <Text style={[st.metaText, { color: colors.textTertiary }]}>
                {' · '}{formatDate(announcement.createdAt)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  texts: { flex: 1, gap: 6 },
  title:   { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  message: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  meta:    { flexDirection: 'row', flexWrap: 'wrap' },
  metaText:{ fontSize: 11, fontWeight: '600' },
});