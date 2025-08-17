import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { environment } from '../../../environments/environment';

export const supabase = createClient<Database>(
  environment.supabase.url,
  environment.supabase.anonKey
);
