import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {Drive} from '../types';
import {NativeAlarmBridge} from '../services/NativeAlarmBridge';
import {CustomAlertDialog, DialogAction} from './CustomAlertDialog';

interface Props {
  visible: boolean;
  drive: Drive | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClockPickerModal: React.FC<Props> = ({
  visible,
  drive,
  onClose,
  onSuccess,
}) => {
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

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = same day, 1 = 1 day before, 2 = 2 days before
  const [selectedHour, setSelectedHour] = useState<number>(9); // 1-12
  const [selectedMinute, setSelectedMinute] = useState<number>(0); // 0, 15, 30, 45
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>('AM');
  const [calculatedAlarmMillis, setCalculatedAlarmMillis] = useState<number>(
    drive?.alarmMillis || Date.now(),
  );
  const [formattedPreview, setFormattedPreview] = useState<string>('');

  // Reset & initialize when a new drive is selected or modal opened
  useEffect(() => {
    if (!drive || !visible) return;
    const deadline = drive.deadlineMillis || Date.now();
    const defaultAlarm = deadline - 2 * 3600 * 1000;
    const targetDate = new Date(defaultAlarm > Date.now() ? defaultAlarm : deadline);

    let h = targetDate.getHours();
    setSelectedAmPm(h >= 12 ? 'PM' : 'AM');
    h = h % 12 || 12;
    setSelectedHour(h);
    setSelectedMinute(Math.floor(targetDate.getMinutes() / 15) * 15);
    setSelectedDayOffset(0);
  }, [drive?.id, visible]);

  // Update calculated alarm timestamp whenever user tweaks the clock
  useEffect(() => {
    if (!drive) return;
    const deadlineDate = new Date(drive.deadlineMillis);

    // Calculate base date by subtracting days
    const targetDate = new Date(deadlineDate);
    targetDate.setDate(targetDate.getDate() - selectedDayOffset);

    // Calculate hour in 24h format
    let hour24 = selectedHour;
    if (selectedAmPm === 'PM' && selectedHour < 12) hour24 += 12;
    if (selectedAmPm === 'AM' && selectedHour === 12) hour24 = 0;

    targetDate.setHours(hour24, selectedMinute, 0, 0);

    const calculatedTime = targetDate.getTime();
    setCalculatedAlarmMillis(calculatedTime);

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    setFormattedPreview(targetDate.toLocaleString('en-US', options));
  }, [drive?.deadlineMillis, selectedDayOffset, selectedHour, selectedMinute, selectedAmPm]);

  const applyPreset = (type: '1h' | '2h' | '4h' | 'morning' | '1day') => {
    if (!drive) return;
    const deadlineDate = new Date(drive.deadlineMillis);
    let targetDate = new Date(drive.deadlineMillis);

    if (type === '1h') {
      targetDate = new Date(drive.deadlineMillis - 1 * 3600 * 1000);
      setSelectedDayOffset(0);
      let h = targetDate.getHours();
      setSelectedAmPm(h >= 12 ? 'PM' : 'AM');
      h = h % 12 || 12;
      setSelectedHour(h);
      setSelectedMinute(targetDate.getMinutes());
    } else if (type === '2h') {
      targetDate = new Date(drive.deadlineMillis - 2 * 3600 * 1000);
      setSelectedDayOffset(0);
      let h = targetDate.getHours();
      setSelectedAmPm(h >= 12 ? 'PM' : 'AM');
      h = h % 12 || 12;
      setSelectedHour(h);
      setSelectedMinute(targetDate.getMinutes());
    } else if (type === '4h') {
      targetDate = new Date(drive.deadlineMillis - 4 * 3600 * 1000);
      setSelectedDayOffset(0);
      let h = targetDate.getHours();
      setSelectedAmPm(h >= 12 ? 'PM' : 'AM');
      h = h % 12 || 12;
      setSelectedHour(h);
      setSelectedMinute(targetDate.getMinutes());
    } else if (type === 'morning') {
      setSelectedDayOffset(0);
      setSelectedHour(9);
      setSelectedMinute(0);
      setSelectedAmPm('AM');
    } else if (type === '1day') {
      setSelectedDayOffset(1);
      setSelectedHour(9);
      setSelectedMinute(0);
      setSelectedAmPm('AM');
    }
  };

  const handleSave = async () => {
    if (!drive) return;
    if (calculatedAlarmMillis >= drive.deadlineMillis) {
      setDialogConfig({
        visible: true,
        title: 'Invalid Alarm Time',
        message: 'Your alarm must be set BEFORE the registration deadline.',
        type: 'warning',
        actions: [{text: 'OK', style: 'default', onPress: () => {}}],
      });
      return;
    }

    if (calculatedAlarmMillis <= Date.now()) {
      setDialogConfig({
        visible: true,
        title: 'Invalid Alarm Time',
        message: 'Cannot set an alarm in the past. Please choose a future time.',
        type: 'warning',
        actions: [{text: 'OK', style: 'default', onPress: () => {}}],
      });
      return;
    }

    try {
      await NativeAlarmBridge.addCustomAlarm(
        drive.id,
        calculatedAlarmMillis,
        formattedPreview,
        'Custom Alarm',
      );
      setDialogConfig({
        visible: true,
        title: '⏰ Alarm Added!',
        message: `New alarm set for:\n${formattedPreview}\n\nYour 2h and 1h alarms remain active!`,
        type: 'info',
        actions: [
          {
            text: 'OK',
            style: 'accent',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ],
      });
    } catch (e: any) {
      setDialogConfig({
        visible: true,
        title: 'Error',
        message: e?.message || 'Failed to add custom alarm.',
        type: 'danger',
        actions: [{text: 'Close', style: 'default', onPress: () => {}}],
      });
    }
  };

  if (!visible || !drive) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>⏰ Add Custom Alarm</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {drive.companyName} • Add extra reminder below default alarms
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Quick Presets */}
            <Text style={styles.sectionHeader}>Quick Alarm Presets</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset('1h')}>
                <Text style={styles.presetChipText}>1h Before</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetChip, styles.presetChipActive]}
                onPress={() => applyPreset('2h')}>
                <Text style={[styles.presetChipText, styles.presetChipTextActive]}>2h Before (Default)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset('4h')}>
                <Text style={styles.presetChipText}>4h Before</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset('morning')}>
                <Text style={styles.presetChipText}>🌅 Deadline Day at 9 AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => applyPreset('1day')}>
                <Text style={styles.presetChipText}>📅 1 Day Before at 9 AM</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Alarm Clock Section */}
            <Text style={[styles.sectionHeader, {marginTop: 18}]}>
              Custom Alarm Time
            </Text>

            {/* Day Selector */}
            <Text style={styles.fieldLabel}>Which Day:</Text>
            <View style={styles.selectorRow}>
              <TouchableOpacity
                style={[
                  styles.toggleChip,
                  selectedDayOffset === 0 && styles.toggleChipActive,
                ]}
                onPress={() => setSelectedDayOffset(0)}>
                <Text
                  style={[
                    styles.toggleChipText,
                    selectedDayOffset === 0 && styles.toggleChipTextActive,
                  ]}>
                  Day of Deadline
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleChip,
                  selectedDayOffset === 1 && styles.toggleChipActive,
                ]}
                onPress={() => setSelectedDayOffset(1)}>
                <Text
                  style={[
                    styles.toggleChipText,
                    selectedDayOffset === 1 && styles.toggleChipTextActive,
                  ]}>
                  1 Day Before
                </Text>
              </TouchableOpacity>
            </View>

            {/* Clock Time Selector (Hour, Minute, AM/PM) */}
            <Text style={styles.fieldLabel}>Clock Time:</Text>
            <View style={styles.clockContainer}>
              {/* Hour */}
              <View style={styles.clockColumn}>
                <Text style={styles.clockLabel}>Hour</Text>
                <View style={styles.numberStepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() =>
                      setSelectedHour(h => (h === 12 ? 1 : h + 1))
                    }>
                    <Text style={styles.stepBtnText}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.clockValueText}>
                    {selectedHour.toString().padStart(2, '0')}
                  </Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() =>
                      setSelectedHour(h => (h === 1 ? 12 : h - 1))
                    }>
                    <Text style={styles.stepBtnText}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.colonText}>:</Text>

              {/* Minute */}
              <View style={styles.clockColumn}>
                <Text style={styles.clockLabel}>Minute</Text>
                <View style={styles.numberStepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() =>
                      setSelectedMinute(m => (m >= 45 ? 0 : m + 15))
                    }>
                    <Text style={styles.stepBtnText}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.clockValueText}>
                    {selectedMinute.toString().padStart(2, '0')}
                  </Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() =>
                      setSelectedMinute(m => (m <= 0 ? 45 : m - 15))
                    }>
                    <Text style={styles.stepBtnText}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* AM/PM */}
              <View style={styles.clockColumn}>
                <Text style={styles.clockLabel}>AM / PM</Text>
                <View style={styles.ampmToggle}>
                  <TouchableOpacity
                    style={[
                      styles.ampmBtn,
                      selectedAmPm === 'AM' && styles.ampmBtnActive,
                    ]}
                    onPress={() => setSelectedAmPm('AM')}>
                    <Text
                      style={[
                        styles.ampmBtnText,
                        selectedAmPm === 'AM' && styles.ampmBtnTextActive,
                      ]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.ampmBtn,
                      selectedAmPm === 'PM' && styles.ampmBtnActive,
                    ]}
                    onPress={() => setSelectedAmPm('PM')}>
                    <Text
                      style={[
                        styles.ampmBtnText,
                        selectedAmPm === 'PM' && styles.ampmBtnTextActive,
                      ]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Live Preview Box */}
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>🔔 ALARM WILL RING AT:</Text>
              <Text style={styles.previewValue}>{formattedPreview}</Text>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>+ Add Alarm</Text>
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomColor: '#1E293B',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    maxWidth: 280,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    marginBottom: 16,
  },
  sectionHeader: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
  },
  presetChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  presetChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  toggleChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
  },
  toggleChipActive: {
    backgroundColor: '#1E3A2F',
    borderColor: '#10B981',
  },
  toggleChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleChipTextActive: {
    color: '#34D399',
  },
  clockContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 14,
    borderColor: '#334155',
    borderWidth: 1,
    gap: 16,
  },
  clockColumn: {
    alignItems: 'center',
  },
  clockLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  numberStepper: {
    alignItems: 'center',
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  stepBtnText: {
    color: '#38BDF8',
    fontSize: 14,
  },
  clockValueText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    paddingVertical: 2,
    minWidth: 44,
    textAlign: 'center',
  },
  colonText: {
    color: '#64748B',
    fontSize: 28,
    fontWeight: '900',
    paddingTop: 16,
  },
  ampmToggle: {
    gap: 6,
    marginTop: 2,
  },
  ampmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1,
  },
  ampmBtnActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  ampmBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  ampmBtnTextActive: {
    color: '#0F172A',
  },
  previewCard: {
    backgroundColor: '#1E3A2F',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  previewLabel: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  previewValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 15,
  },
});
