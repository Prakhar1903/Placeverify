import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {PermissionStatus} from '../types';
import {NativeAlarmBridge} from '../services/NativeAlarmBridge';

interface Props {
  status: PermissionStatus;
  isLoaded?: boolean;
  onRefresh: () => void;
}

export const PermissionBanner: React.FC<Props> = ({
  status,
  isLoaded = true,
  onRefresh,
}) => {
  if (status.hasNotificationListener && status.canScheduleExactAlarm) {
    return (
      <View style={styles.activeContainer}>
        <View style={styles.dot} />
        <Text style={styles.activeText} numberOfLines={1} ellipsizeMode="tail">
          LPU Touch Listener Active
        </Text>
        <View style={styles.activeTag}>
          <Text style={styles.activeTagText}>Auto-Sync</Text>
        </View>
      </View>
    );
  }

  // Prevent flash of setup warning while asynchronous permission verification is running
  if (!isLoaded) {
    return null;
  }

  return (
    <View style={styles.warningContainer}>
      <Text style={styles.warningTitle}>Setup Required</Text>
      <Text style={styles.warningDesc}>
        Android requires two permissions so this app can detect placement
        notifications and ring alarms on time.
      </Text>

      {!status.hasNotificationListener && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            NativeAlarmBridge.openNotificationListenerSettings();
            setTimeout(onRefresh, 1500);
          }}>
          <Text style={styles.actionButtonText}>
            1. Enable Notification Access
          </Text>
        </TouchableOpacity>
      )}

      {!status.canScheduleExactAlarm && (
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => {
            NativeAlarmBridge.openExactAlarmSettings();
            setTimeout(onRefresh, 1500);
          }}>
          <Text style={styles.actionButtonText}>
            2. Enable Exact Alarm Permission
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  activeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06261B',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  activeText: {
    flex: 1,
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTag: {
    backgroundColor: '#0A3D2C',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  activeTagText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
  },
  warningContainer: {
    backgroundColor: '#3B1818',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningTitle: {
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  warningDesc: {
    color: '#FEE2E2',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButton: {
    backgroundColor: '#B91C1C',
    marginBottom: 0,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
