import { Controller, Get, Post, Put, Delete, Param, Body, NotFoundException } from '@nestjs/common';
import { LlmsService } from './llm.service';
import { CreateLlmDto, UpdateLlmDto } from './dto/llm.dto';
import { Query } from '@nestjs/common';



@Controller('/admin/api/llms')
export class LlmsController {
    constructor(private readonly service: LlmsService) {}

@Get()
async list(){
    return this.service.findAll();
}

@Post()
async create(@Body() dto: CreateLlmDto){
    return this.service.create(dto);
}

@Get('health')
async healthList(@Query('onlyOnline') onlyOnline?: string ){
    const only = String(onlyOnline).toLowerCase() === 'true';
    return this.service.listHealth(only);
}

@Get(':id/health')
async healthOne(@Param('id') id: string){
    return this.service.checkHealthOne(id);
}


@Get(':id')
async detail(@Param('id') id: string){
    const data = await this.service.findOne(id);
    if (!data) throw new NotFoundException('资源不存在');
    return data;
}


@Put(':id')
async update(@Param('id') id: string, @Body() dto: UpdateLlmDto){
    return this.service.update(id, dto);
}

@Delete(':id')
async remove(@Param('id') id: string){
    return this.service.remove(id);
}

}

@Controller('/runner/api/llms')
export class LlmsRunnerController {
    
  constructor(private readonly service: LlmsService) {}

  
  @Get('config')
  async config() {
    const items = await this.service.getRunnerConfig();
    return { items };
  }
}