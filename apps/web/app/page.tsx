/**
 * Legal Casebase AI Assistant MVP 主入口页面
 *
 * 渲染主聊天工作区 (ChatWorkspace)。
 * 按照 Chat-first UX 原则，用户进入后直接看到对话界面。
 */
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default function HomePage() {
  return <ChatWorkspace />;
}
