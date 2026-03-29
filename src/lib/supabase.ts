import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Schema SQL (da eseguire a mano in Supabase):
 *
 * sql
 * CREATE TABLE chat_sessions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id TEXT NOT NULL UNIQUE,
 *   title TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE chat_sessions
 *   ADD COLUMN IF NOT EXISTS document_names TEXT[] DEFAULT '{}';
 * CREATE TABLE chat_messages (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id TEXT NOT NULL,
 *   role TEXT CHECK (role IN ('user', 'model')) NOT NULL,
 *   text TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * CREATE INDEX ON chat_messages(session_id);
 *
 * -- RLS policies consigliate (se RLS è attivo):
 * -- PERMESSI DELETE / UPDATE / INSERT / SELECT per l'utente anon
 * -- ATTENZIONE: queste policy rendono le tabelle accessibili a chiunque abbia l'anon key.
 *
 * -- chat_sessions
 * CREATE POLICY "anon select sessions" ON chat_sessions
 *   FOR SELECT TO anon USING (true);
 * CREATE POLICY "anon insert sessions" ON chat_sessions
 *   FOR INSERT TO anon WITH CHECK (true);
 * CREATE POLICY "anon update sessions" ON chat_sessions
 *   FOR UPDATE TO anon USING (true) WITH CHECK (true);
 * CREATE POLICY "anon delete sessions" ON chat_sessions
 *   FOR DELETE TO anon USING (true);
 *
 * -- chat_messages
 * CREATE POLICY "anon select messages" ON chat_messages
 *   FOR SELECT TO anon USING (true);
 * CREATE POLICY "anon insert messages" ON chat_messages
 *   FOR INSERT TO anon WITH CHECK (true);
 * CREATE POLICY "anon delete messages" ON chat_messages
 *   FOR DELETE TO anon USING (true);
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

