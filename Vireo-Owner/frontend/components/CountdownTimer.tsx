import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../constants/theme';

interface CountdownTimerProps {
  targetTime: Date;
  onComplete?: () => void;
  prefix?: string;
}

export default function CountdownTimer({ targetTime, onComplete, prefix = 'Available in' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const target = targetTime.getTime();
      const difference = target - now;

      // Trigger exactly at 0ms
      if (difference <= 0 && !completed) {
        setTimeLeft('00:00');
        setCompleted(true);
        if (onComplete) {
          onComplete();
        }
        return;
      }

      if (difference > 0) {
        const totalSeconds = Math.ceil(difference / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        } else {
          setTimeLeft(`00:${String(seconds).padStart(2, '0')}`);
        }
      }
    };

    calculateTimeLeft();
    // Update every 100ms for precise timing
    const interval = setInterval(calculateTimeLeft, 100);

    return () => clearInterval(interval);
  }, [targetTime, onComplete, completed]);

  return (
    <View style={styles.container}>
      <Text style={styles.prefix}>{prefix}</Text>
      <Text style={styles.time}>{timeLeft}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.gold,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  prefix: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  time: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
});
