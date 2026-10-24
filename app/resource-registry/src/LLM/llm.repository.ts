import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { LlmResource, LlmStatus } from './dto/llm.interface';

type LlmRow = {
  id: string;
  display_name: string;
  model: string;
  is_local: number;
  base_url: string | null;
  api_key: string | null;
  health_url: string | null;
  max_tokens: number | null;
  enabled: number;
  last_status: string | null;
  latency_ms: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};



// 字段映射表：
const FIELD_MAP: Array<{
    key: keyof LlmResource;
    col: keyof LlmRow;
    toDb?: (v: any) => any;
    fromDb?: (v: any) => any;
  }> = [
    { key: 'displayName', col: 'display_name' },
    { key: 'model', col: 'model' },
    { key: 'isLocal', col: 'is_local', toDb: (v: boolean) => (v ? 1 : 0), fromDb: (v: number) => !!v },
    { key: 'baseUrl', col: 'base_url' },
    { key: 'apiKey', col: 'api_key' },
    { key: 'healthUrl', col: 'health_url' },
    { key: 'maxTokens', col: 'max_tokens' },
    { key: 'enabled', col: 'enabled', toDb: (v: boolean) => (v ? 1 : 0), fromDb: (v: number) => !!v },
    { key: 'lastStatus', col: 'last_status', fromDb: (v: string | null) => (v ?? undefined) as LlmStatus | undefined },
    { key: 'latencyMs', col: 'latency_ms' },
    { key: 'lastCheckedAt', col: 'last_checked_at' },
    { key: 'lastError', col: 'last_error' },
  ];
  
  const toDbNull = (v: any) => (v === undefined ? null : v);



@Injectable()
export class LLMRepository {
    constructor(private readonly db:DatabaseService){}


    //将数据库行转换为资源对象
    private fromRow = (row: LlmRow): LlmResource => {
        const result: any = { id: row.id };
        for (const m of FIELD_MAP) {
          const dbVal = (row as any)[m.col];
          if (dbVal === null || dbVal === undefined) continue;
          result[m.key] = m.fromDb ? m.fromDb(dbVal) : dbVal;
        }
        return result as LlmResource;
      };



      //构建 SQL 更新语句和参数
      private toColumns(partial: Partial<LlmResource>): { setSql: string; params: unknown[] } {
        const sets: string[] = [];
        const params: unknown[] = [];
      
        for (const m of FIELD_MAP) {
          if ((partial as any)[m.key] !== undefined) {
            const raw = (partial as any)[m.key];
            const val = m.toDb ? m.toDb(raw) : raw;
            sets.push(`${String(m.col)} = ?`);
            params.push(toDbNull(val));
          }
        }
      
        // 总是更新 updated_at
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
      
        return { setSql: sets.join(', '), params };
      }


      //用于执行 SQL 插入语句创建新的资源记录
      async create(resource:LlmResource):Promise<void>{
        const now=new Date().toISOString();
        this.db.run(
            `
            insert into llm_resources
            (id, display_name, model, is_local, base_url, api_key, health_url, max_tokens, enabled,
             last_status, latency_ms, last_checked_at, last_error, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              resource.id,
              resource.displayName,
              resource.model,
              resource.isLocal ? 1 : 0,
              toDbNull(resource.baseUrl),
              toDbNull(resource.apiKey),
              toDbNull(resource.healthUrl),
              toDbNull(resource.maxTokens),
              resource.enabled ? 1 : 0,
              toDbNull(resource.lastStatus),
              toDbNull(resource.latencyMs),
              toDbNull(resource.lastCheckedAt),
              toDbNull(resource.lastError),
              now,
              now,
            ],
        )
    }

    async update(id: string, partial: Partial<LlmResource>): Promise<void> {
      const { setSql, params } = this.toColumns(partial); 
      const sql = `update llm_resources set ${setSql} where id = ?`;
      this.db.run(sql, [...params, id]); 
    }


    async updateHealthFields(
      id: string,
      fields: { lastStatus: LlmStatus | 'error' | 'offline' | 'online'; latencyMs?: number; lastCheckedAt: string; lastError?: string },
    ): Promise<void> {
      const sql = `
        update llm_resources
        set last_status = ?, latency_ms = ?, last_checked_at = ?, last_error = ?, updated_at = ?
        where id = ?
      `;
      const params = [
        fields.lastStatus ?? null,
        fields.latencyMs ?? null,
        fields.lastCheckedAt,
        fields.lastError ?? null,
        new Date().toISOString(),
        id,
      ];
      this.db.run(sql, params);
    }
    

    async remove(id:string):Promise<void>{
        this.db.run('delete from llm_resources where id=?',[id]);
    }

    async findOne(id:string):Promise<LlmResource | null>{
        const row=this.db.get<LlmRow>('select * from llm_resources where id=?',[id]);
        return row ? this.fromRow(row) : null;
    }

    async findAll(): Promise<LlmResource[]> {
        const rows = this.db.all<LlmRow>('select * from llm_resources');
        return rows.map(row => this.fromRow(row));
    }

    async findConflict(displayName: string, model: string): Promise<boolean> {
      const row = this.db.get<{ id: string }>(
        `select id from llm_resources where display_name = ? and model = ? limit 1`,
        [displayName, model],
      );
      return !!row;
    }
}

        



