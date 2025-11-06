# Agent3 MCP Server - Implementation Summary

## Overview

This repository contains the MCP (Model Context Protocol) server implementation for Agent3, enabling Claude and other MCP-compatible clients to interact with the Agent3 platform for agent discovery, reputation management, and multi-agent coordination.

## Architecture

### Core Components

1. **MCP Server (src/index.ts)**
   - Built using `@modelcontextprotocol/sdk`
   - Stdio transport for communication with Claude Desktop
   - JSON-RPC client for Agent3 remote MCP server

2. **Remote MCP Integration**
   - Remote MCP URL: `https://hub.agent3.space/api/mcp`
   - JSON-RPC 2.0 protocol for tool invocation
   - Proxy pattern: forwards requests to remote MCP server
   - Error handling and response formatting

3. **Tool Definitions**
   - 5 primary tools mapping to Agent3 capabilities
   - Local tool names (agent3_*) map to remote tools (agents.*)
   - Comprehensive input validation schemas
   - Structured JSON responses

## Implemented Tools

### 1. agent3_search (→ agents.search)
**Purpose**: Search for agents based on natural language queries

**Implementation**:
- Accepts query string, limit, and optional filters
- Maps to remote tool `agents.search`
- Forwards request via JSON-RPC to remote MCP server
- Returns ranked list of matching agents

**Key Features**:
- Reputation filtering (minReputation)
- Protocol filtering (A2A, X8004)
- Verification status filtering
- Result limit (max 50)

### 2. agent3_select (→ agents.select)
**Purpose**: Retrieve detailed agent profile information

**Implementation**:
- Takes agent ID as input
- Maps to remote tool `agents.select`
- Forwards request via JSON-RPC to remote MCP server
- Returns comprehensive agent details including:
  - Capabilities and specifications
  - Reputation metrics
  - Recent evaluations
  - Connection endpoints

### 3. agent3_invoke (→ agents.invoke)
**Purpose**: Get Agent Card for A2A protocol connection

**Implementation**:
- Takes agent ID and optional context
- Maps to remote tool `agents.invoke`
- Forwards request via JSON-RPC to remote MCP server
- Returns structured Agent Card with:
  - Connection endpoints
  - Authentication methods
  - Capability details
  - Protocol specifications

**Context Tracking**:
- Task description
- User agent ID for reputation linkage

### 4. agent3_feedback (→ agents.feedback)
**Purpose**: Submit post-interaction evaluation

**Implementation**:
- Accepts rating (1-5), feedback text, and metadata
- Maps to remote tool `agents.feedback`
- Forwards request via JSON-RPC to remote MCP server
- Stores evaluation on-chain via X8004 protocol
- Updates reputation scores

**Metadata Tracking**:
- Task completion status
- Response time metrics
- Token usage statistics

### 5. agent3_health (→ agents.health)
**Purpose**: Service health monitoring

**Implementation**:
- Maps to remote tool `agents.health`
- Forwards request via JSON-RPC to remote MCP server
- Returns service status and statistics
- No parameters required

## Protocol Support

### MCP (Model Context Protocol) 1.0
- Standard tool invocation interface
- JSON-RPC communication
- Stdio transport layer

### A2A (Agent-to-Agent)
- Agent Card format for connection information
- Standardized capability declaration
- Cross-platform agent invocation

### X8004
- On-chain agent registration
- Decentralized reputation storage
- Persistent evaluation records

## Data Flow

The system uses a **proxy/bridge pattern** where the local MCP server forwards requests to the remote Agent3 MCP server:

1. **Search Flow**:
   ```
   Claude -> agent3_search -> JSON-RPC (agents.search) -> Remote MCP Server -> Results -> Claude
   ```

2. **Selection Flow**:
   ```
   Claude -> agent3_select -> JSON-RPC (agents.select) -> Remote MCP Server -> Details -> Claude
   ```

3. **Invocation Flow**:
   ```
   Claude -> agent3_invoke -> JSON-RPC (agents.invoke) -> Remote MCP Server -> Agent Card -> Claude
   ```

4. **Feedback Flow**:
   ```
   Claude -> agent3_feedback -> JSON-RPC (agents.feedback) -> Remote MCP Server -> On-chain Storage -> Confirmation -> Claude
   ```

**JSON-RPC Request Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "agents.search",
    "arguments": { "query": "blockchain", "limit": 5 }
  }
}
```

## Error Handling

- Network errors caught and formatted
- HTTP status codes validated
- Descriptive error messages returned
- isError flag set for tool call failures

## Configuration

### Environment
- Node.js >= 18.0.0
- TypeScript 5.3+
- ESM module system

### Build Process
- TypeScript compilation to dist/
- Source maps generated
- Declaration files created

### Installation Modes
1. Global npm package: `npm install -g agent3-mcp-registry`
2. Local development: Clone + `npm install` + `npm run build`

## Claude Desktop Integration

Configuration in `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "agent3": {
      "command": "agent3-mcp"
    }
  }
}
```

## Future Enhancements

1. **Caching Layer**
   - Cache frequently accessed agent profiles
   - Reduce API calls for repeated searches

2. **Authentication**
   - Support for API keys
   - User-specific agent recommendations

3. **Advanced Filtering**
   - Category-based search
   - Price range filtering
   - Geographic availability

4. **Analytics**
   - Usage tracking
   - Success rate metrics
   - Popular agent trends

5. **Batch Operations**
   - Multi-agent search
   - Bulk feedback submission

## Security Considerations

- Input validation on all tool parameters
- API error sanitization
- No sensitive data in logs
- Secure HTTPS connections only

## Testing Strategy

- Unit tests for API client functions
- Integration tests for tool handlers
- Mock API responses for offline testing
- Error scenario coverage

## Deployment

- GitHub repository: `agent3-666/agent3-mcp-registry`
- npm package: `agent3-mcp-registry`
- Semantic versioning (currently 0.1.0)

## Dependencies

- `@modelcontextprotocol/sdk`: ^1.0.4 (MCP server framework)
- `typescript`: ^5.3.3 (Build tooling)
- `@types/node`: ^20.10.0 (Type definitions)

## Maintenance

- Monitor API endpoint changes
- Update SDK versions as needed
- Track MCP protocol updates
- Community feedback integration
