import { defaultResumeData, defaultConfig } from './defaults';

const RESUME_STORE_KEY = 'resume-app-resumes';
const AI_CONFIG_KEY = 'resume-app-ai-config';
const INTERVIEW_KEY = 'resume-app-interviews';

// 旧版本单份简历的存储 key，用于一次性迁移
const LEGACY_DATA_KEY = 'resume-app-data';
const LEGACY_CONFIG_KEY = 'resume-app-config';

const defaultAiProfile = {
  id: 'ai-profile-default',
  name: 'DeepSeek 默认配置',
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-v4-flash',
  temperature: 0.7,
  timeout: 90,
};

export const defaultAiConfig = {
  ...defaultAiProfile,
  activeProfileId: defaultAiProfile.id,
  profiles: [{ ...defaultAiProfile }],
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
export function normalizeResume(resume) {
  if (!resume || typeof resume !== 'object') return null;
  const now = Date.now();
  const sourceData = resume.data || {};
  return {
    id: resume.id || createId('resume'),
    name: resume.name || '未命名简历',
    data: {
      ...defaultResumeData,
      ...sourceData,
      basicInfo: { ...defaultResumeData.basicInfo, ...(sourceData.basicInfo || {}) },
      careerProgression: Array.isArray(sourceData.careerProgression) ? sourceData.careerProgression : [],
    },
    config: { ...defaultConfig, ...(resume.config || {}) },
    createdAt: resume.createdAt || now,
    updatedAt: resume.updatedAt || resume.createdAt || now,
  };
}

export function normalizeResumeStore(store) {
  if (!store || !Array.isArray(store.resumes) || store.resumes.length === 0) return null;
  const resumes = store.resumes.map(normalizeResume).filter(Boolean);
  if (resumes.length === 0) return null;
  const activeId = resumes.some(resume => resume.id === store.activeId) ? store.activeId : resumes[0].id;
  return { ...store, resumes, activeId };
}

export function loadResumeStore() {
  const saved = readJSON(RESUME_STORE_KEY, null);
  const normalizedStore = normalizeResumeStore(saved);
  if (normalizedStore) return normalizedStore;

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

function inferAiProvider(baseUrl = '') {
  if (/deepseek\.com/i.test(baseUrl)) return 'deepseek';
  if (/moonshot\.(cn|ai)|kimi\.(com|ai)/i.test(baseUrl)) return 'kimi';
  if (/openrouter\.ai/i.test(baseUrl)) return 'openrouter';
  return 'custom';
}

function normalizeAiProfile(profile, index = 0) {
  const fallback = index === 0 ? defaultAiProfile : { ...defaultAiProfile, apiKey: '' };
  const provider = profile?.provider || inferAiProvider(profile?.baseUrl || fallback.baseUrl);
  const providerName = { deepseek: 'DeepSeek', kimi: 'Kimi', openrouter: 'OpenRouter', custom: '自定义' }[provider];
  const normalized = {
    ...fallback,
    ...(profile || {}),
    id: profile?.id || createId('ai-profile'),
    name: profile?.name || `${providerName} 配置 ${index + 1}`,
    provider,
  };

  // 早期内置的 OpenAI latest 路由在部分地区会被上游条款直接拒绝（403）。
  // 仅迁移这一条曾经的内置值；用户手填的其他 OpenRouter 模型保持不变。
  if (normalized.provider === 'openrouter' && normalized.model === '~openai/gpt-latest') {
    normalized.model = 'deepseek/deepseek-v4-flash';
  }
  return normalized;
}

export function normalizeAiConfig(config) {
  const saved = config && typeof config === 'object' ? config : {};
  const sourceProfiles = Array.isArray(saved.profiles) && saved.profiles.length
    ? saved.profiles
    : [{ ...defaultAiProfile, ...saved, id: saved.id || defaultAiProfile.id, name: saved.name || undefined, provider: saved.provider || inferAiProvider(saved.baseUrl || defaultAiProfile.baseUrl) }];
  const profiles = sourceProfiles.map(normalizeAiProfile);
  const activeProfileId = profiles.some(profile => profile.id === saved.activeProfileId)
    ? saved.activeProfileId
    : profiles[0].id;
  const active = profiles.find(profile => profile.id === activeProfileId) || profiles[0];

  // 顶层保留当前配置字段，让现有 AI 调用逻辑无需感知“多配置”结构。
  return {
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: active.model,
    temperature: active.temperature,
    timeout: active.timeout,
    provider: active.provider,
    activeProfileId,
    profiles,
  };
}

// 模型方案可以跨设备同步，但 API Key 始终只保留在各设备本地。
export function sanitizeAiConfigForRemote(config) {
  const normalized = normalizeAiConfig(config);
  return {
    ...normalized,
    apiKey: '',
    profiles: normalized.profiles.map(profile => ({ ...profile, apiKey: '' })),
  };
}

export function mergeRemoteAiConfig(remoteConfig, localConfig) {
  const remote = normalizeAiConfig(remoteConfig);
  const local = normalizeAiConfig(localConfig);
  const localKeys = new Map(local.profiles.map(profile => [profile.id, profile.apiKey || '']));
  const profiles = remote.profiles.map(profile => ({
    ...profile,
    apiKey: localKeys.get(profile.id) || '',
  }));
  return normalizeAiConfig({ ...remote, profiles });
}

export function loadAiConfig() {
  return normalizeAiConfig(readJSON(AI_CONFIG_KEY, {}));
}

export function saveAiConfig(config) {
  return writeJSON(AI_CONFIG_KEY, normalizeAiConfig(config));
}

// 面试记录按简历 id 分组存储：{ [resumeId]: Session[] }
export function loadInterviewStore() {
  const saved = readJSON(INTERVIEW_KEY, {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

export function saveInterviewStore(store) {
  return writeJSON(INTERVIEW_KEY, store);
}
