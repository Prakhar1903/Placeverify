import React, {useState, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  AppState,
  DeviceEventEmitter,
} from 'react-native';
import {Drive, PermissionStatus} from './src/types';
import {NativeAlarmBridge} from './src/services/NativeAlarmBridge';
import {PermissionBanner} from './src/components/PermissionBanner';
import {DriveCard} from './src/components/DriveCard';
import {TestNotificationModal} from './src/components/TestNotificationModal';
import {ClockPickerModal} from './src/components/ClockPickerModal';
import {SettingsModal} from './src/components/SettingsModal';

const App = () => {
  const [drives, setDrives] = useState<Drive[]>(() =>
    NativeAlarmBridge.getInitialDrives(),
  );
  const [permissions, setPermissions] = useState<PermissionStatus>(() =>
    NativeAlarmBridge.getInitialPermissions(),
  );
  const [isPermissionsLoaded, setIsPermissionsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [clockModalVisible, setClockModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [selectedDriveForClock, setSelectedDriveForClock] = useState<Drive | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [permStatus, savedDrives] = await Promise.all([
        NativeAlarmBridge.checkPermissions(),
        NativeAlarmBridge.getSavedDrives(),
      ]);
      setPermissions(permStatus);
      setIsPermissionsLoaded(true);
      const sorted = [...savedDrives].sort((a, b) => {
        const timeA = Math.max(
          a.updatedAt || 0,
          a.createdAt || 0,
          ...(a.messages || []).map(m => m.timestamp || 0),
        );
        const timeB = Math.max(
          b.updatedAt || 0,
          b.createdAt || 0,
          ...(b.messages || []).map(m => m.timestamp || 0),
        );
        return timeB - timeA;
      });
      setDrives(sorted);
    } catch (e) {
      console.error('Failed to load data', e);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Reload when app comes back to foreground (e.g. after enabling permissions)
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        loadData();
      }
    });

    // Automatically reload when a new notification or drive is merged/saved natively
    const eventSubscription = DeviceEventEmitter.addListener(
      'onDrivesUpdated',
      () => {
        loadData();
      },
    );

    return () => {
      subscription.remove();
      eventSubscription.remove();
    };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCancelAlarm = async (id: string) => {
    await NativeAlarmBridge.cancelDriveAlarm(id);
    await loadData();
  };

  const handleTestRing = (company: string, stage: number = 1) => {
    NativeAlarmBridge.testRingAlarmStage(company, stage);
  };

  const handleOpenClockPicker = (drive: Drive) => {
    setSelectedDriveForClock(drive);
    setClockModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090E1A" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.appTitle} numberOfLines={1}>
              Placement Alarms
            </Text>
            {drives.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{drives.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.settingsHeaderButton}
              activeOpacity={0.75}
              onPress={() => setSettingsModalVisible(true)}>
              <Text style={styles.settingsHeaderIcon}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.testHeaderButton}
              activeOpacity={0.75}
              onPress={() => setTestModalVisible(true)}>
              <Text style={styles.testHeaderText}>+ Test Alert</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Permission Status */}
        <PermissionBanner
          status={permissions}
          isLoaded={isPermissionsLoaded}
          onRefresh={loadData}
        />

        {/* Drives / Deadlines List */}
        <FlatList
          data={drives}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <DriveCard
              drive={item}
              onCancel={handleCancelAlarm}
              onTestRing={handleTestRing}
              onOpenClockPicker={handleOpenClockPicker}
              onRefresh={loadData}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38BDF8"
            />
          }
          ListEmptyComponent={
            isPermissionsLoaded ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyHalo}>
                  <Text style={styles.emptyIcon}>⏰</Text>
                </View>
                <Text style={styles.emptyTitle}>No Active Deadlines</Text>
                <Text style={styles.emptyDesc}>
                  Whenever you receive any message or notification with a deadline
                  (assignments, drives, exams, or fee dues), the app will
                  automatically capture it and set exact alarms for you.
                </Text>
                <TouchableOpacity
                  style={styles.simulateEmptyButton}
                  activeOpacity={0.75}
                  onPress={() => setTestModalVisible(true)}>
                  <Text style={styles.simulateEmptyText}>
                    Test with Sample Placement Drive
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />

        {/* Test Modal */}
        <TestNotificationModal
          visible={testModalVisible}
          onClose={() => setTestModalVisible(false)}
          onSuccess={loadData}
        />

        {/* Custom Clock / Alarm Time Picker Modal */}
        {selectedDriveForClock ? (
          <ClockPickerModal
            visible={clockModalVisible}
            drive={selectedDriveForClock}
            onClose={() => {
              setClockModalVisible(false);
              setSelectedDriveForClock(null);
            }}
            onSuccess={loadData}
          />
        ) : null}

        {/* Default Alarm Timings Settings Modal */}
        <SettingsModal
          visible={settingsModalVisible}
          onClose={() => setSettingsModalVisible(false)}
          onSaved={loadData}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090E1A',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#090E1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 12,
    gap: 7,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  countBadge: {
    backgroundColor: '#0C2337',
    borderColor: '#0284C7',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  settingsHeaderButton: {
    backgroundColor: '#111A2D',
    borderColor: '#1E2D44',
    borderWidth: 1,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsHeaderIcon: {
    fontSize: 17,
  },
  testHeaderButton: {
    backgroundColor: '#0C2337',
    borderColor: '#0284C7',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  testHeaderText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 12.5,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#111A2D',
    borderColor: '#1E2D44',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  simulateEmptyButton: {
    backgroundColor: '#111A2D',
    borderColor: '#0284C7',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  simulateEmptyText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default App;
