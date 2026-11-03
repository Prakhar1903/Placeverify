import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  SafeAreaView,
} from 'react-native';
import {Drive} from '../types';
import {NativeAlarmBridge} from '../services/NativeAlarmBridge';
import {CustomAlertDialog} from './CustomAlertDialog';

interface Props {
  visible: boolean;
  drive: Drive | null;
  onClose: () => void;
}

export const DriveDetailsModal: React.FC<Props> = ({visible, drive, onClose}) => {
  const [copied, setCopied] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'danger';
  }>({
    visible: false,
    title: '',
    message: '',
  });

  if (!drive) return null;

  // Extract all URLs from all notification texts
  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    return matches ? Array.from(new Set(matches)) : [];
  };

  const allText = [
    ...(drive.messages && drive.messages.length > 0
      ? drive.messages.map(m => m.text)
      : [drive.rawText]),
  ].join('\n\n');

  const links = extractUrls(allText);

  const handleCopy = async () => {
    try {
      await NativeAlarmBridge.copyToClipboard(allText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      setAlertConfig({
        visible: true,
        title: 'Copy Failed',
        message: e?.message || 'Unable to copy text',
        type: 'danger',
      });
    }
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch(err => {
      setAlertConfig({
        visible: true,
        title: 'Link Error',
        message: 'Could not open link: ' + err.message,
        type: 'danger',
      });
    });
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const messagesList =
    drive.messages && drive.messages.length > 0
      ? drive.messages
      : [{id: 'raw_1', text: drive.rawText, timestamp: drive.createdAt}];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{flex: 1}}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {drive.companyName}
            </Text>
            <Text style={styles.headerSubtitle}>
              {drive.category || 'Placement Drive'} • Details & Updates
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Key Metrics Row */}
          <View style={styles.metaRow}>
            {drive.packageInfo ? (
              <View style={styles.packageCard}>
                <Text style={styles.metaCardLabel}>PACKAGE / CTC</Text>
                <Text style={styles.packageValue}>
                  ₹ {drive.packageInfo.replace(/💰/g, '').replace(/₹/g, '').trim()}
                </Text>
              </View>
            ) : null}

            <View style={[styles.deadlineCard, !drive.packageInfo && {flex: 1}]}>
              <Text style={styles.metaCardLabel}>DEADLINE</Text>
              <Text style={styles.deadlineValue}>
                {drive.deadlineMillis > 0
                  ? drive.deadlineFormatted
                  : 'Pending / TBA'}
              </Text>
            </View>
          </View>

          {/* Quick Actions Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, copied && styles.actionBtnSuccess]}
              activeOpacity={0.75}
              onPress={handleCopy}>
              <Text style={styles.actionBtnText}>
                {copied ? '✓ Copied to Clipboard' : 'Copy Full Details'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Extracted Links Section */}
          {links.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detected Portals & Links</Text>
              {links.map((link, idx) => (
                <TouchableOpacity
                  key={`link_${idx}`}
                  style={styles.linkCard}
                  activeOpacity={0.75}
                  onPress={() => handleOpenLink(link)}>
                  <Text style={styles.linkText} numberOfLines={2}>
                    {link}
                  </Text>
                  <Text style={styles.linkActionBadge}>Open ↗</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Message History */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Notification History ({messagesList.length})
              </Text>
              <Text style={styles.sectionCountText}>
                {messagesList.length > 1
                  ? 'Merged across updates'
                  : 'Original announcement'}
              </Text>
            </View>

            {messagesList.map((msg, index) => (
              <View key={msg.id || `msg_${index}`} style={styles.msgCard}>
                <View style={styles.msgCardHeader}>
                  <Text style={styles.msgIndexBadge}>
                    Update #{index + 1}
                  </Text>
                  <Text style={styles.msgTimestamp}>
                    {formatTimestamp(msg.timestamp)}
                  </Text>
                </View>
                <Text style={styles.msgContent} selectable={true}>
                  {msg.text || 'No message content'}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <CustomAlertDialog
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type || 'info'}
          useModal={false}
          actions={[
            {
              text: 'OK',
              style: 'default',
              onPress: () => setAlertConfig(prev => ({...prev, visible: false})),
            },
          ]}
          onClose={() => setAlertConfig(prev => ({...prev, visible: false}))}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090E1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2638',
    backgroundColor: '#090E1A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111A2D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E2D44',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#F1F5F9',
    fontWeight: 'bold',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  packageCard: {
    flex: 1,
    backgroundColor: '#06291E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#059669',
  },
  metaCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  packageValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ECFDF5',
  },
  deadlineCard: {
    flex: 1,
    backgroundColor: '#111A2D',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2D44',
  },
  deadlineValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSuccess: {
    backgroundColor: '#10B981',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  sectionCountText: {
    fontSize: 12,
    color: '#64748B',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1E36',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  linkText: {
    flex: 1,
    color: '#60A5FA',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  linkActionBadge: {
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  msgCard: {
    backgroundColor: '#111A2D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2D44',
  },
  msgCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2D44',
    paddingBottom: 6,
  },
  msgIndexBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#38BDF8',
    backgroundColor: '#0C2337',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  msgTimestamp: {
    fontSize: 12,
    color: '#64748B',
  },
  msgContent: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
  },
});
