# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the email-agent project. ADRs document important architectural decisions made during the development of this project.

## What are ADRs?

Architecture Decision Records are short text documents that capture important architectural decisions made during the development of a software project. Each ADR describes the context, decision, alternatives considered, and consequences of a particular architectural choice.

## ADR Format

All ADRs in this project follow a consistent format defined in [template.md](template.md). Each ADR includes:
- **Context**: The situation that led to the decision
- **Decision**: What was decided
- **Alternatives Considered**: Other options that were evaluated
- **Consequences**: The positive, negative, and neutral outcomes

## ADR Index

### Core Architecture Decisions (High Priority)
- [ADR-001: Google Apps Script Platform Choice](001-google-apps-script-platform.md)
- [ADR-002: Gemini API Integration Architecture](002-gemini-api-integration.md)
- [ADR-003: Label-Based Email Classification System](003-label-based-classification.md)
- [ADR-004: Pluggable Agents Architecture](004-pluggable-agents.md)

### Operational Decisions (Medium Priority)
- [ADR-005: Batch Processing and Budget Management](005-batch-processing-budget.md) (Superseded by ADR-021)
- [ADR-006: Dual Authentication Model](006-dual-authentication.md)
- [ADR-007: Google Drive Rules Document Integration](007-drive-rules-integration.md)

### Implementation Details (Lower Priority)
- [ADR-008: Interactive Web App Integration for Email Agent Dashboard](008-interactive-web-app-integration.md)
- [ADR-009: Deployment Automation Strategy](009-deployment-automation.md)
- [ADR-010: PromptBuilder and LLMService Separation](010-promptbuilder-llmservice-separation.md)
- [ADR-011: Self-Contained Agent Architecture](011-self-contained-agents.md)
- [ADR-012: Generic Service Layer Pattern](012-generic-service-layer.md)
- [ADR-013: Shared Utility Layer for Markdown and Common Functions](013-shared-utility-layer.md)
- [ADR-014: Configuration Management and Ownership](014-configuration-management.md)
- [ADR-015: INSTRUCTIONS vs KNOWLEDGE Configuration Naming Convention](015-instructions-knowledge-naming.md)
- [ADR-016: Label-Synchronized Agent State Management](016-label-synchronized-agent-state.md) (Superseded by ADR-017)
- [ADR-017: Remove UserProperties-Based Agent Idempotency](017-remove-userproperties-idempotency.md)
- [ADR-018: Dual-Hook Agent Architecture](018-dual-hook-agent-architecture.md) ⚠️ Breaking Change
- [ADR-019: Global Knowledge Folder Architecture](019-global-knowledge-folder.md)
- [ADR-020: Todo Forwarder Agent Implementation](020-todo-forwarder-agent.md)
- [ADR-021: Remove Internal Budget Management System](021-remove-internal-budget-management.md) (Supersedes ADR-005)

## Status Legend

- **Proposed**: Decision has been proposed but not yet approved
- **Accepted**: Decision has been approved and is being implemented
- **Deprecated**: Decision is no longer relevant but kept for historical context
- **Superseded**: Decision has been replaced by a newer ADR

## Contributing

When making significant architectural decisions:
1. Create a new ADR using the template
2. Number it sequentially (ADR-XXX)
3. Discuss with the team before marking as "Accepted"
4. Update this index when adding new ADRs