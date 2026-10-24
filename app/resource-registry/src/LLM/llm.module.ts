import { Module } from '@nestjs/common';
import { LlmsController } from './llm.controller';
import { LlmsService } from './llm.service';
import { DatabaseModule } from '../db/database.module';
import { LLMRepository } from './llm.repository';
import { LlmsRunnerController } from './llm.controller';



@Module({
  imports: [DatabaseModule],
  controllers: [LlmsController, LlmsRunnerController],
  providers: [LlmsService, LLMRepository],
  exports: [LlmsService, LLMRepository],
})
export class LlmsModule {}