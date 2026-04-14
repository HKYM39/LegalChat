---
name: legal-rag-react-frontend
description: Use this skill when building or modifying the chat-first Next.js 15 + React 19 frontend for the legal casebase MVP, especially the main conversation UI, assistant messages, authority cards, citation sections, case detail pages, and frontend state management.
---

# Legal RAG React Frontend

## Purpose

This skill defines how to build and evolve the frontend for the legal casebase MVP.

The product is a chat-first legal research assistant inspired by ChatGPT, Gemini, and Claude.

The frontend is responsible for presenting:

- conversation-first legal research
- assistant answers grounded in real authorities
- authority cards and supporting excerpts
- case detail views for verification

It must not drift into dashboard-first SaaS patterns.

## Project Constraints

This project has strict constraints:

- Frontend stack is Next.js 15 + React 19
- Styling uses Tailwind CSS and Material UI (MUI)
- State management uses Zustand
- Backend API is Python FastAPI
- No authentication
- No uploads
- No email features
- The application is effectively read-only
- The corpus is pre-indexed offline
- The main UX is conversation-first, not dashboard-first

## Use This Skill When

Use this skill when asked to:

- build or modify the main chat interface
- build assistant message UI
- build authority cards or citation sections
- build the case detail page
- connect frontend components to FastAPI endpoints
- manage conversation state
- improve AI-native legal research UX

## Do Not Use This Skill For

Do not use this skill for:

- backend API design
- legal document chunking or ingestion scripts
- Pinecone integration logic
- SQLAlchemy models
- authentication flows
- file upload flows
- email flows
- classic admin dashboard design

## Frontend Principles

### 1. Chat-first Legal Research UX

The product should feel like an AI conversation product first.

Always prefer:

- centered conversation flow
- user and assistant messages
- authority cards attached to assistant messages
- expandable evidence sections
- citation-driven interactions

Do not default to dashboard layouts unless explicitly asked.

### 2. Assistant Message as Primary Information Unit

The main response unit is not a “report page” or “search result page”.
It is the assistant message.

Each assistant message may contain:

- answer_text
- cited authorities
- supporting excerpts
- limitations

### 3. Evidence Must Feel Native to Conversation

Authorities and excerpts should be rendered as:

- inline expandable sections
- attached cards
- side-linked evidence panels

They should support trust without breaking the conversational experience.

### 4. Legal Metadata Matters

Authority cards and case detail views should expose:

- title
- neutral citation
- court
- jurisdiction
- decision date
- paragraph references
- source URL when available

### 5. API-driven UI

Prefer integration with actual FastAPI response schemas as early as possible.

### 6. No Scope Creep

Do not add:

- auth screens
- profile pages
- upload dialogs
- email notifications
- payment flows
- large internal admin consoles

## Expected Pages

### Main Chat Page

Must support:

- conversation thread
- user messages
- assistant messages
- bottom chat composer
- optional sidebar for chat history
- authority cards attached to assistant messages

### Case Detail Page

Must support:

- full metadata view
- summary text
- paragraph-level reader
- navigation from cited authority into document

### Optional Search View

If implemented, it should be secondary to the conversation experience.

## State Management Guidance

Use Zustand for:

- current input
- conversation messages
- loading and error states
- selected authority
- document detail state

Keep state small and workflow-driven.

## API Assumptions

Frontend should expect a FastAPI backend exposing:

- GET /health
- GET /search
- POST /ask
- GET /documents/{document_id}
- GET /documents/{document_id}/paragraphs

Treat `/ask` as the primary user-facing endpoint.

## UI Behavior Guidance

### Conversation Thread

Should resemble modern AI products:

- clean spacing
- readable message width
- clear role distinction
- calm visual hierarchy

### Assistant Messages

Should render:

- answer text
- authority cards
- supporting excerpts
- limitations if present

### Authority Interaction

Clicking an authority should:

- open or navigate to case detail
- preserve legal context
- expose paragraph references

## Code Style Guidance

- Use TypeScript
- Prefer clear, small components
- Avoid large monolithic page files
- Separate chat UI, authority rendering, and document reading concerns
- Use MUI where it speeds up implementation
- Use Tailwind for layout and spacing

Recommended component structure:

- ChatSidebar
- ConversationThread
- UserMessage
- AssistantMessage
- ChatComposer
- AuthorityCard
- CitationBlock
- CaseMetadata
- ParagraphList

## Output Expectations

When using this skill, produce:

- React components
- conversation-first page structures
- Zustand stores
- typed API client functions
- message-oriented rendering logic

All generated frontend work should:

- align with the FastAPI backend
- preserve evidence visibility
- feel like an AI-native legal assistant
- avoid dashboard-first design drift
