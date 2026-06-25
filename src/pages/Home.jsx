import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { generateDailyTasks } from '../lib/worshipLogic';
import { format } from 'date-fns';
import { CheckCircle2, Circle, ChevronRight, X, RefreshCw, Plus, Bell, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendNotification } from '../lib/notifications';
import { getBenefitsForTask } from '../lib/benefitsData';

const PDFPage = ({ pdf, pageNum, scale, containerWidth }) => {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [aspectRatio, setAspectRatio] = useState(1.414);

  useEffect(() => {
    let active = true;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (!active) return;
        
        const viewport = page.getViewport({ scale: 1.0 });
        const ratio = viewport.height / viewport.width;
        setAspectRatio(ratio);

        if (!canvasRef.current) return;

        const widthScale = containerWidth / viewport.width;
        const finalScale = widthScale * scale;
        const scaledViewport = page.getViewport({ scale: finalScale });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        const dpr = window.devicePixelRatio || 1;
        const dprScale = Math.min(dpr, 2.5); // Cap to 2.5 to save memory but guarantee retina clarity
        
        canvas.width = scaledViewport.width * dprScale;
        canvas.height = scaledViewport.height * dprScale;

        // Reset transform and scale the context
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(dprScale, dprScale);

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdf, pageNum, scale, containerWidth]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${containerWidth * scale}px`,
        height: `${containerWidth * scale * aspectRatio}px`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: '#ffffff',
        display: 'block'
      }}
    />
  );
};

const PDFViewer = ({ url }) => {
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(350);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    
    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Ensure pdfjsLib is loaded locally from the public folder
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/pdf.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error("Failed to load PDF viewer library"));
            document.head.appendChild(script);
          });
        }
        
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        
        const loadingTask = pdfjsLib.getDocument(url);
        const loadedPdf = await loadingTask.promise;
        
        if (!active) return;

        setPdf(loadedPdf);
        setLoading(false);
      } catch (err) {
        console.error("PDF Load Error:", err);
        if (active) {
          setError(err.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    };
    
    loadPdf();
    
    return () => {
      active = false;
    };
  }, [url]);

  // Adjust container width on mount and window resize
  useEffect(() => {
    if (!pdf) return;
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const calculatedWidth = width > 20 ? width - 16 : Math.min(window.innerWidth - 16, 500);
        setContainerWidth(calculatedWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [pdf]);

  // Reset scroll position to top when PDF or scale changes
  useEffect(() => {
    if (pdf) {
      const timers = [
        setTimeout(() => {
          if (containerRef.current) containerRef.current.scrollTop = 0;
        }, 5),
        setTimeout(() => {
          if (containerRef.current) containerRef.current.scrollTop = 0;
        }, 100),
        setTimeout(() => {
          if (containerRef.current) containerRef.current.scrollTop = 0;
        }, 300)
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [pdf, scale]);

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', color: 'var(--text-main)' }}>
        <div style={{ 
          border: '4px solid rgba(255,255,255,0.1)', 
          borderLeft: '4px solid var(--primary)', 
          borderRadius: '50%', 
          width: '36px', 
          height: '36px', 
          animation: 'spin 1s linear infinite', 
          marginBottom: '16px' 
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ color: 'var(--text-muted)' }}>Loading PDF / ലോഡ് ചെയ്യുന്നു...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        <p>{error}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '12px', padding: '8px 16px', background: 'var(--primary)', color: '#ffffff', borderRadius: '8px', textDecoration: 'none' }}>
          Open PDF Directly / നേരിട്ട് തുറക്കുക
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Controls Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--glass-border)',
        gap: '12px',
        flexShrink: 0
      }}>
        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={zoomOut}
            disabled={scale <= 0.5}
            style={{
              background: 'var(--bg-darker)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              opacity: scale <= 0.5 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          
          <span 
            onClick={resetZoom}
            style={{ 
              fontSize: '0.85rem', 
              color: 'var(--text-main)', 
              fontWeight: '600', 
              minWidth: '45px', 
              textAlign: 'center',
              cursor: 'pointer'
            }}
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </span>

          <button 
            onClick={zoomIn}
            disabled={scale >= 3.0}
            style={{
              background: 'var(--bg-darker)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              opacity: scale >= 3.0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Download Button */}
        <a 
          href={url} 
          download 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--primary)',
            color: '#ffffff',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.85rem',
            fontWeight: '600',
            textDecoration: 'none',
            cursor: 'pointer'
          }}
          title="Download PDF"
        >
          <Download size={16} /> Download
        </a>
      </div>

      {/* Pages Container */}
      <div 
        ref={containerRef} 
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: scale > 1.0 ? 'flex-start' : 'center', 
          gap: '12px', 
          padding: '8px',
          background: 'var(--bg-darker)'
        }}
      >
        {Array.from({ length: pdf ? pdf.numPages : 0 }, (_, i) => (
          <PDFPage 
            key={i + 1} 
            pdf={pdf} 
            pageNum={i + 1} 
            scale={scale} 
            containerWidth={containerWidth} 
          />
        ))}
      </div>
    </div>
  );
};

const Home = ({ session }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isOffline, setIsOffline] = useState(() => {
    return !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
  });

  // Modal State
  const [activeTask, setActiveTask] = useState(null);
  const [counterValue, setCounterValue] = useState(0);
  const [showBenefits, setShowBenefits] = useState(false);
  const modalRef = useRef(null);

  // Reset modal scroll to top when activeTask or showBenefits changes
  useEffect(() => {
    if (activeTask) {
      const timer = setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.scrollTop = 0;
        }
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    } else {
      setShowBenefits(false);
    }
  }, [activeTask, showBenefits]);
  const [showNotifBanner, setShowNotifBanner] = useState(() => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return false;
    return localStorage.getItem('noor_dismissed_notif_banner') !== 'true';
  });

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('noor_notifications', 'true');
      sendNotification('Notifications Activated 🌙', {
        body: 'Alhamdulillah, you will receive reminders for prayer times and daily recitations.'
      });
    } else {
      localStorage.setItem('noor_notifications', 'false');
    }
    setShowNotifBanner(false);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const benefits = activeTask ? getBenefitsForTask(activeTask.id) : null;

  // Auto-complete counter when target is reached
  useEffect(() => {
    if (activeTask && activeTask.type === 'counter' && counterValue >= activeTask.target) {
      const timer = setTimeout(() => {
        submitModalTask();
      }, 500); // 500ms delay so user sees they hit the goal
      return () => clearTimeout(timer);
    }
  }, [counterValue, activeTask]);

  // Reset sub-state/modal when Home/Worship nav is clicked again
  useEffect(() => {
    const handleNavClickEvent = (e) => {
      if (e.detail?.path === '/') {
        setActiveTask(null);
      }
    };
    window.addEventListener('nav-click', handleNavClickEvent);
    return () => window.removeEventListener('nav-click', handleNavClickEvent);
  }, []);

  const fetchTodayData = async () => {
    const generatedTasks = generateDailyTasks();
    const userId = session?.user?.id;
    
    // Load from local storage as a primary fallback
    const localCacheKey = userId ? `worship_cache_${userId}_${todayStr}` : `worship_cache_${todayStr}`;
    const cachedDataStr = localStorage.getItem(localCacheKey);
    let cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : {};

    if (!userId || isOffline) {
      // If no user, just use local storage
      const fallbackTasks = generatedTasks.map(task => ({
        ...task,
        is_completed: cachedData[task.id]?.is_completed || false,
        count_reached: cachedData[task.id]?.count_reached || 0
      }));
      setTasks(fallbackTasks);
      calculateProgress(fallbackTasks);
      setLoading(false);
      return;
    }

    try {
      let { data: record, error: selectError } = await supabase.from('worship_records').select('*').eq('user_id', userId).eq('record_date', todayStr).maybeSingle();
      if (selectError) throw selectError;

      if (!record) {
        const { data: newRecord, error: insertError } = await supabase.from('worship_records').insert({ user_id: userId, record_date: todayStr }).select().single();
        if (insertError) throw insertError;
        record = newRecord;
      }

      const { data: completions, error: compError } = await supabase.from('task_completions').select('*').eq('worship_record_id', record.id);
      if (compError) throw compError;

      const tasksToSync = [];
      const tasksToDelete = [];
      const merged = generatedTasks.map(task => {
        const dbState = completions?.find(c => c.task_id === task.id);
        const cacheState = cachedData[task.id];
        
        const cacheIsCompleted = cacheState?.is_completed || false;
        const cacheCountReached = cacheState?.count_reached || 0;
        
        const dbIsCompleted = dbState?.is_completed || false;
        const dbCountReached = dbState?.count_reached || 0;
        
        const isCompleted = cacheState ? cacheIsCompleted : dbIsCompleted;
        const countReached = cacheState ? cacheCountReached : dbCountReached;

        if (cacheState) {
          if (cacheIsCompleted || cacheCountReached > 0) {
            if (!dbState || dbIsCompleted !== cacheIsCompleted || dbCountReached !== cacheCountReached) {
              tasksToSync.push({
                worship_record_id: record.id,
                task_id: task.id,
                is_completed: cacheIsCompleted,
                count_reached: cacheCountReached,
                completed_at: cacheIsCompleted ? (dbState?.completed_at || new Date().toISOString()) : null
              });
            }
          } else {
            if (dbState) {
              tasksToDelete.push(task.id);
            }
          }
        }
        
        return {
          ...task,
          worship_record_id: record.id,
          is_completed: isCompleted,
          count_reached: countReached,
        };
      });

      setTasks(merged);
      calculateProgress(merged);
      setIsOffline(false);

      if (tasksToSync.length > 0) {
        const { error: syncError } = await supabase.from('task_completions')
          .upsert(tasksToSync, { onConflict: 'worship_record_id, task_id' });
        if (syncError) {
          console.error("Error syncing cache tasks to DB:", syncError);
        } else {
          console.log(`Synced ${tasksToSync.length} cache tasks to DB`);
          broadcastUpdate();
        }
      }

      if (tasksToDelete.length > 0) {
        const { error: deleteError } = await supabase.from('task_completions')
          .delete()
          .eq('worship_record_id', record.id)
          .in('task_id', tasksToDelete);
        if (deleteError) {
          console.error("Error deleting tasks from DB:", deleteError);
        } else {
          console.log(`Deleted ${tasksToDelete.length} tasks from DB`);
          broadcastUpdate();
        }
      }
    } catch (err) {
      console.error("DB Error:", err);
      setIsOffline(true);
      // Fallback heavily to local storage if DB fails due to mock auth
      const fallbackTasks = generatedTasks.map(task => ({
        ...task,
        is_completed: cachedData[task.id]?.is_completed || false,
        count_reached: cachedData[task.id]?.count_reached || 0
      }));
      setTasks(fallbackTasks);
      calculateProgress(fallbackTasks);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (currentTasks) => {
    const total = currentTasks.length;
    const completed = currentTasks.filter(t => t.is_completed).length;
    setProgress(total === 0 ? 0 : Math.round((completed / total) * 100));
  };

  // Initialize a broadcast channel
  const [broadcastChannel, setBroadcastChannel] = useState(null);

  useEffect(() => {
    fetchTodayData();

    // Ensure we clean up any pre-existing channel of the same name first
    const existingChannel = supabase.getChannels().find(c => c.topic === 'realtime:admin_realtime');
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase.channel('admin_realtime', {
      config: {
        broadcast: { self: true }
      }
    })
    .on('broadcast', { event: 'task_update' }, () => {
      fetchTodayData();
    });
    channel.subscribe();
    setBroadcastChannel(channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const broadcastUpdate = () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.send({
          type: 'broadcast',
          event: 'task_update',
          payload: {}
        });
      } catch (err) {
        console.error("Broadcast error:", err);
      }
    }
  };

  const toggleTask = async (task, forcedValue = null) => {
    const newVal = forcedValue !== null ? forcedValue : !task.is_completed;
    const currentCount = task.type === 'counter' ? (forcedValue ? task.target : 0) : 0;
    
    // Optimistic UI Update
    const newTasks = tasks.map(t => t.id === task.id ? { ...t, is_completed: newVal, count_reached: currentCount } : t);
    setTasks(newTasks);
    calculateProgress(newTasks);

    // Save to LocalStorage immediately
    const userId = session?.user?.id;
    const localCacheKey = userId ? `worship_cache_${userId}_${todayStr}` : `worship_cache_${todayStr}`;
    const existingCache = JSON.parse(localStorage.getItem(localCacheKey) || '{}');
    existingCache[task.id] = { is_completed: newVal, count_reached: currentCount };
    localStorage.setItem(localCacheKey, JSON.stringify(existingCache));

    // Try DB Update
    let recordId = task.worship_record_id;
    if (!recordId && userId && !isOffline) {
      try {
        let { data: record } = await supabase.from('worship_records').select('*').eq('user_id', userId).eq('record_date', todayStr).maybeSingle();
        if (!record) {
          const { data: newRecord } = await supabase.from('worship_records').insert({ user_id: userId, record_date: todayStr }).select().single();
          record = newRecord;
        }
        if (record) {
          recordId = record.id;
          // Update tasks in local state with resolved record id
          setTasks(prev => prev.map(t => ({ ...t, worship_record_id: record.id })));
        }
      } catch (e) {
        console.error("Failed to dynamically create/fetch worship record:", e);
      }
    }

    if (recordId) {
      if (newVal) {
        const { error } = await supabase.from('task_completions').upsert({
          worship_record_id: recordId,
          task_id: task.id,
          is_completed: newVal,
          count_reached: currentCount,
          completed_at: new Date().toISOString()
        }, { onConflict: 'worship_record_id, task_id' });
        
        if (error) {
          console.error("UPSERT ERROR:", error);
          alert("DB Error: " + error.message);
        }
      } else {
        const { error } = await supabase.from('task_completions').delete()
          .eq('worship_record_id', recordId)
          .eq('task_id', task.id);
          
        if (error) {
          console.error("DELETE ERROR:", error);
        }
      }
      broadcastUpdate();
    }
  };

  const handleTaskAction = (task) => {
    if (task.is_completed) {
      toggleTask(task, false); // Allow unchecking directly
      return;
    }

    const hasBenefits = getBenefitsForTask(task.id);

    if (task.type === 'counter' || task.type === 'content' || hasBenefits) {
      setActiveTask(task);
      if (task.type === 'counter') {
        setCounterValue(task.count_reached || 0);
      }
      if (task.type === 'checkbox' && hasBenefits) {
        setShowBenefits(true);
      } else {
        setShowBenefits(false);
      }
    } else {
      toggleTask(task);
    }
  };

  const updateCounterProgress = async (newCount) => {
    setCounterValue(newCount);
    
    // Update local state so background list updates instantly
    const newTasks = tasks.map(t => t.id === activeTask.id ? { ...t, count_reached: newCount } : t);
    setTasks(newTasks);

    // Save to LocalStorage immediately
    const userId = session?.user?.id;
    const localCacheKey = userId ? `worship_cache_${userId}_${todayStr}` : `worship_cache_${todayStr}`;
    const existingCache = JSON.parse(localStorage.getItem(localCacheKey) || '{}');
    const existingEntry = existingCache[activeTask.id] || { is_completed: false };
    existingCache[activeTask.id] = { ...existingEntry, count_reached: newCount };
    localStorage.setItem(localCacheKey, JSON.stringify(existingCache));

    // Try DB Update
    if (activeTask.worship_record_id) {
      try {
        if (newCount === 0 && !existingEntry.is_completed) {
          await supabase.from('task_completions').delete()
            .eq('worship_record_id', activeTask.worship_record_id)
            .eq('task_id', activeTask.id);
        } else {
          await supabase.from('task_completions').upsert({
            worship_record_id: activeTask.worship_record_id,
            task_id: activeTask.id,
            count_reached: newCount,
            is_completed: existingEntry.is_completed // Preserve existing completion status
          }, { onConflict: 'worship_record_id, task_id' });
        }
        broadcastUpdate();
      } catch (err) {
        console.error("Failed to update counter in DB:", err);
      }
    }
  };

  const submitModalTask = () => {
    toggleTask(activeTask, true);
    setActiveTask(null);
  };

  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = [];
    acc[task.category].push(task);
    return acc;
  }, {});

  if (loading) return <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <div className="page-container animate-in">
      {isOffline && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <strong>⚠️ Disconnected from Database (Offline Mode)</strong>
          <span>Your progress is saved locally, but cloud sync and Analytics are unavailable. Please check your internet connection or Vercel Environment Variables.</span>
        </div>
      )}
      {showNotifBanner && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          color: 'var(--text-main)',
          padding: '16px',
          borderRadius: '16px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative'
        }}>
          <button 
            onClick={() => {
              localStorage.setItem('noor_dismissed_notif_banner', 'true');
              setShowNotifBanner(false);
            }} 
            style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingRight: '20px' }}>
            <Bell size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Enable Worship Reminders?</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                Receive notifications for prayer times, Surah recitations, and Friday Jumuah prep.
              </span>
            </div>
          </div>
          <button 
            className="btn-primary" 
            style={{ padding: '10px 16px', fontSize: '0.85rem', alignSelf: 'flex-start', boxShadow: 'none' }}
            onClick={requestNotifPermission}
          >
            Enable Notifications
          </button>
        </div>
      )}
      <header style={{ marginBottom: '30px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{format(new Date(), 'EEEE, dd MMMM')}</p>
        <h1 style={{ fontSize: '2rem', marginTop: '4px' }}>Today's Worship</h1>
      </header>
      
      <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Daily Progress</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{progress === 100 ? 'Alhamdulillah, target met!' : 'Keep going, you\'re doing great!'}</p>
        </div>
        <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--glass-border)" strokeWidth="3" />
            <motion.path 
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="var(--primary)" strokeWidth="3" 
              strokeDasharray={`${progress}, 100`}
              initial={{ strokeDasharray: "0, 100" }} animate={{ strokeDasharray: `${progress}, 100` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <span style={{ position: 'absolute', fontSize: '0.85rem', fontWeight: 'bold' }}>{progress}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {Object.entries(groupedTasks).map(([category, catTasks]) => (
          <div key={category}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--text-muted)' }}>{category}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {catTasks.map(task => (
                <div 
                  key={task.id} className="glass-panel" 
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'all 0.2s',
                    border: task.is_completed ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    background: task.is_completed ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-card)'
                  }}
                  onClick={() => handleTaskAction(task)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div onClick={(e) => { e.stopPropagation(); toggleTask(task); }}>
                      {task.is_completed ? <CheckCircle2 color="var(--primary)" size={24} /> : <Circle color="var(--text-muted)" size={24} />}
                    </div>
                    <span style={{ fontSize: '1.05rem', color: 'var(--text-main)', textDecoration: task.is_completed ? 'line-through' : 'none', opacity: task.is_completed ? 0.7 : 1 }}>
                      {task.title}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getBenefitsForTask(task.id) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTask(task);
                          setShowBenefits(true);
                        }}
                        style={{ 
                          background: 'rgba(59, 130, 246, 0.1)', 
                          border: '1px solid rgba(59, 130, 246, 0.3)', 
                          color: 'var(--primary)', 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem', 
                          fontWeight: '600', 
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        Benefits
                      </button>
                    )}
                    
                    {task.type === 'counter' && !task.is_completed && (
                      <div style={{ 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        border: '1px solid rgba(59, 130, 246, 0.3)', 
                        color: 'var(--primary)', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: '600', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        {task.count_reached || 0}/{task.target} <ChevronRight size={14} />
                      </div>
                    )}
                    {task.type === 'content' && !task.is_completed && (
                      <div style={{ 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        border: '1px solid rgba(59, 130, 246, 0.3)', 
                        color: 'var(--primary)', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: '600', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        Open <ChevronRight size={14} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* OVERLAY MODAL */}
      {createPortal(
        <AnimatePresence>
          {activeTask && (
            <motion.div 
              ref={modalRef}
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              style={{ 
                position: 'fixed', 
                inset: 0, 
                background: showBenefits ? '#ffffff' : 'var(--bg-darker)', 
                zIndex: 200, 
                display: 'flex', 
                flexDirection: 'column', 
                padding: (activeTask.type === 'content' && !showBenefits) ? '0px' : '24px', 
                overflowY: (activeTask.type === 'content' && !showBenefits) ? 'hidden' : 'auto',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {showBenefits && benefits ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', color: '#000000' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>{benefits.title}</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(activeTask.type === 'content' || activeTask.type === 'counter') && (
                        <button 
                          onClick={() => setShowBenefits(false)}
                          style={{ background: 'var(--primary)', border: 'none', color: '#ffffff', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                        >
                          {activeTask.type === 'content' ? 'Open PDF' : 'Open Counter'}
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setShowBenefits(false);
                          setActiveTask(null);
                        }} 
                        style={{ background: '#f3f4f6', border: 'none', color: '#374151', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                      >
                        Close / മടങ്ങുക
                      </button>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div style={{ 
                    flex: 1, 
                    fontSize: '1.05rem', 
                    lineHeight: '1.7', 
                    whiteSpace: 'pre-wrap', 
                    color: '#1f2937', 
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    paddingBottom: '120px'
                  }}>
                    {benefits.content}
                  </div>

                  {/* Mark as Completed button for checkbox tasks inside benefits overlay */}
                  {activeTask.type === 'checkbox' && !activeTask.is_completed && (
                    <button
                      onClick={() => {
                        toggleTask(activeTask, true);
                        setShowBenefits(false);
                        setActiveTask(null);
                      }}
                      style={{
                        marginTop: '20px',
                        width: '100%',
                        padding: '16px',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        marginBottom: '40px'
                      }}
                    >
                      Mark as Completed / പൂർത്തിയാക്കുക
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: activeTask.type === 'content' ? '0px' : '20px',
                    padding: activeTask.type === 'content' ? '16px 20px' : '0px',
                    borderBottom: activeTask.type === 'content' ? '1px solid var(--glass-border)' : 'none',
                    background: activeTask.type === 'content' ? 'var(--bg-card)' : 'transparent',
                    flexShrink: 0
                  }}>
                    <h2 style={{ fontSize: activeTask.type === 'content' ? '1.25rem' : '1.5rem', color: 'var(--text-main)', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{activeTask.title}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getBenefitsForTask(activeTask.id) && (
                        <button 
                          onClick={() => setShowBenefits(true)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)', 
                            border: '1px solid rgba(59, 130, 246, 0.3)', 
                            color: 'var(--primary)', 
                            padding: '6px 12px', 
                            borderRadius: '12px', 
                            fontSize: '0.8rem', 
                            fontWeight: '600', 
                            cursor: 'pointer'
                          }}
                        >
                          Benefits
                        </button>
                      )}
                      <button onClick={() => setActiveTask(null)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={activeTask.type === 'content' ? 24 : 28} /></button>
                    </div>
                  </div>

                  {/* COUNTER UI */}
                  {activeTask.type === 'counter' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '60px' }}>
                      {activeTask.imageUrl && (
                        <div style={{ 
                          width: '100%', 
                          height: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? 'auto' : '180px', 
                          maxHeight: activeTask.id.includes('duha_surah') ? '360px' : '180px',
                          background: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? '#ffffff' : 'var(--bg-card)', 
                          borderRadius: '16px', 
                          marginBottom: '30px', 
                          display: 'flex', 
                          alignItems: activeTask.id.includes('duha_surah') ? 'flex-start' : 'center', 
                          justifyContent: 'center', 
                          padding: '16px',
                          overflowY: activeTask.id.includes('duha_surah') ? 'auto' : 'hidden',
                          border: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? '2px solid var(--primary)' : '1px solid var(--glass-border)'
                        }}>
                          <img 
                            src={activeTask.imageUrl} 
                            alt={activeTask.title} 
                            style={{ 
                              width: '100%', 
                              height: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? 'auto' : '100%', 
                              objectFit: 'contain' 
                            }} 
                          />
                        </div>
                      )}
                      
                      <div 
                        onClick={() => updateCounterProgress(counterValue + 1)}
                        style={{ width: '220px', height: '220px', borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', fontWeight: 'bold', color: 'var(--primary)', cursor: 'pointer', userSelect: 'none', boxShadow: '0 0 40px var(--primary-glow)', flexShrink: 0 }}
                      >
                        {counterValue}
                      </div>
                      <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '1.2rem' }}>Target: {activeTask.target}</p>
                      
                      <div style={{ display: 'flex', gap: '16px', marginTop: '20px', marginBottom: '20px' }}>
                        <button className="glass-panel" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => updateCounterProgress(Math.max(0, counterValue - 1))}><RefreshCw size={18} /> -1</button>
                        <button className="glass-panel" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => updateCounterProgress(0)}>Reset</button>
                      </div>
                    </div>
                  )}

                  {/* CONTENT UI */}
                  {activeTask.type === 'content' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ 
                        flex: 1, 
                        background: 'var(--bg-card)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'stretch', 
                        justifyContent: 'stretch',
                        overflow: 'hidden'
                      }}>
                        {activeTask.contentUrl.endsWith('.pdf') ? (
                          <PDFViewer url={activeTask.contentUrl} />
                        ) : (
                          <img 
                            src={activeTask.contentUrl} 
                            alt={activeTask.title} 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '16px' }} 
                          />
                        )}
                      </div>
                      
                      <div style={{ padding: '16px', background: 'var(--bg-card)', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
                        <button className="btn-primary" style={{ width: '100%', padding: '16px' }} onClick={submitModalTask}>
                          Mark as Read & Completed
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default Home;
