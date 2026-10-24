import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ToolsModule } from './tools/tools.module';
import { LlmsModule } from './LLM/llm.module';
import { DatabaseModule } from './db/database.module';

@Module({
  imports: [ToolsModule, LlmsModule,DatabaseModule], // 导入 tools 模块
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
