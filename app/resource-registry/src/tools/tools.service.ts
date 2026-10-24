import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ToolsRepository } from './tools.repository';
import { CreateToolDto, UpdateToolDto, Tool } from './dto';

type ToolStats = {
  name: string;
  description: string;
  functionsCount: number;
};

@Injectable()
export class ToolsService {
  constructor(private readonly repo: ToolsRepository) {}

  // 将前端提交的工具数据归一化为统一结构，兼容两种格式：
  // 1) 扁平：{ name, description, parameters }
  // 2) 嵌套：{ type:'function', function:{ name, description, parameters } }
  private normalizeToolPayload(input: any): { name: string; description: string; parameters: any } {
    if (!input) {
      throw new BadRequestException('body is required');
    }
    if ((input as any).function) {
      const fn = (input as any).function || {};
      if (!fn.name) throw new BadRequestException('function.name is required');
      return {
        name: fn.name,
        description: fn.description ?? '',
        parameters: fn.parameters ?? { type: 'object', properties: {} },
      };
    }
    if (!(input as any).name) throw new BadRequestException('name is required');
    return {
      name: (input as any).name,
      description: (input as any).description ?? '',
      parameters: (input as any).parameters ?? { type: 'object', properties: {} },
    };
  }

  // 模板（保留原功能）
  buildTemplate(name: string = 'tool-new', type: string = 'blank') {
    return {
      type: 'function',
      function: {
        name,
        description: '',
        parameters: {
          type: 'object',
          properties: {
            default: {
              type: 'object',
              description: '默认功能(请修改/新增功能块)',
              properties: {
                example_pram: { type: 'string', description: '示例参数（可删除）' },
              },
              required: [],
            },
          },
        },
      },
    };
  }

  // 列表（返回概要）
  async findAll(): Promise<ToolStats[]> {
    const rows = await this.repo.findAll();
    return rows.map((r) => {
      const params = r.parameters ?? {};
      const props = (params as any)?.properties ?? {};
      return {
        name: r.name,
        description: r.description,
        functionsCount: Object.keys(props).length,
      };
    });
  }

  // 详情（返回完整 JSON 定义）
  async findOne(name: string): Promise<Tool | null> {
    const row = await this.repo.findByName(name);
    return row ? this.rowToTool(row) : null;
  }

  // 创建
  async create(toolData: any): Promise<ToolStats> {
    const normalized = this.normalizeToolPayload(toolData);
    const exists = await this.repo.findByName(normalized.name);
    if (exists) throw new ConflictException('工具名称已存在');

    await this.repo.create({
      id: this.generateId(),
      name: normalized.name,
      description: normalized.description ?? '',
      parameters: normalized.parameters ?? { type: 'object', properties: {} },
      enabled: true,
    });

    const props = (normalized.parameters?.properties ?? {}) as Record<string, unknown>;
    return {
      name: normalized.name,
      description: normalized.description ?? '',
      functionsCount: Object.keys(props).length,
    };
  }

  // 更新（支持改名：检查新名冲突）
  async update(name: string, toolData: any): Promise<ToolStats> {
    const current = await this.repo.findByName(name);
    if (!current) throw new NotFoundException('工具不存在');

    const normalized = this.normalizeToolPayload(toolData);
    const newName = normalized.name;
    if (newName !== name) {
      const conflict = await this.repo.findByName(newName);
      if (conflict) throw new ConflictException('新工具名称已存在');
    }

    await this.repo.update(current.id, {
      name: newName,
      description: normalized.description ?? '',
      parameters: normalized.parameters ?? { type: 'object', properties: {} },
    });

    const props = (normalized.parameters?.properties ?? {}) as Record<string, unknown>;
    return {
      name: newName,
      description: normalized.description ?? '',
      functionsCount: Object.keys(props).length,
    };
  }

  // 删除
  async remove(name: string): Promise<{ deletedTool: string }> {
    const current = await this.repo.findByName(name);
    if (!current) throw new NotFoundException('工具不存在');
    await this.repo.remove(current.id);
    return { deletedTool: name };
  }

  // --- helpers ---

  private generateId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private getToolStats(tool: Tool): ToolStats {
    const props = (tool.function?.parameters as any)?.properties ?? {};
    return {
      name: tool.function.name,
      description: tool.function.description ?? '',
      functionsCount: Object.keys(props).length,
    };
  }

  private rowToTool(row: { name: string; description: string; parameters: any }): Tool {
    return {
      type: 'function',
      function: {
        name: row.name,
        description: row.description,
        parameters: row.parameters ?? { type: 'object', properties: {} },
      },
    };
  }
}