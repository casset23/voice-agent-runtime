import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateLlmDto, UpdateLlmDto } from './dto/llm.dto';
import { LlmResource } from './dto/llm.interface';
import { LlmHealth, LlmStatus } from './dto/llm.interface';
import { LLMRepository } from './llm.repository';

type PublicLlm = LlmResource;

@Injectable()
export class LlmsService {
  constructor(private readonly repo: LLMRepository) {}


  // 列表：隐藏 apiKey
  async findAll(): Promise<PublicLlm[]> {
    const rows = await this.repo.findAll();
    return rows.map(this.withoutSecret);
  }


  // 详情：不存在返回 null（控制器决定是否抛错）
  async findOne(id: string): Promise<PublicLlm | null> {
    const found = await this.repo.findOne(id);
    return found ? this.withoutSecret(found) : null;
  }

  

  // 确保不会创建重复的资源
  async create(dto: CreateLlmDto): Promise<PublicLlm> {
    const duplicated = await this.repo.findConflict(dto.displayName, dto.model);
    if (duplicated) throw new ConflictException('同名/同模型的资源已存在');
    


    const resource: LlmResource = {
      id: this.generateId(),
      displayName: dto.displayName,
      model: dto.model,
      isLocal: dto.isLocal,
      baseUrl: dto.baseUrl,
      apiKey: dto.apiKey,
      healthUrl: dto.healthUrl,
      maxTokens: dto.maxTokens,
      enabled: dto.enabled ?? true,
    };
    await this.repo.create(resource);
    return this.withoutSecret(resource);
  }

  // 更新：部分字段覆盖
  async update(id: string, dto: UpdateLlmDto): Promise<PublicLlm> {
    const current = await this.repo.findOne(id);
    if (!current) throw new NotFoundException('资源不存在');
    await this.repo.update(id, dto);
    return this.withoutSecret({...current,...dto});

  }

  // 删除
  async remove(id: string): Promise<{ deletedId: string }> {
    const current = await this.repo.findOne(id);
    if (!current) throw new NotFoundException('资源不存在');
    await this.repo.remove(id);
    return { deletedId: id };
  }

  // --- helpers ---

  private withoutSecret = (r: LlmResource): PublicLlm => {
    return r;
  };

  private generateId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  


  //拼接健康检查地址,优先使用healthUrl,如果healthUrl不存在,则使用baseUrl
  private buildHealthUrl(baseUrl?:string,healthUrl?:string):string | undefined{
    if (healthUrl && /^https?:\/\//i.test(healthUrl)) return healthUrl;
    if (baseUrl && healthUrl) {
      const b = baseUrl.replace(/\/$/,'');
      const p = healthUrl.replace(/^\//,'');
      return `${b}/${p}`;
    }
    return healthUrl || baseUrl;
  }

  // 核心健康检查（5s 超时 + 可选 Bearer 头 + 回写数据库）
  private async checkHealth(resource: LlmResource): Promise<LlmHealth> {
    const url = this.buildHealthUrl(resource.baseUrl, resource.healthUrl);
    const checkedAt = new Date().toISOString();

    if (!url) {
      await this.repo.updateHealthFields(resource.id, {
        lastStatus: 'offline',
        lastCheckedAt: checkedAt,
        lastError: 'no health url',
      });
      return { id: resource.id, status: 'offline', checkedAt, error: 'no health url' };
    }

    const headers: Record<string, string> = {};
    if (resource.apiKey) headers['Authorization'] = `Bearer ${resource.apiKey}`;

    const controller = new (globalThis as any).AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const started = Date.now();

    try {
      const fetchFn: any = (globalThis as any).fetch;
      const res = await fetchFn(url, { method: 'GET', headers, signal: controller.signal as any });
      clearTimeout(timeout);

      const latencyMs = Date.now() - started;
      // 允许 401/403/404/405 作为“在线”（端点可达但鉴权/方法不符/路径隐藏），以兼容仅提供 POST /chat/completions 的服务
      const acceptable = res.ok || [401, 403, 404, 405].includes((res as any).status);
      const status: LlmStatus = acceptable ? 'online' : 'offline';
      const lastError = acceptable ? undefined : `${(res as any).status} ${(res as any).statusText} [url=${url}]`;

      await this.repo.updateHealthFields(resource.id, {
        lastStatus: status,
        latencyMs,
        lastCheckedAt: checkedAt,
        lastError,
      });

      return { id: resource.id, status, latencyMs, checkedAt, error: lastError };
    } catch (err: any) {
      clearTimeout(timeout);

      const lastError = `${String(err?.message ?? err)} [url=${url}]`;
      await this.repo.updateHealthFields(resource.id, {
        lastStatus: 'error',
        lastCheckedAt: checkedAt,
        lastError,
      });

      return { id: resource.id, status: 'error', checkedAt, error: lastError };
    }
  }

  //单个资源健康检查
  async checkHealthOne(id: string): Promise<LlmHealth> {
    const found = await this.repo.findOne(id);
    if(!found) throw new NotFoundException('资源不存在');
    return this.checkHealth(found);
  }

 
  // 批量健康检查
  async listHealth(onlyOnline = false): Promise<LlmHealth[]> {
    const all = await this.repo.findAll();
    const results = await Promise.all(
      all.map(r =>
        this.checkHealth(r).catch(err => ({
          id: r.id,
          status: 'error' as const,
          checkedAt: new Date().toISOString(),
          error: String(err?.message ?? err),
        })),
      ),
    );
    return onlyOnline ? results.filter(h => h.status === 'online') : results;
  }


  // runner 用的配置（包含 apiKey），仅返回 enabled 的资源
async getRunnerConfig() {
  const rows = await this.repo.findAll();
  return rows
    .filter(r => r.enabled)
    .map(r => ({
      id: r.id,
      displayName: r.displayName,
      model: r.model,
      baseUrl: r.baseUrl,
      apiKey: r.apiKey,
      isLocal: r.isLocal,
    }));
}

    








}