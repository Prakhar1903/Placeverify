import {NativeModules, Platform, Linking} from 'react-native';
import {Drive, PermissionStatus} from '../types';

const {PlacementAlarmModule} = NativeModules;

export const NativeAlarmBridge = {
  getInitialPermissions: (): PermissionStatus => {
    if (Platform.OS !== 'android' || !PlacementAlarmModule) {
      return {
        hasNotificationListener: true,
        canScheduleExactAlarm: true,
        hasPostNotification: true,
      };
    }
    const constants = PlacementAlarmModule.getConstants?.() || {};
    return {
      hasNotificationListener: constants.initialHasNotificationListener ?? true,
      canScheduleExactAlarm: constants.initialCanScheduleExactAlarm ?? true,
      hasPostNotification: constants.initialHasPostNotification ?? true,
    };
  },

  getInitialDrives: (): Drive[] => {
    if (Platform.OS !== 'android' || !PlacementAlarmModule) {
      return [];
    }
    const constants = PlacementAlarmModule.getConstants?.() || {};
    const raw = constants.initialDrivesJson;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  checkPermissions: async (): Promise<PermissionStatus> => {
    if (Platform.OS !== 'android' || !PlacementAlarmModule) {
      return {
        hasNotificationListener: false,
        canScheduleExactAlarm: false,
        hasPostNotification: true,
      };
    }
    return await PlacementAlarmModule.checkPermissions();
  },

  openNotificationListenerSettings: () => {
    if (PlacementAlarmModule?.openNotificationListenerSettings) {
      PlacementAlarmModule.openNotificationListenerSettings();
    } else {
      Linking.openSettings();
    }
  },

  openExactAlarmSettings: () => {
    if (PlacementAlarmModule?.openExactAlarmSettings) {
      PlacementAlarmModule.openExactAlarmSettings();
    } else {
      Linking.openSettings();
    }
  },

  getSavedDrives: async (): Promise<Drive[]> => {
    if (PlacementAlarmModule?.getSavedDrives) {
      const json = await PlacementAlarmModule.getSavedDrives();
      try {
        return JSON.parse(json);
      } catch (e) {
        return [];
      }
    }
    return [];
  },

  scheduleDriveAlarm: async (
    companyName: string,
    title: string,
    rawText: string,
    deadlineMillis: number,
    offsetHours: number,
  ): Promise<Drive | null> => {
    if (PlacementAlarmModule?.scheduleDriveAlarm) {
      const json = await PlacementAlarmModule.scheduleDriveAlarm(
        companyName,
        title,
        rawText,
        deadlineMillis,
        offsetHours,
      );
      try {
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  cancelDriveAlarm: async (id: string): Promise<boolean> => {
    if (PlacementAlarmModule?.cancelDriveAlarm) {
      return await PlacementAlarmModule.cancelDriveAlarm(id);
    }
    return false;
  },

  dismissDriveStage: async (id: string, stage: number): Promise<boolean> => {
    if (PlacementAlarmModule?.dismissDriveStage) {
      return await PlacementAlarmModule.dismissDriveStage(id, stage);
    }
    return false;
  },

  dismissAllDriveAlarms: async (id: string): Promise<boolean> => {
    if (PlacementAlarmModule?.dismissAllDriveAlarms) {
      return await PlacementAlarmModule.dismissAllDriveAlarms(id);
    }
    return false;
  },

  simulateNotification: async (
    title: string,
    text: string,
  ): Promise<Drive | null> => {
    if (PlacementAlarmModule?.simulateNotification) {
      const json = await PlacementAlarmModule.simulateNotification(title, text);
      try {
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  testRingAlarmNow: async (companyName: string) => {
    if (PlacementAlarmModule?.testRingAlarmNow) {
      PlacementAlarmModule.testRingAlarmNow(companyName);
    }
  },

  testRingAlarmStage: async (companyName: string, stage: number) => {
    if (PlacementAlarmModule?.testRingAlarmStage) {
      PlacementAlarmModule.testRingAlarmStage(companyName, stage);
    }
  },

  updateAlarmTime: async (
    driveId: string,
    newAlarmMillis: number,
    newAlarmFormatted: string,
  ): Promise<boolean> => {
    if (PlacementAlarmModule?.updateAlarmTime) {
      return await PlacementAlarmModule.updateAlarmTime(
        driveId,
        newAlarmMillis,
        newAlarmFormatted,
      );
    }
    return false;
  },

  addCustomAlarm: async (
    driveId: string,
    alarmMillis: number,
    alarmFormatted: string,
    label: string = 'Custom Alarm',
  ): Promise<boolean> => {
    if (PlacementAlarmModule?.addCustomAlarm) {
      await PlacementAlarmModule.addCustomAlarm(
        driveId,
        alarmMillis,
        alarmFormatted,
        label,
      );
      return true;
    }
    return false;
  },

  cancelIndividualAlarm: async (
    driveId: string,
    alarmKey: string,
  ): Promise<boolean> => {
    if (PlacementAlarmModule?.cancelIndividualAlarm) {
      return await PlacementAlarmModule.cancelIndividualAlarm(driveId, alarmKey);
    }
    return false;
  },

  copyToClipboard: async (text: string): Promise<boolean> => {
    if (PlacementAlarmModule?.copyToClipboard) {
      return await PlacementAlarmModule.copyToClipboard(text);
    }
    return false;
  },

  getDefaultAlarmSettings: async (): Promise<{stage1Minutes: number; stage2Minutes: number}> => {
    if (PlacementAlarmModule?.getDefaultAlarmSettings) {
      try {
        return await PlacementAlarmModule.getDefaultAlarmSettings();
      } catch (e) {
        return {stage1Minutes: 120, stage2Minutes: 60};
      }
    }
    return {stage1Minutes: 120, stage2Minutes: 60};
  },

  saveDefaultAlarmSettings: async (
    stage1Minutes: number,
    stage2Minutes: number,
    applyToUpcoming: boolean = true,
  ): Promise<number> => {
    if (PlacementAlarmModule?.saveDefaultAlarmSettings) {
      return await PlacementAlarmModule.saveDefaultAlarmSettings(
        stage1Minutes,
        stage2Minutes,
        applyToUpcoming,
      );
    }
    return 0;
  },
};
