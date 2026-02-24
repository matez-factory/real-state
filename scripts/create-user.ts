/**
 * One-shot script to create the admin user.
 * Run with: npx tsx scripts/create-user.ts
 * Delete after use.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'valeria@diarc.ar',
    password: 'Admin3008',
    email_confirm: true,
  });

  if (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  }

  console.log('User created:', data.user.id);
}

main();
