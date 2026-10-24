import { Injectable } from '@nestjs/common';
import { ToolsService } from './tools/tools.service';
import { CreateToolDto, UpdateToolDto } from './tools/dto';


@Injectable()
export class AppService {
    constructor(private readonly toolsService: ToolsService) {}

    // 获取工具列表
    async getTools() {
        return await this.toolsService.findAll();
    }

    // 创建工具
    async createTool(createToolDto: CreateToolDto) {
        return await this.toolsService.create(createToolDto as any);
    }

    // 更新工具
    async updateTool(name: string, updateToolDto: UpdateToolDto) {
        const stat = await this.toolsService.update(name, updateToolDto as any);
        const latestName = (updateToolDto as any)?.function?.name || (updateToolDto as any)?.name || name;
        return {
            ...stat,
            info_url: `/admin/api/tools/defs/${latestName}`,
        };
    }

    // 删除工具
    async deleteTool(name: string) {
        return await this.toolsService.remove(name);
    }

     //获取默认模板
     async getToolTemplate(name: string,type: string) {
        return await this.toolsService.buildTemplate(name,type);
     }

     //创建工具之后,附带返回info_url(供前端保存专属读取地址)
     async createToolURL(createToolDto: CreateToolDto) {
        const start = await this.toolsService.create(createToolDto as any);
        const latestName = (createToolDto as any)?.function?.name || (createToolDto as any)?.name;
        return {
            ...start,
            info_url: `/admin/api/tools/defs/${latestName}`,
        };
     }

     //获取某工具完整定义(用于编辑页面预填)
     async getToolInfo(name: string) {
        return this.toolsService.findOne(name);
     }

     async getToolDef(name: string) {
        return this.toolsService.findOne(name);
      }
}
