import { defaultResumeData, defaultConfig } from './defaults';

const RESUME_STORE_KEY = 'resume-app-resumes';
const AI_CONFIG_KEY = 'resume-app-ai-config';
const INTERVIEW_KEY = 'resume-app-interviews';

// 旧版本单份简历的存储 key，用于一次性迁移
const LEGACY_DATA_KEY = 'resume-app-data';
const LEGACY_CONFIG_KEY = 'resume-app-config';

export const defaultAiConfig = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.7,
  timeout: 90,
};

function readJSON(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('写入本地存储失败:', e);
    return false;
  }
}

export function createId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function createResume(name, data, config) {
  const now = Date.now();
  return {
    id: createId('resume'),
    name: name || '未命名简历',
    data: JSON.parse(JSON.stringify(data || defaultResumeData)),
    config: JSON.parse(JSON.stringify(config || defaultConfig)),
    createdAt: now,
    updatedAt: now,
  };
}

// 补全缺失字段，避免旧数据或手工导入数据渲染时报错
function normalizeResume(resume) {
  if (!resume || typeof resume !== 'object') return null;
  const now = Date.now();
  return {
    id: resume.id || createId('resume'),
    name: resume.name || '未命名简历',
    data: { ...defaultResumeData, ...(resume.data || {}) },
    config: { ...defaultConfig, ...(resume.config || {}) },
    createdAt: resume.createdAt || now,
    updatedAt: resume.updatedAt || resume.createdAt || now,
  };
}

export function loadResumeStore() {
  const saved = readJSON(RESUME_STORE_KEY, null);
  if (saved && Array.isArray(saved.resumes) && saved.resumes.length > 0) {
    const resumes = saved.resumes.map(normalizeResume).filter(Boolean);
    const activeId = resumes.some(r => r.id === saved.activeId) ? saved.activeId : resumes[0].id;
    return { resumes, activeId };
  }

  // 首次进入新版本：把旧的单份简历迁移成第一个版本
  const legacyData = readJSON(LEGACY_DATA_KEY, null);
  const legacyConfig = readJSON(LEGACY_CONFIG_KEY, null);
  if (legacyData) {
    const migrated = createResume(legacyData?.basicInfo?.name ? `${legacyData.basicInfo.name}的简历` : '我的简历', legacyData, legacyConfig);
    const store = { resumes: [migrated], activeId: migrated.id };
    saveResumeStore(store);
    return store;
  }

  const first = createResume('我的简历', defaultResumeData, defaultConfig);
  return { resumes: [first], activeId: first.id };
}

export function saveResumeStore(store) {
  return writeJSON(RESUME_STORE_KEY, store);
}

export function loadAiConfig() {
  return { ...defaultAiConfig, ...readJSON(AI_CONFIG_KEY, {}) };
}

export function saveAiConfig(config) {
  return writeJSON(AI_CONFIG_KEY, config);
}

// 面试记录按简历 id 分组存储：{ [resumeId]: Session[] }
export function loadInterviewStore() {
  const saved = readJSON(INTERVIEW_KEY, {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

export function saveInterviewStore(store) {
  return writeJSON(INTERVIEW_KEY, store);
}
