export interface CustomAlarm {
  id: string;
  label: string;
  timeMillis: number;
  formattedTime: string;
  isDismissed: boolean;
}

export interface DriveMessage {
  id: string;
  text: string;
  timestamp: number;
}

export interface Drive {
  id: string;
  companyName: string;
  title: string;
  rawText: string;
  packageInfo?: string;
  messages?: DriveMessage[];
  deadlineMillis: number;
  deadlineFormatted: string;
  alarmMillis: number;
  alarmFormatted: string;
  alarm1Millis?: number;
  alarm1Formatted?: string;
  alarm1Dismissed?: boolean;
  alarm2Millis?: number;
  alarm2Formatted?: string;
  alarm2Dismissed?: boolean;
  customAlarms?: CustomAlarm[];
  status: 'scheduled' | 'alarmed' | 'dismissed' | 'active';
  offsetHours: number;
  category?: string;
  portalUrl?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface PermissionStatus {
  hasNotificationListener: boolean;
  canScheduleExactAlarm: boolean;
  hasPostNotification: boolean;
}

export interface AppSettings {
  offsetHours: number; // e.g. 2 hours before
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  customPortalUrl: string;
}
