import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultResumeData, defaultConfig, recommendedResumeData } from './utils/defaults';
import {
  loadResumeStore,
  saveResumeStore,
  loadAiConfig,
  saveAiConfig,
  loadInterviewStore,
  saveInterviewStore,
  createResume,
  normalizeAiConfig,
  sanitizeAiConfigForRemote,
  mergeRemoteAiConfig,
} from './utils/storage';
import ResumeManager from './components/ResumeManager';
import ResumeEditor from './components/ResumeEditor';
import AiInterview from './components/AiInterview';
import AiSettingsModal from './components/AiSettingsModal';
import StorageAccountModal from './components/StorageAccountModal';
import {
  getRemoteSession,
  loadRemoteState,
  saveRemoteState,
  signInToRemote,
  signOutFromRemote,
} from './utils/supabase';

const views = [
  { key: 'manage', label: '简历管理' },
  { key: 'edit', label: '编辑简历' },
  { key: 'interview', label: 'AI 面试官' },
];

export default function App() {
  const [store, setStore] = useState(loadResumeStore);
  const [view, setView] = useState('manage');
  const [aiConfig, setAiConfig] = useState(loadAiConfig);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [interviewStore, setInterviewStore] = useState(loadInterviewStore);
  const [showStorageAccount, setShowStorageAccount] = useState(false);
  const [storageMode, setStorageMode] = useState('local');
  const [remoteUser, setRemoteUser] = useState(null);
  const [remoteReady, setRemoteReady] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle');
  const syncVersion = useRef(0);

  useEffect(() => {
    if (storageMode === 'local') saveResumeStore(store);
  }, [store, storageMode]);

  useEffect(() => {
    if (storageMode === 'local') saveInterviewStore(interviewStore);
  }, [interviewStore, storageMode]);

  useEffect(() => {
    saveAiConfig(aiConfig);
  }, [aiConfig]);

  const activateRemoteStorage = async (user, localFallback, shouldApply = () => true) => {
    const remoteState = await loadRemoteState(user.id);
    if (!shouldApply()) return;

    if (remoteState) {
      setStore(remoteState.resumeStore || localFallback.resumeStore);
      setAiConfig(mergeRemoteAiConfig(remoteState.aiConfig || localFallback.aiConfig, loadAiConfig()));
      setInterviewStore(remoteState.interviewStore || {});
    } else {
      await saveRemoteState(user.id, localFallback);
      if (!shouldApply()) return;
    }

    setRemoteUser(user);
    setStorageMode('remote');
    setRemoteReady(true);
    setSyncStatus('synced');
  };

  useEffect(() => {
    let active = true;

    getRemoteSession()
      .then(async session => {
        if (!active || !session?.user) return;
        await activateRemoteStorage(
          session.user,
          {
            resumeStore: loadResumeStore(),
            aiConfig: sanitizeAiConfigForRemote(loadAiConfig()),
            interviewStore: loadInterviewStore(),
          },
          () => active
        );
      })
      .catch(error => {
        if (!active) return;
        setStorageError(`恢复远程会话失败：${error.message}`);
        setSyncStatus('error');
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (storageMode !== 'remote' || !remoteReady || !remoteUser) return undefined;

    const version = ++syncVersion.current;
    setSyncStatus('syncing');
    const timer = window.setTimeout(async () => {
      try {
        await saveRemoteState(remoteUser.id, {
          resumeStore: store,
          aiConfig: sanitizeAiConfigForRemote(aiConfig),
          interviewStore,
        });
        if (syncVersion.current === version) {
          setSyncStatus('synced');
          setStorageError('');
        }
      } catch (error) {
        if (syncVersion.current === version) {
          setSyncStatus('error');
          setStorageError(`云端同步失败：${error.message}`);
        }
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [store, aiConfig, interviewStore, storageMode, remoteReady, remoteUser]);

  const activeResume = useMemo(
    () => store.resumes.find(r => r.id === store.activeId) || store.resumes[0],
    [store]
  );

  const interviewCounts = useMemo(() => {
    const counts = {};
    Object.entries(interviewStore).forEach(([resumeId, sessions]) => {
      counts[resumeId] = Array.isArray(sessions) ? sessions.length : 0;
    });
    return counts;
  }, [interviewStore]);

  const activeSessions = useMemo(() => {
    const list = activeResume ? interviewStore[activeResume.id] : null;
    return Array.isArray(list) ? list : [];
  }, [interviewStore, activeResume]);

  // 更新当前简历的 data / config，同时刷新更新时间
  const patchActiveResume = (patch) => {
    setStore(prev => ({
      ...prev,
      resumes: prev.resumes.map(r => (r.id === prev.activeId ? { ...r, ...patch, updatedAt: Date.now() } : r)),
    }));
  };

  const setResumeData = (updater) => {
    setStore(prev => ({
      ...prev,
      resumes: prev.resumes.map(r => {
        if (r.id !== prev.activeId) return r;
        const nextData = typeof updater === 'function' ? updater(r.data) : updater;
        return { ...r, data: nextData, updatedAt: Date.now() };
      }),
    }));
  };

  const setResumeConfig = (updater) => {
    setStore(prev => ({
      ...prev,
      resumes: prev.resumes.map(r => {
        if (r.id !== prev.activeId) return r;
        const nextConfig = typeof updater === 'function' ? updater(r.config) : updater;
        return { ...r, config: nextConfig, updatedAt: Date.now() };
      }),
    }));
  };

  const handleCreate = (kind) => {
    const isTemplate = kind === 'template';
    const name = isTemplate
      ? `推荐模板副本 ${store.resumes.length + 1}`
      : `新简历 ${store.resumes.length + 1}`;
    const resume = createResume(
      name,
      isTemplate ? recommendedResumeData : defaultResumeData,
      defaultConfig
    );
    setStore(prev => ({ resumes: [...prev.resumes, resume], activeId: resume.id }));
    setView('edit');
  };

  const handleDuplicate = (id) => {
    const source = store.resumes.find(r => r.id === id);
    if (!source) return;
    const copy = createResume(`${source.name} 副本`, source.data, source.config);
    setStore(prev => ({ resumes: [...prev.resumes, copy], activeId: copy.id }));
  };

  const handleRename = (id, name) => {
    setStore(prev => ({
      ...prev,
      resumes: prev.resumes.map(r => (r.id === id ? { ...r, name, updatedAt: Date.now() } : r)),
    }));
  };

  const handleDelete = (id) => {
    setStore(prev => {
      const resumes = prev.resumes.filter(r => r.id !== id);
      if (resumes.length === 0) return prev;
      return { resumes, activeId: prev.activeId === id ? resumes[0].id : prev.activeId };
    });
    setInterviewStore(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const openResume = (id, targetView) => {
    setStore(prev => ({ ...prev, activeId: id }));
    setView(targetView);
  };

  const handleSessionsChange = (updater) => {
    if (!activeResume) return;
    setInterviewStore(prev => {
      const current = Array.isArray(prev[activeResume.id]) ? prev[activeResume.id] : [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeResume.id]: next };
    });
  };

  const handleSaveAiConfig = (nextConfig) => {
    setAiConfig(normalizeAiConfig(nextConfig));
    setShowAiSettings(false);
  };

  const handleRemoteLogin = async (username, password) => {
    setAccountBusy(true);
    setStorageError('');
    try {
      const session = await signInToRemote(username, password);
      await activateRemoteStorage(session.user, {
        resumeStore: store,
        aiConfig: sanitizeAiConfigForRemote(aiConfig),
        interviewStore,
      });
    } catch (error) {
      setStorageError(error.message);
    } finally {
      setAccountBusy(false);
    }
  };

  const handleRemoteLogout = async () => {
    setAccountBusy(true);
    setStorageError('');
    try {
      await signOutFromRemote();
      syncVersion.current += 1;
      setRemoteReady(false);
      setRemoteUser(null);
      setStorageMode('local');
      setStore(loadResumeStore());
      setAiConfig(loadAiConfig());
      setInterviewStore(loadInterviewStore());
      setSyncStatus('idle');
      setShowStorageAccount(false);
    } catch (error) {
      setStorageError(`退出失败：${error.message}`);
    } finally {
      setAccountBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="logo">📄 简历编辑器</h1>
          <nav className="view-nav">
            {views.map(item => (
              <button
                key={item.key}
                className={`view-nav-btn ${view === item.key ? 'active' : ''}`}
                onClick={() => setView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-right">
          {activeResume && view !== 'manage' && (
            <span className="header-resume-name" title={activeResume.name}>
              当前：{activeResume.name}
            </span>
          )}
          <button className="btn btn-outline" onClick={() => setShowAiSettings(true)}>AI 设置</button>
          <button
            className={`storage-mode-btn ${storageMode === 'remote' ? 'is-remote' : ''}`}
            onClick={() => setShowStorageAccount(true)}
            title={storageMode === 'remote' ? '正在使用远程存储' : '正在使用本地存储'}
          >
            <span className={`storage-status-dot ${syncStatus === 'syncing' ? 'is-syncing' : ''}`} />
            {storageMode === 'remote' ? '远程存储' : '本地存储'}
          </button>
        </div>
      </header>

      {view === 'manage' && (
        <ResumeManager
          resumes={store.resumes}
          activeId={store.activeId}
          interviewCounts={interviewCounts}
          onEdit={id => openResume(id, 'edit')}
          onInterview={id => openResume(id, 'interview')}
          onCreate={handleCreate}
          onDuplicate={handleDuplicate}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}

      {view === 'edit' && activeResume && (
        <ResumeEditor
          key={activeResume.id}
          resumeData={activeResume.data}
          setResumeData={setResumeData}
          config={activeResume.config}
          setConfig={setResumeConfig}
          onManualSave={() => patchActiveResume({})}
        />
      )}

      {view === 'interview' && activeResume && (
        <AiInterview
          resume={activeResume}
          sessions={activeSessions}
          onSessionsChange={handleSessionsChange}
          aiConfig={aiConfig}
          onOpenSettings={() => setShowAiSettings(true)}
        />
      )}

      {showAiSettings && (
        <AiSettingsModal
          config={aiConfig}
          onSave={handleSaveAiConfig}
          onClose={() => setShowAiSettings(false)}
        />
      )}

      {showStorageAccount && (
        <StorageAccountModal
          mode={storageMode}
          syncStatus={syncStatus}
          error={storageError}
          busy={accountBusy}
          onLogin={handleRemoteLogin}
          onLogout={handleRemoteLogout}
          onClose={() => setShowStorageAccount(false)}
        />
      )}
    </div>
  );
}
