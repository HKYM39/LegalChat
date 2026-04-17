/**
 * Hono 在线 API 层入口文件
 * 
 * 此文件是应用的启动点，用于导出由 createApp 创建的 Hono 实例。
 * 在 Cloudflare Workers 或其他兼容环境中，它充当主要的请求处理器。
 */
import { createApp } from "./app";

// 创建 Hono 应用实例
const app = createApp();

// 导出应用实例，供运行时环境（如 Bun, Cloudflare Workers, Node.js）使用
export default app;
