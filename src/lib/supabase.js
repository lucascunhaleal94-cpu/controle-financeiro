import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eiilssfqhvzlmemahmaj.supabase.co';
const supabaseAnonKey = 'sb_publishable_f8-YkSQVSPMiXmQMSCIPow_Gj7qSKQT';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
