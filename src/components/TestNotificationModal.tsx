import React, {useState} from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {NativeAlarmBridge} from '../services/NativeAlarmBridge';
import {CustomAlertDialog, DialogAction} from './CustomAlertDialog';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESETS = [
  {
    name: 'Package + Deadline (Google 24 LPA)',
    title: 'Placement Cell - Google Hiring',
    text: 'Dear Students, Google is hiring for Software Engineering roles with CTC: 24 LPA. Apply via Google Form: https://forms.gle/google2026. Register by Sep 18 2026 5:00PM. Best wishes, Placement Cell.',
  },
  {
    name: 'Package Update Only (PROSPERR.IO)',
    title: 'PROSPERR.IO - Package Update',
    text: 'Notice for PROSPERR.IO drive: The company has announced a compensation package of 18 LPA for full time conversion. Detailed portal: https://prosperr.io/careers',
  },
  {
    name: 'Assignment Notice (CS301)',
    title: 'CS301 Algorithm Assignment 2',
    text: 'Assignment 2 on Dynamic Programming is due on Sep 17 2026 11:59PM. Late submissions will receive 0 marks.',
  },
  {
    name: 'Standard Placement (Oracle)',
    title: 'Training and Placement Cell',
    text: 'Oracle Cloud Infrastructure registration deadline is Sep 19 2026 at 6:00 PM. Eligible: CSE/IT/ECE with CGPA >= 7.5.',
  },
  {
    name: 'Semester Fee Notice',
    title: 'Accounts Office Notification',
    text: 'Final installment of semester tuition fees must be submitted before Sep 20 2026 4:00 PM to avoid de-registration.',
  },
];

export const TestNotificationModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState(PRESETS[0].title);
  const [text, setText] = useState(PRESETS[0].text);
  const [loading, setLoading] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    type?: 'info' | 'warning' | 'danger' | 'test';
    actions: DialogAction[];
  }>({
    visible: false,
    title: '',
    actions: [],
  });

  const handleSimulate = async () => {
    if (!title.trim() || !text.trim()) {
      setDialogConfig({
        visible: true,
        title: 'Missing Details',
        message: 'Please enter both Title and Notification Text before simulating.',
        type: 'warning',
        actions: [{text: 'OK', style: 'default', onPress: () => {}}],
      });
      return;
    }

    setLoading(true);
    try {
      const result = await NativeAlarmBridge.simulateNotification(title, text);
      if (result) {
        setDialogConfig({
          visible: true,
          title: '🎉 Scheduled Successfully!',
          message: `[${result.category || 'General'}] ${result.companyName}\nDeadline: ${result.deadlineFormatted}\nAlarm: ${result.alarmFormatted}`,
          type: 'info',
          actions: [
            {
              text: 'Great!',
              style: 'accent',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ],
        });
      } else {
        setDialogConfig({
          visible: true,
          title: 'Parser Warning',
          message: 'Could not find a recognized deadline pattern (e.g. "Deadline Sep 16 2026 1:00PM" or "Submit by Sep 17 2026").',
          type: 'warning',
          actions: [{text: 'Understood', style: 'default', onPress: () => {}}],
        });
      }
    } catch (e: any) {
      setDialogConfig({
        visible: true,
        title: 'Simulation Error',
        message: e?.message || 'Failed to simulate notification.',
        type: 'danger',
        actions: [{text: 'Close', style: 'default', onPress: () => {}}],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.header}>🧪 Test Any Deadline Message</Text>
          <Text style={styles.subtext}>
            Test how the app extracts deadlines from assignments, fee notices, exams, and company drives.
          </Text>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Choose a Preset:</Text>
            <View style={styles.presetsRow}>
              {PRESETS.map((p, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.presetChip}
                  onPress={() => {
                    setTitle(p.title);
                    setText(p.text);
                  }}>
                  <Text style={styles.presetChipText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notification Title / Subject:</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. CSE301 - Assignment 2"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.label}>Notification Message Body:</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={4}
              placeholder="e.g. Submit by Sep 17 2026 11:59PM..."
              placeholderTextColor="#64748B"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSimulate}
              disabled={loading}>
              <Text style={styles.submitText}>
                {loading ? 'Processing...' : 'Run Simulation'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <CustomAlertDialog
          visible={dialogConfig.visible}
          title={dialogConfig.title}
          message={dialogConfig.message}
          type={dialogConfig.type || 'info'}
          actions={dialogConfig.actions}
          useModal={false}
          onClose={() => setDialogConfig(prev => ({...prev, visible: false}))}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 18,
  },
  body: {
    marginBottom: 16,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: '#F1F5F9',
    fontWeight: '700',
    fontSize: 14,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
