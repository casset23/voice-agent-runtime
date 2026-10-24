
//负责连接sqllite,创建表和通用查询方法,应用启动或者关闭时管理连接

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private db: Database.Database;

    private getDatabasepath():string{
        const configured=process.env.DB_PATH;
        const defaultPath=path.resolve(process.cwd(),'data','resource-registry.db');
        const filePath=configured ? path.resolve(configured) : defaultPath;
        const dir =path.dirname(filePath);
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir,{recursive:true});
    }
    return filePath;

}

onModuleInit():void{
    const dbPath=this.getDatabasepath();
    this.db=new Database(dbPath);
    this.db.pragma('foreign_keys = ON')
    this.initializeSchema();
}
onModuleDestroy():void{
    this.db.close();
}


private initializeSchema():void{
    const ddl = `
    CREATE TABLE IF NOT EXISTS llm_resources (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      model TEXT NOT NULL,
      is_local INTEGER NOT NULL,
      base_url TEXT,
      api_key TEXT,
      health_url TEXT,
      max_tokens INTEGER,
      enabled INTEGER NOT NULL,
      last_status TEXT,
      latency_ms INTEGER,
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_unique_display_model
    ON llm_resources(display_name, model);

    CREATE TABLE IF NOT EXISTS tool_defs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      parameters_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_defs_name
    ON tool_defs(name);
  `;
  this.db.exec(ddl);
}

//通用查询方法
run (sql:string,params:unknown[]=[]):void{
    this.db.prepare(sql).run(...params);
}
get<T=any>(sql:string,params:unknown[]=[]):T | undefined{
    return this.db.prepare(sql).get(...params) as T | undefined;
}
all<T=any>(sql:string,params:unknown[]=[]):T[] {
    // 临时调试
    // Do not log parameters: resource rows can contain provider credentials.
    return this.db.prepare(sql).all(...params) as T[];
}







}