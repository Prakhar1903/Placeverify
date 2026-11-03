import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

export interface DialogAction {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive' | 'accent' | 'warning';
}

export interface CustomAlertDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: 'info' | 'warning' | 'danger' | 'test';
  actions: DialogAction[];
  onClose: () => void;
  useModal?: boolean;
}

export const CustomAlertDialog: React.FC<CustomAlertDialogProps> = ({
  visible,
  title,
  message,
  type = 'info',
  actions,
  onClose,
  useModal = true,
}) => {
  if (!visible) return null;

  const getAccentColor = () => {
    switch (type) {
      case 'danger':
        return {badge: '#2B1217', border: '#DC2626', text: '#F87171', symbol: '✕'};
      case 'warning':
        return {badge: '#2A1D0D', border: '#D97706', text: '#FBBF24', symbol: '🔔'};
      case 'test':
        return {badge: '#2A1D0D', border: '#D97706', text: '#FBBF24', symbol: '🔔'};
      case 'info':
      default:
        return {badge: '#0C2337', border: '#0284C7', text: '#38BDF8', symbol: 'ℹ'};
    }
  };

  const accent = getAccentColor();

  const getActionButtonStyle = (actionStyle?: string) => {
    switch (actionStyle) {
      case 'destructive':
        return {
          container: styles.btnDestructive,
          text: styles.btnDestructiveText,
        };
      case 'warning':
        return {
          container: styles.btnWarning,
          text: styles.btnWarningText,
        };
      case 'accent':
        return {
          container: styles.btnAccent,
          text: styles.btnAccentText,
        };
      case 'cancel':
        return {
          container: styles.btnCancel,
          text: styles.btnCancelText,
        };
      case 'default':
      default:
        return {
          container: styles.btnDefault,
          text: styles.btnDefaultText,
        };
    }
  };

  const dialogContent = (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback>
          <View style={styles.dialogCard}>
            {/* Header Icon & Title */}
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconBadge,
                  {backgroundColor: accent.badge, borderColor: accent.border},
                ]}>
                <Text style={[styles.iconText, {color: accent.text}]}>
                  {accent.symbol}
                </Text>
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.title}>{title}</Text>
                {message ? <Text style={styles.message}>{message}</Text> : null}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              {actions.map((action, index) => {
                const s = getActionButtonStyle(action.style);
                return (
                  <TouchableOpacity
                    key={`action_${index}`}
                    style={[styles.actionBtn, s.container]}
                    activeOpacity={0.75}
                    onPress={() => {
                      action.onPress();
                      onClose();
                    }}>
                    <Text style={[styles.actionBtnText, s.text]}>
                      {action.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );

  if (useModal === false) {
    return (
      <View style={[StyleSheet.absoluteFillObject, {zIndex: 999999}]}>
        {dialogContent}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}>
      {dialogContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 9, 17, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111A2D',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1E2D44',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 14,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  btnDefault: {
    backgroundColor: '#162236',
    borderColor: '#243750',
  },
  btnDefaultText: {
    color: '#E2E8F0',
  },
  btnAccent: {
    backgroundColor: '#0C2337',
    borderColor: '#0284C7',
  },
  btnAccentText: {
    color: '#38BDF8',
  },
  btnWarning: {
    backgroundColor: '#261C08',
    borderColor: '#D97706',
  },
  btnWarningText: {
    color: '#FBBF24',
  },
  btnDestructive: {
    backgroundColor: '#261217',
    borderColor: '#DC2626',
  },
  btnDestructiveText: {
    color: '#F87171',
  },
  btnCancel: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    marginTop: 4,
  },
  btnCancelText: {
    color: '#64748B',
  },
});
