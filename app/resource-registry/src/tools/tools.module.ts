import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { DatabaseModule } from '../db/database.module';
import { ToolsRepository } from './tools.repository';
import { ToolsRunnerController } from './tools.runner.controller';


@Module({
  imports: [DatabaseModule],
  providers: [ToolsService, ToolsRepository],
  exports: [ToolsService, ToolsRepository],
  controllers: [ToolsRunnerController], // 导出服务，让其他模块可以使用
})
export class ToolsModule {}