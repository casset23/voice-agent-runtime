// OpenAI Function Calling 格式的工具定义

// 功能参数的属性定义
export interface FunctionProperty {
  type: string;
  description: string;
  enum?: string[];
  default?: any;
}

// 单个功能的完整定义（作为参数对象）
export interface ToolFunction {
  type: 'object';
  description: string;
  properties: Record<string, FunctionProperty>;
  required: string[];
}

// 工具的参数结构
export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolFunction>; 
}

// 工具函数定义
export interface ToolFunctionDef {
  name: string;
  description: string;
  parameters: ToolParameters;
}


export interface Tool {
  type: 'function';
  function: ToolFunctionDef;
}