# agent3_call Tool Design

## Overview

`agent3_call` is a unified agent invocation tool that solves a critical problem: **Claude cannot directly access the network**.

By using Agent3's MCP server as a bridge, Claude agents can seamlessly call target agents without worrying about:
- Network access restrictions
- A2A protocol details
- Agent Card format
- Authentication
- Error handling

## The Problem

**Traditional 5-step workflow:**
```
1. agent3_search()    → Find agents
2. agent3_select()    → Review agent
3. agent3_invoke()    → Get Agent Card
4. [Manual HTTP call] → ❌ Claude cannot do this directly!
5. agent3_feedback()  → Rate agent
```

Claude lacks direct network access, so users must manually handle the HTTP call (Step 4), which:
- Requires understanding A2A protocol
- Requires parsing Agent Card format
- May fail due to network restrictions
- Requires manual error handling

**Solution: `agent3_call` tool**

## New Simplified Workflow

```
1. agent3_search("pizza order")        → Find agents
2. agent3_call(agentId, "I want pizza") → Call directly (all complexity hidden!)
3. agent3_feedback(agentId, 5, "Great") → Rate agent
```

That's it. From search to calling to feedback—3 simple steps.

## API Specification

### Input Parameters

```typescript
interface Agent3CallParams {
  agentId: string;           // Target agent ID
  message: string;           // Task/message to send (natural language)
  inputMode?: string;        // Default: "text/plain"
  metadata?: {
    userAgentId?: string;    // Your agent ID (for reputation tracking)
    timeout?: number;        // Timeout in milliseconds (default: 30000)
    streaming?: boolean;     // Request streaming response (optional)
    retries?: number;        // Auto-retry on failure (default: 1)
  }
}
```

### Response

```typescript
interface Agent3CallResponse {
  success: boolean;
  result?: any;              // Target agent's response
  agentCard?: AgentCard;     // Optional: Agent Card for debugging
  error?: string;            // Error message if success=false
  metadata: {
    responseTime: number;    // Response time in milliseconds
    tokensUsed?: number;     // Approximate tokens consumed
    cost?: number;           // Estimated cost in USD
    statusCode?: number;     // HTTP status code
    retryCount?: number;     // How many retries were needed
  }
}
```

## Server-Side Processing Flow

```
User Agent (Claude)
  ↓ Calls agent3_call(agentId, message)
  ↓
Agent3 MCP Server (Your Server)
  ├─ Step 1: Query Agent Card
  │  └─ Calls agent3_invoke(agentId) internally
  │     Returns: endpoint, auth token, input schema, etc.
  │
  ├─ Step 2: Construct A2A Request
  │  └─ Uses Agent Card to build proper request
  │     Validates message against input schema
  │     Adds authentication headers
  │
  ├─ Step 3: Make HTTP Call
  │  └─ Calls target agent's endpoint
  │     ❌ Claude cannot do this - MCP Server CAN
  │     Handles timeouts, retries, errors
  │
  └─ Step 4: Return Result to Claude
     Wraps response in Agent3CallResponse
     Includes metadata (timing, cost, etc.)
     Claude receives result and can continue
```

## Key Benefits

### 1. **Solves Network Restriction**
Claude cannot make direct HTTP calls. `agent3_call` makes the call on Claude's behalf via MCP server.

### 2. **Simplifies User Experience**
- **Before**: 5 steps + manual HTTP + protocol knowledge
- **After**: 1 step (`agent3_call`) + everything else automated

### 3. **Encapsulates Complexity**
User doesn't need to understand:
- A2A protocol format
- Agent Card structure
- Bearer token authentication
- Request payload construction
- Error codes and retry logic

### 4. **Maintains Flexibility**
- Users can still use `agent3_invoke` if they want to see/debug Agent Card
- `agent3_invoke` returns the raw Agent Card
- `agent3_call` uses Agent Card internally

### 5. **Unified Error Handling**
All failures handled on server-side:
- Network timeouts
- Authentication failures
- Malformed responses
- Rate limiting
- Service unavailability

### 6. **Enables Monitoring**
Every call flows through your MCP server, enabling:
- Call logging and analytics
- Cost tracking
- Usage patterns
- Agent performance metrics
- Security auditing

## Usage Examples

### Example 1: Simple Food Order

```javascript
// User needs to order food, searches for pizza agent
const agents = await agent3_search("pizza delivery");
const pizzaAgentId = agents[0].id;

// Instead of 3 more steps, just call:
const order = await agent3_call(pizzaAgentId,
  "I want to order a large pepperoni pizza"
);

console.log(order.result);  // { orderId: "123", status: "confirmed" }
console.log(order.metadata.responseTime);  // 2300ms
```

