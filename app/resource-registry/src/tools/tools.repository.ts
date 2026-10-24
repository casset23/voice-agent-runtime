import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../db/database.service';

export type ToolRow = {
  id: string;
  name: string;
  description: string;
  parameters_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type ToolDef = {
  id: string;
  name: string;
  description: string;
  parameters: any; 
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ToolsRepository {
  constructor(private readonly db: DatabaseService) {}

  private fromRow(row: ToolRow): ToolDef {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      parameters: JSON.parse(row.parameters_json),
      enabled: !!row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByName(name: string): Promise<ToolDef | null> {
    const row = this.db.get<ToolRow>(`select * from tool_defs where name = ?`, [name]);
    return row ? this.fromRow(row) : null;
  }

  async findAll(): Promise<ToolDef[]> {
    const rows = this.db.all<ToolRow>(`select * from tool_defs order by created_at desc`);
    return rows.map(r => this.fromRow(r));
  }

  async findOne(id: string): Promise<ToolDef | null> {
    const row = this.db.get<ToolRow>(`select * from tool_defs where id = ?`, [id]);
    return row ? this.fromRow(row) : null;
  }

  async create(input: { id: string; name: string; description?: string; parameters: any; enabled?: boolean }): Promise<void> {
    const now = new Date().toISOString();
    this.db.run(
      `
      insert into tool_defs (id, name, description, parameters_json, enabled, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.id,
        input.name,
        input.description ?? '',
        JSON.stringify(input.parameters ?? {}),
        input.enabled ? 1 : 0,
        now,
        now,
      ],
    );
  }

  async update(
    id: string,
    partial: { name?: string; description?: string; parameters?: any; enabled?: boolean },
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (partial.name !== undefined) {
      sets.push('name = ?');
      params.push(partial.name);
    }
    if (partial.description !== undefined) {
      sets.push('description = ?');
      params.push(partial.description ?? '');
    }
    if (partial.parameters !== undefined) {
      sets.push('parameters_json = ?');
      params.push(JSON.stringify(partial.parameters ?? {}));
    }
    if (partial.enabled !== undefined) {
      sets.push('enabled = ?');
      params.push(partial.enabled ? 1 : 0);
    }

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());

    const sql = `update tool_defs set ${sets.join(', ')} where id = ?`;
    this.db.run(sql, [...params, id]);
  }

  async remove(id: string): Promise<void> {
    this.db.run(`delete from tool_defs where id = ?`, [id]);
  }


  //给LLM-runner提供获取的所有工具
  async findEnabledForRunner(): Promise<any[]> {
    const rows = this.db.all<{ parameters_json: string }>(
      `select parameters_json from tool_defs where enabled = 1 order by created_at desc`,
    );
    return rows.map(r => JSON.parse(r.parameters_json));
  }
}