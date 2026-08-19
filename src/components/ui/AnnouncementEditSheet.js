import { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import useAuth from '../../hooks/useAuth';
import useUserProfile from '../../hooks/useUserProfile';
import { typography, spacing, radius } from '../../theme';
import {
  publishAnnouncement,
  deleteAnnouncement,
  sendAnnouncementNotification,
} from '../../services/announcementService';

export default function AnnouncementEditSheet({ visible, announcement, onClose }) {
  const { theme: { colors } } = useTheme();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [title,   setTitle]   = useState('');
  const [message, setMessage] = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(announcement?.title ?? '');
      setMessage(announcement?.message ?? '');
    }
  }, [visible, announcement]);

  const handlePublish = useCallback(async () => {
    if (!title.trim() || !message.trim()) return;
    setSaving(true);
    try {
      const t = title.trim();
      const m = message.trim();
      await publishAnnouncement({
        title:       t,
        message:     m,
        trainerName: profile?.nombre ?? 'Entrenador',
        trainerId:   user?.uid ?? '',
      });
      sendAnnouncementNotification({ title: t, message: m }).catch(() => {});
      onClose();
    } finally {
      setSaving(false);
    }
  }, [title, message, profile, user, onClose]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    try {
      await deleteAnnouncement();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose} />
        <View style={[st.sheet, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
          <View style={[st.handle, { backgroundColor: colors.borderLight }]} />
          <Text style={[st.sheetTitle, { color: colors.text }]}>
            {announcement ? 'Editar Anuncio' : 'Nuevo Anuncio'}
          </Text>

          <Text style={[st.label, { color: colors.textSecondary }]}>Título</Text>
          <TextInput
            style={[st.input, { color: colors.text, backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Nuevo horario de clases"
            placeholderTextColor={colors.textTertiary}
            maxLength={80}
          />

          <Text style={[st.label, { color: colors.textSecondary }]}>Mensaje</Text>
          <TextInput
            style={[st.input, st.inputMulti, { color: colors.text, backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Escribí el mensaje para todos tus clientes…"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            maxLength={300}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[st.publishBtn, { backgroundColor: colors.primary }, (!title.trim() || !message.trim()) && { opacity: 0.45 }]}
            onPress={handlePublish}
            disabled={!title.trim() || !message.trim() || saving}
            activeOpacity={0.82}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Ionicons name="megaphone" size={16} color={colors.textInverse} />
                <Text style={[st.publishBtnText, { color: colors.textInverse }]}>
                  {announcement ? 'Actualizar' : 'Publicar para todos'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {announcement && (
            <TouchableOpacity style={st.deleteBtn} onPress={handleDelete} disabled={saving} activeOpacity={0.75}>
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
              <Text style={st.deleteBtnText}>Eliminar anuncio</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000055' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 16,
    gap: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 8,
  },
  sheetTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.black,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: -4,
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.sizes.base,
  },
  inputMulti: {
    minHeight: 100,
    paddingTop: 12,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radius.xl,
    marginTop: 4,
  },
  publishBtnText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  deleteBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#EF4444',
  },
});