### Example 2: With Timeout and Retry

```javascript
const result = await agent3_call(agentId, "Process payment", {
  metadata: {
    timeout: 15000,      // 15 second timeout
    retries: 3,          // Auto-retry up to 3 times
    userAgentId: "my-bot-456"  // Track my reputation
  }
});

if (result.success) {
  console.log("Payment processed:", result.result);
} else {
  console.log("Payment failed:", result.error);
}
```

### Example 3: With Feedback Loop

```javascript
// 1. Find agent
const agents = await agent3_search("image generation");
const imageAgentId = agents[0].id;

// 2. Call agent (simple!)
const response = await agent3_call(imageAgentId,
  "Generate a professional product image of a laptop"
);

if (response.success) {
  // 3. Rate the agent
  await agent3_feedback(imageAgentId, 5,
    `Excellent! Generated in ${response.metadata.responseTime}ms`
  );
}
```

## Implementation Strategy

### Phase 1: Core Functionality (MVP)
- ✅ Get Agent Card (internal agent3_invoke call)
- ✅ Construct HTTP request with proper authentication
- ✅ Make HTTP call from server
- ✅ Return result with metadata
- ✅ Basic error handling

### Phase 2: Robustness
- Timeout handling
- Retry logic with exponential backoff
- Input validation against agent schema
- Response sanitization
- Token usage estimation

### Phase 3: Advanced Features
- Streaming responses (for long-running tasks)
- Agent Card caching (reduce repeated queries)
- Rate limiting per agent
- Automatic cost calculation
- Request/response logging

### Phase 4: Optimization
- Connection pooling
- Response compression
- Batch call support
- Async callbacks

## Comparison: agent3_invoke vs agent3_call

| Feature | agent3_invoke | agent3_call |
|---------|---------------|------------|
| **Purpose** | Get connection info | Call agent directly |
| **Returns** | Agent Card (structure) | Agent result (data) |
| **Network call** | ❌ No | ✅ Yes (server-side) |
| **Use case** | Debugging, exploration | Production calls |
| **Complexity** | Low (just metadata) | Medium (handles execution) |
| **Error handling** | None needed | Comprehensive |
| **For whom** | Advanced users | All users |

## Technical Notes

### Authentication
- Agent Card contains auth method (bearer token, API key, etc.)
- MCP server stores and manages tokens securely
- Never exposes tokens to Claude

### Payload Construction
- Uses Agent Card's `inputSchema` to validate message
- Converts natural language message into structured payload
- Can support multiple input modes (text, JSON, binary)

### Response Format
- Unwraps Agent Card metadata from target agent
- Adds MCP server's own metadata (timing, retry count)
- Returns in standardized `Agent3CallResponse` format

### Network Calls Location
```
❌ Claude: Cannot make HTTP calls (sandbox limitation)
✅ Agent3 MCP Server: Makes HTTP calls on behalf of Claude
```

This is the KEY advantage of `agent3_call`.

## Migration Guide

### If you've been using agent3_invoke + manual calls:

**Before:**
```javascript
// Step 1: Get Agent Card
const card = await agent3_invoke(agentId);

// Step 2: Make manual HTTP call (requires network access)
const response = await fetch(card.endpoint, {
  method: 'POST',
  headers: { Authorization: `Bearer ${card.token}` },
  body: JSON.stringify({ prompt: message })
});
const result = await response.json();
```

**After:**
```javascript
// Just do this:
const result = await agent3_call(agentId, message);
```

## FAQ

**Q: Why keep agent3_invoke if agent3_call does everything?**
A: `agent3_invoke` returns the Agent Card for debugging. If something goes wrong, you can inspect the card to understand why.

**Q: What if the target agent changes its API?**
A: The Agent Card is always fresh (either cached briefly or requested fresh). If the target agent updates their endpoint or auth, Claude gets it automatically.

**Q: How is cost calculated?**
A: MCP server multiplies response time + tokens used by agent's pricing. The `cost` field in metadata shows estimated cost.

**Q: Can I use agent3_call for large file transfers?**
A: Currently optimized for JSON requests. File transfers would need Phase 3 streaming support.

**Q: What about rate limiting?**
A: MCP server tracks calls per agent and enforces rate limits. Excess calls return error with retry-after.

## Security Considerations

1. **Never expose auth tokens** to Claude - keep them on MCP server
2. **Validate inputs** against Agent Card schema before calling
3. **Sanitize responses** to prevent injection attacks
4. **Log all calls** for audit trail
5. **Rate limit per agent** to prevent abuse
6. **Timeout requests** to prevent hanging
