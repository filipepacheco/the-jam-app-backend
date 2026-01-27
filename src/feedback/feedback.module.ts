import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';

@Module({
  imports: [PrismaModule, SupabaseModule, AuthModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, OptionalJwtGuard],
})
export class FeedbackModule {}
