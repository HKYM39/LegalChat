/**
 * Drizzle ORM 数据库客户端工厂
 * 
 * 负责连接 PostgreSQL 数据库并初始化 Drizzle 实例，
 * 挂载项目中定义的所有 Schema 以支持类型安全的查询。
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

/**
 * 从环境变量中读取数据库连接字符串
 */
function readDatabaseUrl() {
  return process.env.DATABASE_URL;
}

/**
 * 创建数据库客户端实例
 * 
 * @param connectionString 数据库连接字符串，默认从环境变量读取
 * @returns 包含 sql 连接和 db 实例的对象，如果无连接字符串则返回 null
 */
export function createDbClient(connectionString = readDatabaseUrl()) {
  if (!connectionString) {
    return null;
  }

  // 使用 postgres.js 作为底层驱动
  const sql = postgres(connectionString, {
    max: 1, // 对于 Serverless 或脚本环境，限制连接数
  });
  
  // 初始化 Drizzle
  const db = drizzle(sql, {
    schema,
  });

  return {
    sql,
    db,
  };
}

export type DatabaseClient = NonNullable<ReturnType<typeof createDbClient>>;
export type Database = DatabaseClient["db"];

/**
 * 检查当前环境是否配置了数据库连接
 */
export const hasDatabaseUrl = Boolean(readDatabaseUrl());
