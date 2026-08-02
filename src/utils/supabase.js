import { createClient } from '@supabase/supabase-js';

// Publishable keys are intentionally safe for browser bundles; Auth + RLS enforce data access.
// Environment variables override these deployment defaults when pointing a fork at another project.
const deploymentDefaults = {
  url: 'https://jalqncrthzdcvhczpvxv.supabase.co',
  publishableKey: 'sb_publishable_Lpcx8s1F-D7Keiq3dQYMEQ_jngeEQSl',
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || deploymentDefaults.url;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || deploymentDefaults.publishableKey;

export const remoteAccount = {
  username: import.meta.env.VITE_REMOTE_USERNAME?.trim() || 'wzkMaster',
  email: import.meta.env.VITE_REMOTE_ACCOUNT_EMAIL?.trim() || 'wzkmaster@resume.local',
};

export const isRemoteStorageConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isRemoteStorageConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

function requireClient() {
  if (!supabase) {
    throw new Error('远程存储尚未配置，请先设置 Supabase 环境变量。');
  }
  return supabase;
}

export async function getRemoteSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInToRemote(username, password) {
  const normalizedUsername = username.trim().toLowerCase();
  if (normalizedUsername !== remoteAccount.username.toLowerCase()) {
    throw new Error('该账号没有远程存储权限，请联系管理员。');
  }

  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: remoteAccount.email,
    password,
  });
  if (error) throw new Error('账号或密码错误。');
  return data.session;
}

export async function signOutFromRemote() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadRemoteState(userId) {
  const client = requireClient();
  const { data, error } = await client
    .from('app_state')
    .select('resume_store, ai_config, interview_store, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    resumeStore: data.resume_store,
    aiConfig: data.ai_config,
    interviewStore: data.interview_store,
    updatedAt: data.updated_at,
  };
}

export async function saveRemoteState(userId, state) {
  const client = requireClient();
  const { error } = await client.from('app_state').upsert(
    {
      user_id: userId,
      resume_store: state.resumeStore,
      ai_config: state.aiConfig,
      interview_store: state.interviewStore,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}
