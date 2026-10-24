import { Controller, Get } from '@nestjs/common';
import { ToolsRepository } from './tools.repository';

@Controller('/runner/api/tools')
export class ToolsRunnerController {
  constructor(private readonly repo: ToolsRepository) {}

  @Get('config')
  async getRunnerTools() {
    const items = (await this.repo.findAll())
      .filter(t => t.enabled)
      .map(t => {
        const p = t.parameters as any;
        // 如果数据库里已存为 OpenAI 工具定义（{ type:'function', function:{...} }），直接返回
        if (p && typeof p === 'object' && p.type === 'function' && p.function) {
          return p;
        }
        // 如果参数以 { function: { name, description, parameters } } 形式存储，规范化为标准结构
        if (p && typeof p === 'object' && p.function && p.function.parameters) {
          return {
            type: 'function',
            function: {
              name: p.function.name || t.name,
              description: p.function.description || t.description,
              parameters: p.function.parameters,
            },
          };
        }
        // 默认：使用行内 name/description 和 parameters 组装成标准 OpenAI 工具结构
        return {
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: p ?? { type: 'object', properties: {} },
          },
        };
      });
    return { items };
  }
}