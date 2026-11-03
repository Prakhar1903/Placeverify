import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import {NativeAlarmBridge} from '../services/NativeAlarmBridge';
import {CustomAlertDialog, DialogAction} from './CustomAlertDialog';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface PresetPair {
  label: string;
  tag?: string;
  stage1: number; // in minutes
  stage2: number; // in minutes
}

const PRESET_PAIRS: PresetPair[] = [
  {label: '2h & 1h', tag: 'Standard', stage1: 120, stage2: 60},
  {label: '3h & 1h', tag: 'Recommended', stage1: 180, stage2: 60},
  {label: '4h & 2h', tag: 'Early Notice', stage1: 240, stage2: 120},
  {label: '1h & 30m', tag: 'Quick Alert', stage1: 60, stage2: 30},
  {label: '12h & 2h', tag: 'Half-Day', stage1: 720, stage2: 120},
  {label: '24h & 2h', tag: 'Full Day', stage1: 1440, stage2: 120},
];

export const SettingsModal: React.FC<Props> = ({visible, onClose, onSaved}) => {
  const [stage1Minutes, setStage1Minutes] = useState<number>(120);
  const [stage2Minutes, setStage2Minutes] = useState<number>(60);
  const [applyToUpcoming, setApplyToUpcoming] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

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

  // Load existing settings when modal opens
  useEffect(() => {
    if (!visible) return;
    const loadSettings = async () => {
      try {
        const settings = await NativeAlarmBridge.getDefaultAlarmSettings();
        if (settings) {
          setStage1Minutes(settings.stage1Minutes || 120);
          setStage2Minutes(settings.stage2Minutes || 60);
        }
      } catch (e) {
        console.error('Failed to load default settings', e);
      }
    };
    loadSettings();
  }, [visible]);

  // Validation logic to guarantee no overlap
  const getValidation = () => {
    if (stage1Minutes <= stage2Minutes) {
      return {
        valid: false,
        message: 'Stage 1 (First Warning) must ring earlier than Stage 2 (Final Notice).',
      };
    }
    const gap = stage1Minutes - stage2Minutes;
    if (gap < 15) {
      return {
        valid: false,
        message: 'Stage 1 and Stage 2 must be at least 15 minutes apart to prevent overlapping alarms.',
      };
    }
    if (stage2Minutes < 5) {
      return {
        valid: false,
        message: 'Stage 2 alarm must be set at least 5 minutes before deadline.',
      };
    }
    return {valid: true, gap};
  };

  const validation = getValidation();

  const formatDuration = (totalMinutes: number): string => {
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const handleApplyPreset = (preset: PresetPair) => {
    setStage1Minutes(preset.stage1);
    setStage2Minutes(preset.stage2);
  };

  // Adjust Stage 1
  const adjustStage1 = (deltaMinutes: number) => {
    const next = Math.max(15, stage1Minutes + deltaMinutes);
    setStage1Minutes(next);
  };

  // Adjust Stage 2
  const adjustStage2 = (deltaMinutes: number) => {
    const next = Math.max(5, stage2Minutes + deltaMinutes);
    setStage2Minutes(next);
  };

  const handleSave = async () => {
    if (!validation.valid) {
      setDialogConfig({
        visible: true,
        title: 'Alarm Overlap Error',
        message: validation.message,
        type: 'warning',
        actions: [{text: 'OK', style: 'default', onPress: () => {}}],
      });
      return;
    }

    setLoading(true);
    try {
      const updatedCount = await NativeAlarmBridge.saveDefaultAlarmSettings(
        stage1Minutes,
        stage2Minutes,
        applyToUpcoming,
      );

      const msg = applyToUpcoming && updatedCount > 0
        ? `New defaults saved: ${formatDuration(stage1Minutes)} & ${formatDuration(stage2Minutes)} before deadline.\n\n${updatedCount} upcoming active drive(s) updated and rescheduled automatically!`
        : `New defaults saved: ${formatDuration(stage1Minutes)} & ${formatDuration(stage2Minutes)} before deadline.\n\nFuture notifications will use these timings.`;

      setDialogConfig({
        visible: true,
        title: '⚙️ Settings Saved',
        message: msg,
        type: 'info',
        actions: [
          {
            text: 'Done',
            style: 'accent',
            onPress: () => {
              onSaved?.();
              onClose();
            },
          },
        ],
      });
    } catch (e: any) {
      setDialogConfig({
        visible: true,
        title: 'Error Saving Settings',
        message: e?.message || 'Failed to save settings.',
        type: 'danger',
        actions: [{text: 'Close', style: 'default', onPress: () => {}}],
      });
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{flex: 1}}>
              <Text style={styles.title}>⚙️ Default Alarm Settings</Text>
              <Text style={styles.subtitle}>
                Auto-scheduled when deadlines are detected
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Quick Timing Pairs */}
            <Text style={styles.sectionHeader}>QUICK TIMING PAIRS</Text>
            <View style={styles.presetsGrid}>
              {PRESET_PAIRS.map((pair, idx) => {
                const isActive =
                  stage1Minutes === pair.stage1 && stage2Minutes === pair.stage2;
                return (
                  <TouchableOpacity
                    key={`pair_${idx}`}
                    style={[styles.presetCard, isActive && styles.presetCardActive]}
                    activeOpacity={0.75}
                    onPress={() => handleApplyPreset(pair)}>
                    <Text
                      style={[
                        styles.presetCardTitle,
                        isActive && styles.presetCardTitleActive,
                      ]}>
                      {pair.label}
                    </Text>
                    {pair.tag ? (
                      <Text
                        style={[
                          styles.presetCardTag,
                          isActive && styles.presetCardTagActive,
                        ]}>
                        {pair.tag}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Timing Section */}
            <Text style={styles.sectionHeader}>CUSTOMIZE EACH STAGE</Text>

            {/* Stage 1 Box */}
            <View style={styles.stageBox}>
              <View style={styles.stageHeaderRow}>
                <View style={[styles.stageDot, {backgroundColor: '#F59E0B'}]} />
                <View style={{flex: 1}}>
                  <Text style={styles.stageName}>Stage 1: First Warning</Text>
                  <Text style={styles.stageSub}>Earlier reminder to start prep</Text>
                </View>
                <View style={styles.valuePillWarning}>
                  <Text style={styles.valuePillWarningText}>
                    {formatDuration(stage1Minutes)} before
                  </Text>
                </View>
              </View>

              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage1(-30)}>
                  <Text style={styles.stepBtnText}>-30m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage1(-60)}>
                  <Text style={styles.stepBtnText}>-1h</Text>
                </TouchableOpacity>
                <View style={styles.currentValBox}>
                  <Text style={styles.currentValNumber}>
                    {formatDuration(stage1Minutes)}
                  </Text>
                  <Text style={styles.currentValLabel}>before deadline</Text>
                </View>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage1(60)}>
                  <Text style={styles.stepBtnText}>+1h</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage1(120)}>
                  <Text style={styles.stepBtnText}>+2h</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Stage 2 Box */}
            <View style={styles.stageBox}>
              <View style={styles.stageHeaderRow}>
                <View style={[styles.stageDot, {backgroundColor: '#EF4444'}]} />
                <View style={{flex: 1}}>
                  <Text style={styles.stageName}>Stage 2: Final Notice</Text>
                  <Text style={styles.stageSub}>Last chance urgent alert</Text>
                </View>
                <View style={styles.valuePillUrgent}>
                  <Text style={styles.valuePillUrgentText}>
                    {formatDuration(stage2Minutes)} before
                  </Text>
                </View>
              </View>

              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage2(-15)}>
                  <Text style={styles.stepBtnText}>-15m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage2(-30)}>
                  <Text style={styles.stepBtnText}>-30m</Text>
                </TouchableOpacity>
                <View style={styles.currentValBox}>
                  <Text style={styles.currentValNumber}>
                    {formatDuration(stage2Minutes)}
                  </Text>
                  <Text style={styles.currentValLabel}>before deadline</Text>
                </View>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage2(15)}>
                  <Text style={styles.stepBtnText}>+15m</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => adjustStage2(30)}>
                  <Text style={styles.stepBtnText}>+30m</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Sequence & Overlap Validation Banner */}
            <View
              style={[
                styles.validationCard,
                validation.valid
                  ? styles.validationCardSuccess
                  : styles.validationCardError,
              ]}>
              <Text
                style={[
                  styles.validationTitle,
                  validation.valid
                    ? styles.validationTitleSuccess
                    : styles.validationTitleError,
                ]}>
                {validation.valid
                  ? `✓ No Overlap: ${formatDuration(validation.gap || 0)} separation`
                  : '⚠️ Invalid Configuration'}
              </Text>
              <Text style={styles.validationMessage}>
                {validation.valid
                  ? `Alarms will fire sequentially:\n1st Alarm: ${formatDuration(stage1Minutes)} before deadline\n2nd Alarm: ${formatDuration(stage2Minutes)} before deadline`
                  : validation.message}
              </Text>
            </View>

            {/* Retroactive Reschedule Switch */}
            <View style={styles.switchRow}>
              <View style={{flex: 1, paddingRight: 12}}>
                <Text style={styles.switchTitle}>Update Active Upcoming Drives</Text>
                <Text style={styles.switchSub}>
                  Automatically recalculates and reschedules future alarms for existing deadlines
                </Text>
              </View>
              <Switch
                value={applyToUpcoming}
                onValueChange={setApplyToUpcoming}
                trackColor={{false: '#1E293B', true: '#0284C7'}}
                thumbColor={applyToUpcoming ? '#38BDF8' : '#94A3B8'}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!validation.valid || loading) && styles.saveBtnDisabled,
              ]}
              disabled={!validation.valid || loading}
              onPress={handleSave}>
              <Text style={styles.saveBtnText}>
                {loading ? 'Saving...' : 'Save Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom Dark-Glass Alert Dialog */}
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
    backgroundColor: 'rgba(5, 9, 17, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scroll: {
    flexGrow: 0,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#64748B',
    marginTop: 10,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  presetCard: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: '#141E33',
    borderColor: '#1E2D44',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  presetCardActive: {
    backgroundColor: '#0C2A40',
    borderColor: '#0284C7',
    borderWidth: 1.5,
  },
  presetCardTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  presetCardTitleActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  presetCardTag: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  presetCardTagActive: {
    color: '#7DD3FC',
  },
  stageBox: {
    backgroundColor: '#111A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2D44',
    padding: 12,
    marginBottom: 10,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  stageSub: {
    fontSize: 11,
    color: '#64748B',
  },
  valuePillWarning: {
    backgroundColor: '#261C08',
    borderColor: '#D97706',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  valuePillWarningText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  valuePillUrgent: {
    backgroundColor: '#2E1116',
    borderColor: '#DC2626',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  valuePillUrgentText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepBtn: {
    backgroundColor: '#162238',
    borderColor: '#243750',
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 7,
  },
  stepBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  currentValBox: {
    alignItems: 'center',
    flex: 1,
  },
  currentValNumber: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  currentValLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  validationCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    marginVertical: 6,
  },
  validationCardSuccess: {
    backgroundColor: '#06291E',
    borderColor: '#059669',
  },
  validationCardError: {
    backgroundColor: '#2B1217',
    borderColor: '#DC2626',
  },
  validationTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 3,
  },
  validationTitleSuccess: {
    color: '#34D399',
  },
  validationTitleError: {
    color: '#F87171',
  },
  validationMessage: {
    fontSize: 11.5,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    borderColor: '#1E2D44',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  switchTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 13.5,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#1E293B',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
