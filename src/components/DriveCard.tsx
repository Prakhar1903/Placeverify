import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Drive} from '../types';
import {NativeAlarmBridge} from '../services/NativeAlarmBridge';
import {DriveDetailsModal} from './DriveDetailsModal';
import {CustomAlertDialog, DialogAction} from './CustomAlertDialog';

interface Props {
  drive: Drive;
  onCancel: (id: string) => void;
  onTestRing: (company: string, stage?: number) => void;
  onOpenClockPicker: (drive: Drive) => void;
  onRefresh?: () => void;
}

const formatOffsetLabel = (
  deadlineMillis?: number,
  alarmMillis?: number,
  defaultSuffix: string = 'Notice',
): string => {
  if (!deadlineMillis || !alarmMillis || alarmMillis >= deadlineMillis) {
    return defaultSuffix;
  }
  const diffMinutes = Math.round((deadlineMillis - alarmMillis) / 60000);
  if (diffMinutes <= 0) return defaultSuffix;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  let timeStr = '';
  if (hours > 0 && minutes > 0) {
    timeStr = `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    timeStr = `${hours}h`;
  } else {
    timeStr = `${minutes}m`;
  }
  return `${timeStr} ${defaultSuffix}`;
};

export const DriveCard: React.FC<Props> = ({
  drive,
  onCancel,
  onTestRing,
  onOpenClockPicker,
  onRefresh,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState<boolean>(false);
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

  const stage1Title = formatOffsetLabel(
    drive.deadlineMillis,
    drive.alarm1Millis || drive.alarmMillis,
    'Warning',
  );
  const stage2Title = formatOffsetLabel(
    drive.deadlineMillis,
    drive.alarm2Millis,
    'Final Notice',
  );

  useEffect(() => {
    const updateCountdown = () => {
      if (!drive.deadlineMillis || drive.deadlineMillis <= 0) {
        setTimeLeft('Pending / TBA');
        setIsExpired(false);
        return;
      }

      const now = Date.now();
      const diff = drive.deadlineMillis - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s left`);
      }
      setIsExpired(false);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [drive.deadlineMillis]);

  const handleCancelSingleAlarm = (alarmKey: string, label: string) => {
    setDialogConfig({
      visible: true,
      title: 'Cancel Alarm',
      message: `Cancel "${label}" for ${drive.companyName}?\n\nOther alarms for this deadline will remain active.`,
      type: 'danger',
      actions: [
        {
          text: 'Yes, Cancel Alarm',
          style: 'destructive',
          onPress: async () => {
            try {
              await NativeAlarmBridge.cancelIndividualAlarm(drive.id, alarmKey);
              onRefresh?.();
            } catch (e: any) {
              console.error('Failed to cancel alarm', e);
            }
          },
        },
        {
          text: 'Keep Alarm',
          style: 'cancel',
          onPress: () => {},
        },
      ],
    });
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'Assignment':
        return {bg: '#0F2338', text: '#38BDF8', border: '#0284C7'};
      case 'Exam':
        return {bg: '#2D1418', text: '#F87171', border: '#DC2626'};
      case 'Fee / Payment':
        return {bg: '#291C08', text: '#FBBF24', border: '#D97706'};
      case 'General':
        return {bg: '#141E30', text: '#94A3B8', border: '#334155'};
      case 'Placement':
      default:
        return {bg: '#06291E', text: '#34D399', border: '#059669'};
    }
  };

  const catStyle = getCategoryColor(drive.category);
  const cleanPackage = drive.packageInfo
    ? drive.packageInfo.replace(/💰/g, '').replace(/₹/g, '').trim()
    : '';

  return (
    <TouchableOpacity
      style={[styles.card, isExpired && styles.cardExpired]}
      activeOpacity={0.85}
      onPress={() => setDetailsModalVisible(true)}>
      {/* Category & Status Bar */}
      <View style={styles.topMeta}>
        <View style={styles.tagsContainer}>
          <View
            style={[
              styles.categoryBadge,
              {backgroundColor: catStyle.bg, borderColor: catStyle.border},
            ]}>
            <Text style={[styles.categoryBadgeText, {color: catStyle.text}]}>
              {drive.category || 'Placement'}
            </Text>
          </View>
          {cleanPackage ? (
            <View style={styles.packageBadge}>
              <Text style={styles.packageBadgeText}>₹ {cleanPackage}</Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.badge,
            isExpired ? styles.badgeExpired : styles.badgeActive,
          ]}>
          <Text
            style={[
              styles.badgeText,
              isExpired ? styles.badgeTextExpired : styles.badgeTextActive,
            ]}>
            {timeLeft}
          </Text>
        </View>
      </View>

      {/* Header with Title & Chevron */}
      <View style={styles.header}>
        <View style={{flex: 1}}>
          <Text style={styles.companyName} numberOfLines={2}>
            {drive.companyName || 'Deadline Item'}
          </Text>
          {drive.title ? (
            <Text style={styles.titleText} numberOfLines={1}>
              {drive.title}
            </Text>
          ) : null}
        </View>
        <View style={styles.chevronBox}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      </View>

      {/* Deadline Info */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>DEADLINE</Text>
        <Text style={styles.infoValue}>
          {drive.deadlineMillis > 0
            ? drive.deadlineFormatted
            : 'Pending / Not Announced'}
        </Text>
      </View>

      {/* Alarms Section */}
      <View style={styles.dualAlarmsContainer}>
        {/* Alarm 1 */}
        <View style={styles.alarmStageRow}>
          <View style={styles.alarmStageLeft}>
            <View style={[styles.statusDot, {backgroundColor: '#F59E0B'}]} />
            <View style={{flex: 1}}>
              <Text style={styles.alarmStageTitle}>{stage1Title}</Text>
              <Text style={styles.alarmStageTime}>
                {drive.alarm1Formatted || drive.alarmFormatted}
              </Text>
            </View>
          </View>
          <View style={styles.alarmRightActions}>
            <View
              style={[
                styles.alarmStatusPill,
                drive.alarm1Dismissed ? styles.pillDismissed : styles.pillActive,
              ]}>
              <Text
                style={[
                  styles.alarmStatusText,
                  drive.alarm1Dismissed ? styles.textDismissed : styles.textActive,
                ]}>
                {drive.alarm1Dismissed ? 'Dismissed' : 'Active'}
              </Text>
            </View>
            {!drive.alarm1Dismissed && (
              <TouchableOpacity
                style={styles.cancelAlarmIconBtn}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                onPress={e => {
                  e.stopPropagation?.();
                  handleCancelSingleAlarm('stage_1', `${stage1Title} Alarm`);
                }}>
                <Text style={styles.cancelAlarmIconText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Alarm 2 */}
        <View style={styles.alarmStageRow}>
          <View style={styles.alarmStageLeft}>
            <View style={[styles.statusDot, {backgroundColor: '#EF4444'}]} />
            <View style={{flex: 1}}>
              <Text style={styles.alarmStageTitle}>{stage2Title}</Text>
              <Text style={[styles.alarmStageTime, styles.urgentTime]}>
                {drive.alarm2Formatted || 'Before deadline'}
              </Text>
            </View>
          </View>
          <View style={styles.alarmRightActions}>
            <View
              style={[
                styles.alarmStatusPill,
                drive.alarm2Dismissed ? styles.pillDismissed : styles.pillUrgent,
              ]}>
              <Text
                style={[
                  styles.alarmStatusText,
                  drive.alarm2Dismissed ? styles.textDismissed : styles.textUrgent,
                ]}>
                {drive.alarm2Dismissed ? 'Dismissed' : 'Active'}
              </Text>
            </View>
            {!drive.alarm2Dismissed && (
              <TouchableOpacity
                style={styles.cancelAlarmIconBtn}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                onPress={e => {
                  e.stopPropagation?.();
                  handleCancelSingleAlarm('stage_2', `${stage2Title} Alarm`);
                }}>
                <Text style={styles.cancelAlarmIconText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Custom Alarms */}
        {drive.customAlarms && drive.customAlarms.length > 0 && (
          <>
            {drive.customAlarms.map((custom, index) => (
              <View
                key={custom.id || `custom_${index}`}
                style={[styles.alarmStageRow, styles.customAlarmRow]}>
                <View style={styles.alarmStageLeft}>
                  <View style={[styles.statusDot, {backgroundColor: '#38BDF8'}]} />
                  <View style={{flex: 1}}>
                    <Text style={[styles.alarmStageTitle, {color: '#7DD3FC'}]}>
                      {custom.label || `Custom Alarm ${index + 1}`}
                    </Text>
                    <Text style={[styles.alarmStageTime, {color: '#38BDF8'}]}>
                      {custom.formattedTime}
                    </Text>
                  </View>
                </View>
                <View style={styles.alarmRightActions}>
                  <View
                    style={[
                      styles.alarmStatusPill,
                      custom.isDismissed ? styles.pillDismissed : styles.pillCustom,
                    ]}>
                    <Text
                      style={[
                        styles.alarmStatusText,
                        custom.isDismissed
                          ? styles.textDismissed
                          : styles.textCustom,
                      ]}>
                      {custom.isDismissed ? 'Dismissed' : 'Active'}
                    </Text>
                  </View>
                  {!custom.isDismissed && (
                    <TouchableOpacity
                      style={styles.cancelAlarmIconBtn}
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                      onPress={e => {
                        e.stopPropagation?.();
                        handleCancelSingleAlarm(
                          custom.id,
                          custom.label || `Custom Alarm ${index + 1}`,
                        );
                      }}>
                      <Text style={styles.cancelAlarmIconText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      {/* Action Buttons Row (Details button removed) */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionBtnAccent}
          activeOpacity={0.75}
          onPress={e => {
            e.stopPropagation?.();
            onOpenClockPicker(drive);
          }}>
          <Text style={styles.actionBtnAccentText}>+ Custom Alarm</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnSecondary}
          activeOpacity={0.75}
          onPress={e => {
            e.stopPropagation?.();
            setDialogConfig({
              visible: true,
              title: 'Test Alarm Preview',
              message: `Choose which stage to preview for ${drive.companyName}:`,
              type: 'test',
              actions: [
                {
                  text: `${stage1Title} (Stage 1)`,
                  style: 'warning',
                  onPress: () => onTestRing(drive.companyName, 1),
                },
                {
                  text: `${stage2Title} (Stage 2)`,
                  style: 'destructive',
                  onPress: () => onTestRing(drive.companyName, 2),
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {},
                },
              ],
            });
          }}>
          <Text style={styles.actionBtnSecondaryText}>Test Preview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnDanger}
          activeOpacity={0.75}
          onPress={e => {
            e.stopPropagation?.();
            setDialogConfig({
              visible: true,
              title: 'Delete Drive & Alarms',
              message: `Cancel all scheduled alarms and remove ${drive.companyName}?`,
              type: 'danger',
              actions: [
                {
                  text: 'Yes, Delete & Cancel All',
                  style: 'destructive',
                  onPress: () => onCancel(drive.id),
                },
                {
                  text: 'Keep Alarms',
                  style: 'cancel',
                  onPress: () => {},
                },
              ],
            });
          }}>
          <Text style={styles.actionBtnDangerText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <DriveDetailsModal
        visible={detailsModalVisible}
        drive={drive}
        onClose={() => setDetailsModalVisible(false)}
      />

      <CustomAlertDialog
        visible={dialogConfig.visible}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        actions={dialogConfig.actions}
        onClose={() => setDialogConfig(prev => ({...prev, visible: false}))}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111A2D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderColor: '#1E2D44',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  cardExpired: {
    opacity: 0.65,
    borderColor: '#334155',
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  packageBadge: {
    backgroundColor: '#06291E',
    borderColor: '#059669',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  packageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeActive: {
    backgroundColor: '#06291E',
    borderColor: '#059669',
    borderWidth: 1,
  },
  badgeExpired: {
    backgroundColor: '#1E293B',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#34D399',
  },
  badgeTextExpired: {
    color: '#94A3B8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  titleText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  chevronBox: {
    width: 24,
    alignItems: 'flex-end',
  },
  chevronText: {
    fontSize: 22,
    color: '#64748B',
    fontWeight: '300',
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    width: 76,
  },
  infoValue: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  dualAlarmsContainer: {
    backgroundColor: '#0A101C',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A2638',
  },
  alarmStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  alarmStageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  alarmStageTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  alarmStageTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  urgentTime: {
    color: '#EF4444',
  },
  alarmRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alarmStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  cancelAlarmIconBtn: {
    backgroundColor: '#1E293B',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelAlarmIconText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  customAlarmRow: {
    borderTopWidth: 1,
    borderTopColor: '#162234',
    marginTop: 4,
    paddingTop: 6,
  },
  pillCustom: {
    backgroundColor: '#0C2A40',
    borderColor: '#0284C7',
  },
  textCustom: {
    color: '#38BDF8',
  },
  pillActive: {
    backgroundColor: '#261C08',
    borderColor: '#D97706',
  },
  pillUrgent: {
    backgroundColor: '#2E1116',
    borderColor: '#DC2626',
  },
  pillDismissed: {
    backgroundColor: '#141E2E',
    borderColor: '#334155',
  },
  alarmStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textActive: {
    color: '#FBBF24',
  },
  textUrgent: {
    color: '#F87171',
  },
  textDismissed: {
    color: '#64748B',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    alignItems: 'center',
  },
  actionBtnAccent: {
    flex: 1.3,
    backgroundColor: '#0C2337',
    borderColor: '#0284C7',
    borderWidth: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnAccentText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 12,
  },
  actionBtnSecondary: {
    flex: 1.1,
    backgroundColor: '#162236',
    borderColor: '#243750',
    borderWidth: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondaryText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  actionBtnDanger: {
    backgroundColor: '#261217',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDangerText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 12,
  },
});
