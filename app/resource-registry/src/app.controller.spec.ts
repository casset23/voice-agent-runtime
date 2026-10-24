import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ToolsService } from './tools/tools.service';

describe('AppController', () => {
  let controller: AppController;
  const tools = [{ id: 'demo', name: 'tool_datetime' }];
  const findAll = jest.fn().mockResolvedValue(tools);

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: ToolsService, useValue: { findAll } }],
    }).compile();
    controller = app.get<AppController>(AppController);
    findAll.mockClear();
  });

  it('reports health without a provider call', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
    expect(findAll).not.toHaveBeenCalled();
  });

  it('returns tool data through AppService', async () => {
    expect(await controller.getTools()).toEqual(tools);
    expect(findAll).toHaveBeenCalledTimes(1);
  });
});
