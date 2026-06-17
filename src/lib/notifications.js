import { format } from 'date-fns';

let notificationInterval = null;

export const sendNotification = (title, options) => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        ...options
      });
    }).catch(err => {
      // Fallback if no service worker
      new Notification(title, {
        icon: '/pwa-192x192.png',
        ...options
      });
    });
  }
};

export const startNotificationService = (session) => {
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }

  // Check every minute
  notificationInterval = setInterval(() => {
    checkAndSendNotifications(session);
  }, 60 * 1000);
  
  // Also run immediately
  checkAndSendNotifications(session);
};

export const stopNotificationService = () => {
  if (notificationInterval) clearInterval(notificationInterval);
};

const checkAndSendNotifications = (session) => {
  const notificationsEnabled = localStorage.getItem('noor_notifications') !== 'false';
  if (!notificationsEnabled) return;

  const now = new Date();
  const timeString = format(now, 'HH:mm');
  const dateString = format(now, 'yyyy-MM-dd');
  const dayOfWeek = now.getDay(); // 0 = Sun, 5 = Fri
  
  const userId = session?.user?.id;
  
  // Track what we've already sent today so we don't spam every minute
  const cacheKey = userId ? `noor_notif_history_${userId}_${dateString}` : `noor_notif_history_${dateString}`;
  let history = {};
  try { history = JSON.parse(localStorage.getItem(cacheKey)) || {}; } catch(e){}

  const sendOnce = (id, title, body) => {
    if (!history[id]) {
      sendNotification(title, { body });
      history[id] = true;
      localStorage.setItem(cacheKey, JSON.stringify(history));
    }
  };

  // 1. Duha Reminder (9:30 AM)
  if (timeString >= '09:30' && timeString < '11:00') {
    sendOnce('duha', 'Time for Duha', 'The sun has risen high. Take a few minutes to pray 2 Rakats of Duha!');
  }

  // 2. Evening Routine & Surah Mulk (9:00 PM)
  if (timeString >= '21:00' && timeString < '23:59') {
    sendOnce('mulk', 'Evening Routine', 'Have you read Surah Mulk yet? End your day with peace.');
  }

  // 3. Friday Kahf Reminder (Thursday 6 PM onwards or Friday)
  if (dayOfWeek === 4 && timeString >= '18:00') {
    sendOnce('kahf_thu', 'Night of Jumuah', "The night of Friday has begun. Don't forget to read Surah Kahf and increase Salawat.");
  }
  if (dayOfWeek === 5 && timeString >= '09:00' && timeString < '17:00') {
    sendOnce('kahf_fri', 'Blessed Jumuah', 'A friendly reminder to read Surah Kahf today!');
  }

  // 4. Streak Saver (8:00 PM check)
  if (timeString >= '20:00' && timeString < '23:59') {
    if (!history['streak_saver']) {
      // Calculate current score
      const localCacheKey = userId ? `worship_cache_${userId}_${dateString}` : `worship_cache_${dateString}`;
      let cachedData = {};
      try { cachedData = JSON.parse(localStorage.getItem(localCacheKey)) || {}; } catch(e){}
      
      const completedCount = Object.values(cachedData).filter(t => t.is_completed).length;
      if (completedCount < 5) {
        sendOnce('streak_saver', 'Save Your Streak! 🔥', 'You are falling behind on your daily tasks. Complete a few more to keep your streak alive!');
      } else {
        history['streak_saver'] = true; // Mark as checked so we don't alert if they already have a good score
        localStorage.setItem(cacheKey, JSON.stringify(history));
      }
    }
  }
};
