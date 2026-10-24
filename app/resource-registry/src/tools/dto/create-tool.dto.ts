import { Tool } from './tool.interface';

// 创建工具的请求数据（OpenAI Function Calling 格式）
export class CreateToolDto implements Tool {
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

// 更新工具的请求数据（和创建相同）
export class UpdateToolDto implements Tool {
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