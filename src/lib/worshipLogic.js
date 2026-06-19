import { format, getDay } from 'date-fns';

export const generateDailyTasks = () => {
  const dayOfWeek = getDay(new Date()); // 0 = Sunday, 1 = Monday, etc.
  const isThursday = dayOfWeek === 4;
  const isFriday = dayOfWeek === 5;

  const tasks = [];

  const fardDikrItems = [
    { id: 'dikr_subhanallah', title: '33 × Subhanallah', points: 5, type: 'checkbox' },
    { id: 'dikr_alhamdulillah', title: '33 × Alhamdulillah', points: 5, type: 'checkbox' },
    { id: 'dikr_allahuakbar', title: '33 × Allahu Akbar', points: 5, type: 'checkbox' },
    { id: 'dikr_ayatulkursi', title: '1 × Ayatul Kursi', points: 10, type: 'checkbox' },
    { id: 'dikr_lailaha', title: '10 × La ilaha illallah...', points: 10, type: 'checkbox' },
    { id: 'dikr_allahumma', title: '7 × Allahumma ajirni minan nar', points: 10, type: 'checkbox' },
    { id: 'dikr_ikhlas', title: '3 × Surah Ikhlas', points: 10, type: 'checkbox' },
  ];

  // --- TAHAJJUD ---
  tasks.push({ id: 'tahajjud_prayer', category: 'Tahajjud', title: 'Tahajjud Prayer', points: 25, type: 'checkbox' });
  tasks.push({ id: 'tahajjud_istighfar', category: 'Tahajjud', title: 'Istighfar x100', points: 15, type: 'counter', target: 100, imageUrl: '/istighfar.png' });
  tasks.push({ id: 'tahajjud_salawat', category: 'Tahajjud', title: 'Salawat x100', points: 15, type: 'counter', target: 100, imageUrl: '/salawat.png' });
  tasks.push({ id: 'tahajjud_subhanallah', category: 'Tahajjud', title: 'Subhanallah x50', points: 15, type: 'counter', target: 50, imageUrl: '/tahajjud_subhanallah.png' });

  // --- FAJR ---
  tasks.push({ id: 'fajr_sunnah', category: 'Fajr', title: 'Sunnah before Fajr', points: 10, type: 'checkbox' });
  tasks.push({ id: 'fajr_fard', category: 'Fajr', title: 'Fajr Prayer', points: 10, type: 'checkbox' });
  fardDikrItems.forEach(item => tasks.push({ ...item, id: `fajr_${item.id}`, category: 'Fajr' }));

  // --- DUHA ---
  tasks.push({ id: 'duha', category: 'Duha', title: '2 Rakah Duha Prayer', points: 10, type: 'checkbox' });

  // --- DHUHR ---
  tasks.push({ id: 'dhuhr_sunnah', category: 'Dhuhr', title: 'Sunnah before/after Dhuhr', points: 10, type: 'checkbox' });
  tasks.push({ id: 'dhuhr_fard', category: 'Dhuhr', title: 'Dhuhr Prayer', points: 10, type: 'checkbox' });
  fardDikrItems.forEach(item => tasks.push({ ...item, id: `dhuhr_${item.id}`, category: 'Dhuhr' }));

  // --- ASR ---
  tasks.push({ id: 'asr_fard', category: 'Asr', title: 'Asr Prayer', points: 10, type: 'checkbox' });
  fardDikrItems.forEach(item => tasks.push({ ...item, id: `asr_${item.id}`, category: 'Asr' }));

  // --- MAGHRIB ---
  tasks.push({ id: 'maghrib_fard', category: 'Maghrib', title: 'Maghrib Prayer', points: 10, type: 'checkbox' });
  tasks.push({ id: 'maghrib_sunnah', category: 'Maghrib', title: 'Sunnah after Maghrib', points: 10, type: 'checkbox' });
  fardDikrItems.forEach(item => tasks.push({ ...item, id: `maghrib_${item.id}`, category: 'Maghrib' }));

  // --- ISHA ---
  tasks.push({ id: 'isha_fard', category: 'Isha', title: 'Isha Prayer', points: 10, type: 'checkbox' });
  tasks.push({ id: 'isha_sunnah', category: 'Isha', title: 'Sunnah after Isha', points: 10, type: 'checkbox' });
  fardDikrItems.forEach(item => tasks.push({ ...item, id: `isha_${item.id}`, category: 'Isha' }));

  // --- RECITATION ---
  if (isFriday) {
    tasks.push({ id: 'rec_kahf', category: 'Recitation', title: 'Surah Kahf', points: 15, type: 'checkbox' });
  } else {
    tasks.push({ id: 'rec_yaseen', category: 'Recitation', title: 'Surah Yaseen', points: 15, type: 'content', contentUrl: '/surah_yaseen.pdf' });
  }

  if (isThursday) {
    tasks.push({ id: 'rec_hadhad', category: 'Recitation', title: 'Hadhad', points: 15, type: 'content', contentUrl: 'https://images.unsplash.com/photo-1579294215886-ccebc8c3fa24?auto=format&fit=crop&w=800&q=80' });
  }

  tasks.push({ id: 'rec_mulk', category: 'Recitation', title: 'Surah Mulk', points: 15, type: 'content', contentUrl: '/surah_mulk.pdf' });
  tasks.push({ id: 'rec_waqiah', category: 'Recitation', title: 'Surah Waqiah', points: 15, type: 'content', contentUrl: '/surah_waqiah.pdf' });
  tasks.push({ id: 'rec_asmaul_badr', category: 'Recitation', title: 'Asmaul Badr', points: 15, type: 'content', contentUrl: '/asmaulbadr.pdf' });

  return tasks;
};

import { supabase } from './supabase';

export const syncOfflineData = async (userId) => {
  if (!userId) return;
  
  // 1. Migrate unauthenticated keys to authenticated keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('worship_cache_') && !key.includes('-') === false) {
      const datePart = key.replace('worship_cache_', '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const val = localStorage.getItem(key);
        localStorage.setItem(`worship_cache_${userId}_${datePart}`, val);
        localStorage.removeItem(key);
      }
    }
  }

  // 2. Sync all authenticated keys to Supabase
  const prefix = `worship_cache_${userId}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const dateStr = key.replace(prefix, '');
      const cachedDataStr = localStorage.getItem(key);
      if (!cachedDataStr) continue;
      const cachedData = JSON.parse(cachedDataStr);

      try {
        let { data: record } = await supabase.from('worship_records').select('*').eq('user_id', userId).eq('record_date', dateStr).maybeSingle();
        if (!record) {
          const { data: newRecord } = await supabase.from('worship_records').insert({ user_id: userId, record_date: dateStr }).select().single();
          if (!newRecord) continue;
          record = newRecord;
        }

        const { data: completions } = await supabase.from('task_completions').select('*').eq('worship_record_id', record.id);

        const tasksToSync = Object.entries(cachedData).map(([taskId, val]) => {
          if (val.is_completed || val.count_reached > 0) {
            return {
              worship_record_id: record.id,
              task_id: taskId,
              is_completed: val.is_completed || false,
              count_reached: val.count_reached || 0,
              completed_at: val.is_completed ? new Date().toISOString() : null
            };
          }
          return null;
        }).filter(Boolean);

        if (tasksToSync.length > 0) {
          await supabase.from('task_completions').upsert(tasksToSync, { onConflict: 'worship_record_id, task_id' });
        }
      } catch (err) {
        console.error("Sync error for date", dateStr, err);
      }
    }
  }
};
