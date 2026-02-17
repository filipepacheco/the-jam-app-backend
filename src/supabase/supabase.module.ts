import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const logger = new Logger('SupabaseModule');

@Global()
@Module({
  providers: [
    // Existing anon client (for frontend operations)
    {
      provide: 'SUPABASE_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): SupabaseClient => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const supabaseAnonKey = configService.get<string>('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseAnonKey) {
          logger.warn('SUPABASE_URL or SUPABASE_ANON_KEY not configured. Supabase auth disabled.');
          return null;
        }

        return createClient(supabaseUrl, supabaseAnonKey);
      },
    },
    // Service role client (for backend operations)
    {
      provide: 'SUPABASE_SERVICE_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): SupabaseClient => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const serviceRoleKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
          logger.warn(
            'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Supabase service operations disabled.',
          );
          return null;
        }

        return createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      },
    },
  ],
  exports: ['SUPABASE_CLIENT', 'SUPABASE_SERVICE_CLIENT'],
})
export class SupabaseModule {}
