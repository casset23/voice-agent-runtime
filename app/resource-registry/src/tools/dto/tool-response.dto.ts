import { Tool } from './tool.interface';

// 工具列表项（用于列表页面显示）
export class ToolListItemDto {
  name: string;
  description: string;
  functionsCount: number;
}

// 工具详情（用于编辑页面）- 完整的 OpenAI Function Calling 格式
export class ToolDetailDto implements Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: 'object';
        description: string;
        properties: Record<string, {
          type: string;
          description: string;
          enum?: string[];
          default?: any;
        }>;
        required: string[];
      }>;
    };
  };
}

// 创建工具的响应
export class CreateToolResponseDto {  
  name: string;
  description: string;
  functionsCount: number;
}

// 更新工具的响应
export class UpdateToolResponseDto {
  name: string;
  description: string;
  functionsCount: number;
}

// 删除工具的响应
export class DeleteToolResponseDto {
  deletedTool: string;
  deletedFunctions: number;
}



