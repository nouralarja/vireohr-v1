import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

const OVERTIME_CHECK_TASK = 'OVERTIME_CHECK_TASK';

// Define the background task
TaskManager.defineTask(OVERTIME_CHECK_TASK, async () => {
  try {
    // This would be triggered 30 minutes after shift end
    // In production, this should call an API endpoint that checks
    // if employees are still clocked in and sends notifications
    console.log('Background overtime check triggered');
    
    // Return success
    return {
      result: 'success',
    };
  } catch (error) {
    console.error('Overtime check task error:', error);
    return {
      result: 'error',
    };
  }
});

/**
 * Schedule a local notification to check overtime status
 * This is a simplified version - in production, use a backend cron job
 */
export async function scheduleOvertimeCheckNotification(
  employeeName: string,
  storeName: string,
  delayInMinutes: number = 30
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Overtime Alert',
        body: `${employeeName} is still clocked in at ${storeName}`,
        data: { type: 'overtime_check', employeeName, storeName },
        sound: true,
      },
      trigger: {
        seconds: delayInMinutes * 60,
      },
    });
    
    console.log(`Scheduled overtime check notification in ${delayInMinutes} minutes`);
  } catch (error) {
    console.error('Error scheduling overtime notification:', error);
  }
}

/**
 * Schedule a shift reminder notification
 */
export async function scheduleShiftReminder(
  shiftStartTime: Date,
  storeName: string,
  minutesBefore: number = 15
) {
  try {
    const triggerTime = new Date(shiftStartTime.getTime() - minutesBefore * 60000);
    const now = new Date();
    
    if (triggerTime <= now) {
      console.log('Shift reminder time has already passed');
      return;
    }
    
    const secondsUntilNotification = Math.floor((triggerTime.getTime() - now.getTime()) / 1000);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🕐 Shift Reminder',
        body: `Your shift at ${storeName} starts in ${minutesBefore} minutes`,
        data: { type: 'shift_reminder', storeName },
        sound: true,
      },
      trigger: {
        seconds: secondsUntilNotification,
      },
    });
    
    console.log(`Scheduled shift reminder for ${triggerTime.toISOString()}`);
  } catch (error) {
    console.error('Error scheduling shift reminder:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Canceled all scheduled notifications');
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}

/**
 * Cancel specific notification by identifier
 */
export async function cancelNotification(notificationId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Canceled notification: ${notificationId}`);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

/**
 * Send immediate push notification to owner about leave request
 */
export async function sendLeaveRequestNotification(
  ownerPushToken: string,
  employeeName: string,
  leaveDate: string
) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: ownerPushToken,
        sound: 'default',
        title: '📝 New Leave Request',
        body: `${employeeName} requested leave for ${leaveDate}`,
        data: { type: 'leave_request', employeeName, leaveDate },
      }),
    });
    
    console.log('Sent leave request notification to owner');
  } catch (error) {
    console.error('Error sending leave request notification:', error);
  }
}
