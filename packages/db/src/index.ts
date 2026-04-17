/**
 * 数据库包主入口文件
 * 
 * 导出数据库客户端、存储库以及 Drizzle 数据表定义 (Schema)。
 * 为整个项目提供统一的数据库访问入口。
 */
export * from "./client";
export * from "./repositories/legal-research";
export * from "./schema";
export * as schema from "./schema";
