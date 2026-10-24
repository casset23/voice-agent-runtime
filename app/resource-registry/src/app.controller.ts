import { Controller, Get, Post, Put, Delete, Body, Param, Query, NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateToolDto, UpdateToolDto } from './tools/dto';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {
    }

    @Get('/health') 
    health(): object {
        return {
            'status': 'ok'
        };
    }

    // 获取工具列表
    @Get('/admin/api/tools')
    async getTools() {
        return await this.appService.getTools();
    }

    // 创建工具
    @Post('/admin/api/tools')
    async createTool(@Body() createToolDto: CreateToolDto) {
        return await this.appService.createTool(createToolDto);
    }

    // 更新工具
    @Put('/admin/api/tools/:name')
    async updateTool(@Param('name') name: string, @Body() updateToolDto: UpdateToolDto) {
        console.log('updateToolDto', updateToolDto);
        return await this.appService.updateTool(name, updateToolDto);
    }

    // 删除工具
    @Delete('/admin/api/tools/:name')
    async deleteTool(@Param('name') name: string) {
        return await this.appService.deleteTool(name);
    }


    //获取默认模板
    @Get('/admin/api/tools/template')
    async getToolTemplate(
        @Query('name') name = 'tool_new',
        @Query('type') type = 'blank',
    ) {
        return this.appService.getToolTemplate(name, type);
    }


    //获取某工具的完整定义(编辑页面预填)
    @Get('/admin/api/tools/defs/:name')
    async getToolDef(@Param('name') name: string) {

        const tool = await this.appService.getToolDef(name);
        if (!tool) throw new NotFoundException('工具不存在');
        return tool; // 返回完整 JSON 定义
    }


}
