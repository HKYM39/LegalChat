/**
 * 基础对话数据表定义
 * 
 * 存储用户会话 (Conversations) 和消息 (Messages) 记录。
 */
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * 对话主表 (conversations)
 * 代表用户与 AI 之间的一个完整会话流。
 */
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  // 会话标题 (通常由 AI 根据第一条消息生成)
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});

/**
 * 消息明细表 (messages)
 * 存储会话中的每一条交互记录 (用户输入或 AI 响应)。
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // 所属对话 ID
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // 角色 (user, assistant, system)
    role: varchar("role", { length: 20 }).notNull(),
    // 消息原文内容
    content: text("content").notNull(),
    // 附加元数据 (如引用的 UI 状态)
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_messages_conversation_id").on(table.conversationId),
    index("idx_messages_role").on(table.role),
  ],
);
