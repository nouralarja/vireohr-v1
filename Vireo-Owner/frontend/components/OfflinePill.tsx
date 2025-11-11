import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';

interface OfflinePillProps {
  visible: boolean;
}

export default function OfflinePill({ visible }: OfflinePillProps) {
  if (!visible) return null;

  return (
    <View style={styles.pill}>
      <Ionicons name="cloud-offline" size={14} color={COLORS.white} />
      <Text style={styles.text}>Offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: SPACING.md + 40, // Below status bar
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F', // Brand red
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
});
