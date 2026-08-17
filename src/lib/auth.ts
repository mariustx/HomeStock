import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Reusable authentication helpers backed by Supabase Auth.
 * All app code goes through these instead of calling supabase.auth directly,
 * so session handling and error normalisation stay in one place.
 */

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

export interface SignInResult {
  ok: boolean;
  error?: string;
}

function friendlyAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('User already registered')) return 'An account with this email already exists.';
  if (message.includes('Email not confirmed')) return 'Please confirm your email before signing in.';
  return message;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

export async function signUp(email: string, password: string): Promise<SignInResult> {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export { supabase };
