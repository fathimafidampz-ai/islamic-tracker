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

  // Helper to check if a category is missing (has any incomplete tasks)
  const isCategoryMissing = (categoryName) => {
    const localCacheKey = userId ? `worship_cache_${userId}_${dateString}` : `worship_cache_${dateString}`;
    let cachedData = {};
    try { cachedData = JSON.parse(localStorage.getItem(localCacheKey)) || {}; } catch(e){}
    
    // We only have the cache of completed tasks. We need to see if they completed the fard prayer of that category.
    // Instead of importing generateDailyTasks, we can check for common task IDs.
    const completedKeys = Object.keys(cachedData).filter(k => cachedData[k].is_completed);
    
    if (categoryName === 'Tahajjud') return !completedKeys.some(k => k.includes('tahajjud'));
    if (categoryName === 'Fajr') return !completedKeys.some(k => k.includes('fajr'));
    if (categoryName === 'Duha') return !completedKeys.some(k => k.includes('duha'));
    if (categoryName === 'Dhuhr') return !completedKeys.some(k => k.includes('dhuhr'));
    if (categoryName === 'Asr') return !completedKeys.some(k => k.includes('asr'));
    if (categoryName === 'Maghrib') return !completedKeys.some(k => k.includes('maghrib'));
    if (categoryName === 'Isha') return !completedKeys.some(k => k.includes('isha'));
    if (categoryName === 'Recitation') return !completedKeys.some(k => k.includes('rec_'));
    
    return true; // Default to sending if we can't determine
  };

  // 1. Tahajjud: 4:25am
  if (timeString >= '04:25' && timeString < '05:00' && isCategoryMissing('Tahajjud')) {
    sendOnce('tahajjud', 'Tahajjud Reminder', "You haven't prayed Tahajjud yet! The last third of the night is passing. Wake up and earn immense rewards.");
  }

  // 2. Fajr: 5:40am
  if (timeString >= '05:40' && timeString < '07:00' && isCategoryMissing('Fajr')) {
    sendOnce('fajr', 'Fajr Reminder', "You haven't prayed Fajr yet! Prayer is better than sleep. Don't miss your morning prayer.");
  }

  // 3. Duha: 8:00am
  if (timeString >= '08:00' && timeString < '11:00' && isCategoryMissing('Duha')) {
    sendOnce('duha', 'Duha Reminder', "You haven't prayed Duha yet! The sun has risen high. Take a few minutes to pray 2 Rakats.");
  }

  // 4. Dhuhr: 1:00pm
  if (timeString >= '13:00' && timeString < '15:00' && isCategoryMissing('Dhuhr')) {
    sendOnce('dhuhr', 'Dhuhr Reminder', "You haven't prayed Dhuhr yet! Take a break from your day and establish your prayer.");
  }

  // 5. Asr: 5:00pm
  if (timeString >= '17:00' && timeString < '18:30' && isCategoryMissing('Asr')) {
    sendOnce('asr', 'Asr Reminder', "You haven't prayed Asr yet! Guard your Asr prayer strictly and do not delay it.");
  }

  // 6. Maghrib: 7:10pm
  if (timeString >= '19:10' && timeString < '20:00' && isCategoryMissing('Maghrib')) {
    sendOnce('maghrib', 'Maghrib Reminder', "You haven't prayed Maghrib yet! The day has ended, don't delay your prayer.");
  }

  // 7. Recitations: 7:30pm
  if (timeString >= '19:30' && timeString < '23:59' && isCategoryMissing('Recitation')) {
    sendOnce('recitation', 'Recitation Reminder', "You haven't completed your daily Surah recitations yet! Take some time to read the Quran.");
  }

  // 8. Isha: 9:30pm
  if (timeString >= '21:30' && timeString < '23:59' && isCategoryMissing('Isha')) {
    sendOnce('isha', 'Isha Reminder', "You haven't prayed Isha yet! End your day correctly before going to sleep.");
  }

  // 9. Surah Kahf (Thursday night): 6:00pm
  if (dayOfWeek === 4 && timeString >= '18:00' && timeString < '23:59') {
    // Only remind if they haven't marked Surah Kahf
    const localCacheKey = userId ? `worship_cache_${userId}_${dateString}` : `worship_cache_${dateString}`;
    let cachedData = {};
    try { cachedData = JSON.parse(localStorage.getItem(localCacheKey)) || {}; } catch(e){}
    const isKahfMissing = !Object.keys(cachedData).some(k => k.includes('kahf') && cachedData[k].is_completed);

    if (isKahfMissing) {
      sendOnce('kahf_thu', 'Surah Kahf Reminder', "You haven't read Surah Kahf yet! The night of Friday has begun, don't forget to recite it.");
    }
  }

  // 10. Friday morning: 6:00am
  if (dayOfWeek === 5 && timeString >= '06:00' && timeString < '12:00') {
    sendOnce('jumuah_morning', 'Jumuah Reminder', "You haven't prepared for Jumuah yet! Perform Ghusl, use Siwak, and ensure you recite Surah Kahf.");
  }
};
