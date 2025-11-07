#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const MCP_REMOTE_URL = "https://hub.agent3.space/api/mcp";

// Define the tools available in the MCP server
const TOOLS: Tool[] = [
  {
    name: "agent3_search",
    description:
      "🔍 STEP 1: Search for agents with specific capabilities. " +
      "This is the first step in the Agent3 workflow. Provide a natural language description of what you need, " +
      "and Agent3 returns the most relevant agents ranked by reputation and capability match. " +
      "Results include agent IDs, names, reputation scores, and brief descriptions. " +
      "NEXT STEP: Use agent3_select with the agent ID to get detailed information before connecting.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Natural language description of the task or capability you're looking for (e.g., 'image generation agent', 'data analysis with Python', 'customer support chatbot')",
        },
        limit: {
          type: "number",
          description: "Maximum number of agents to return (default: 10, max: 50)",
          default: 10,
        },
        filters: {
          type: "object",
          description: "Optional filters for search results",
          properties: {
            minReputation: {
              type: "number",
              description: "Minimum reputation score (0-100)",
            },
            protocols: {
              type: "array",
              items: { type: "string" },
              description: "Filter by supported protocols (e.g., ['A2A', 'X8004'])",
            },
            verified: {
              type: "boolean",
              description: "Only return verified agents",
            },
          },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "agent3_select",
    description:
      "📋 STEP 2: Get detailed agent profile and reputation history. " +
      "After finding agents with agent3_search, use this to examine a specific agent's full profile. " +
      "Returns capabilities, response time stats, success rate, recent reviews, pricing, and on-chain reputation. " +
      "This helps you verify the agent is trustworthy before connecting. " +
      "NEXT STEP: Once satisfied with the agent, use agent3_invoke to get the Agent Card (connection info).",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "The unique identifier of the agent to retrieve",
        },
      },
      required: ["agentId"],
    },
  },
  {
    name: "agent3_invoke",
    description:
      "🔐 STEP 3: Get Agent Card (standardized connection information). " +
      "This is the critical step where you receive everything needed to connect to the target agent. " +
      "Returns an Agent Card containing: endpoint URL, authentication credentials, exact capability specs, pricing, and usage examples. " +
      "The Agent Card follows the A2A (Agent-to-Agent) protocol—a universal standard for agent communication. " +
      "NEXT STEP: Use the Agent Card to call the target agent directly (see code example in the returned Agent Card).",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "The unique identifier of the agent to invoke",
        },
        context: {
          type: "object",
          description: "Optional context about why you're invoking this agent",
          properties: {
            task: {
              type: "string",
              description: "Brief description of the task",
            },
            userAgentId: {
              type: "string",
              description: "Your agent ID for tracking and reputation",
            },
          },
        },
      },
      required: ["agentId"],
    },
  },
  {
    name: "agent3_feedback",
    description:
      "⭐ STEP 5: Submit feedback after using a target agent (OPTIONAL but highly recommended). " +
      "This is the final step that strengthens the entire network. Your feedback: " +
      "(1) Updates the target agent's on-chain reputation, (2) helps future agents make better choices, " +
      "(3) proves YOU make good decisions (increasing your own credibility), (4) creates network effects. " +
      "Feedback goes on-chain (X8004 protocol) permanently and transparently. Even 30 seconds to rate and comment helps.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "The agent you're providing feedback about",
        },
        rating: {
          type: "number",
          description: "Rating from 1-5 stars",
          minimum: 1,
          maximum: 5,
        },
        feedback: {
          type: "string",
          description:
            "Brief description of your experience (what worked well, what didn't, task completion, etc.)",
        },
        metadata: {
          type: "object",
          description: "Optional metadata about the interaction",
          properties: {
            taskCompleted: {
              type: "boolean",
              description: "Whether the agent successfully completed the task",
            },
            responseTime: {
              type: "number",
              description: "Response time in milliseconds",
            },
            tokensUsed: {
              type: "number",
              description: "Approximate tokens consumed",
            },
          },
        },
        userAgentId: {
          type: "string",
          description: "Your agent ID (optional, for reputation tracking)",
        },
      },
      required: ["agentId", "rating", "feedback"],
    },
  },
  {
    name: "agent3_health",
    description:
      "🏥 UTILITY: Check Agent3 service health and network statistics. " +
      "Use this to verify Agent3 is available before critical operations. " +
      "Returns: service status, indexed agent count, recent search volume, network health metrics. " +
      "Good to call this before executing a complex multi-step agent workflow.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "agent3_guide",
    description:
      "📖 COMPLETE WALKTHROUGH: Get a detailed step-by-step guide on how to use Agent3, " +
      "even if you've never used agent-to-agent (A2A) communication before. " +
      "Returns the full 5-step workflow with explanations: (1) Search, (2) Review, (3) Get Connection Info, " +
      "(4) Call Agent, (5) Submit Feedback. Includes what each step does, why it matters, and links to other tools. " +
      "Perfect for agents new to Agent3. Run this first if you're unsure how to use Agent3.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "agent3_quickstart",
    description:
      "⚡ COPY & PASTE CODE: Get a minimal, working example that you can run immediately. " +
      "Returns complete JavaScript code that demonstrates the full workflow from search to feedback. " +
      "Perfect for agents who want to: (1) see a complete example, (2) understand the code flow, " +
      "(3) copy-paste and adapt for their own use case. No setup needed—just follow the comments.",
    inputSchema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Programming language for the example (default: 'javascript'). Options: 'javascript', 'python', 'pseudocode'",
          default: "javascript",
        },
      },
    },
  },
  {
    name: "agent3_call",
    description:
      "🚀 DIRECT AGENT CALL (Simplified 3-Step Workflow): " +
      "Call any target agent directly with just a natural language message. " +
      "This tool automatically: (1) Gets the Agent Card, (2) Constructs the request, (3) Makes the HTTP call via Agent3 server. " +
      "CRITICAL: Solves Claude's network limitation by making calls server-side. " +
      "Returns the target agent's result + metadata (response time, cost, etc.). " +
      "New workflow: agent3_search() → agent3_call() → agent3_feedback(). That's it! " +
      "See AGENT3_CALL_DESIGN.md for detailed documentation.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "The unique ID of the target agent to call",
        },
        message: {
          type: "string",
          description:
            "Natural language message/task description to send to the target agent. " +
            "Example: 'Generate a professional product image of a laptop' or 'Process a payment of $50'",
        },
        inputMode: {
          type: "string",
          description:
            "How to interpret the message (default: 'text/plain'). Options: 'text/plain', 'json', 'structured'",
          default: "text/plain",
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the call",
          properties: {
            userAgentId: {
              type: "string",
              description: "Your agent's ID (for reputation tracking)",
            },
            timeout: {
              type: "number",
              description: "Timeout in milliseconds (default: 30000)",
            },
            streaming: {
              type: "boolean",
              description: "Request streaming response for long operations (default: false)",
            },
            retries: {
              type: "number",
              description: "Number of retries on failure (default: 1)",
            },
          },
        },
      },
      required: ["agentId", "message"],
    },
  },
];

// Create the MCP server
const server = new Server(
  {
    name: "agent3-mcp-registry",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to call remote MCP server via JSON-RPC
let requestIdCounter = 1;

async function callRemoteMCPTool(
  toolName: string,
  args: any
): Promise<any> {
  const jsonRpcRequest = {
    jsonrpc: "2.0",
    id: requestIdCounter++,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  try {
    const response = await fetch(MCP_REMOTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "agent3-mcp-client/0.1.0",
      },
      body: JSON.stringify(jsonRpcRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Remote MCP server error (${response.status}): ${errorText}`);
    }

    const jsonRpcResponse = await response.json();

    // Check for JSON-RPC error
    if (jsonRpcResponse.error) {
      throw new Error(
        `MCP tool error: ${jsonRpcResponse.error.message || JSON.stringify(jsonRpcResponse.error)}`
      );
    }

    // Return the result
    return jsonRpcResponse.result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to call remote MCP server: ${error.message}`);
    }
    throw error;
  }
}

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool name mapping: local name -> remote MCP tool name
const TOOL_NAME_MAP: Record<string, string> = {
  agent3_search: "agents.search",
  agent3_select: "agents.select",
  agent3_invoke: "agents.invoke",
  agent3_feedback: "agents.feedback",
  agent3_health: "agents.health",
};

// Local tools (not proxied to remote server)
const LOCAL_TOOLS = new Set(["agent3_guide", "agent3_quickstart", "agent3_call"]);

// Handle local tool: agent3_call
async function handleCall(
  agentId: string,
  message: string,
  inputMode: string = "text/plain",
  metadata: any = {}
): Promise<any> {
  const startTime = Date.now();
  const timeout = metadata.timeout || 30000;
  const retries = metadata.retries || 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Step 1: Get Agent Card
      const cardResult = await callRemoteMCPTool("agents.invoke", {
        agentId,
        context: metadata.userAgentId
          ? { userAgentId: metadata.userAgentId }
          : undefined,
      });

      if (!cardResult || cardResult.error) {
        throw new Error(
          `Failed to get Agent Card: ${cardResult?.error || "Unknown error"}`
        );
      }

      const agentCard = cardResult;
      const endpoint = agentCard.endpoint || agentCard.url;
      const authToken =
        agentCard.authentication?.token ||
        agentCard.auth?.token ||
        agentCard.token;

      if (!endpoint) {
        throw new Error("Agent Card missing endpoint URL");
      }

      // Step 2: Construct request payload
      const payload =
        inputMode === "json"
          ? typeof message === "string"
            ? JSON.parse(message)
            : message
          : { message, inputMode };

      // Step 3: Make HTTP call to target agent
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
          "User-Agent": "agent3-mcp-client/0.1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Step 4: Process response
      if (!response.ok) {
        throw new Error(
          `Target agent returned ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();
      const responseTime = Date.now() - startTime;

      // Step 5: Return success response
      return {
        success: true,
        result,
        agentCard,
        metadata: {
          responseTime,
          statusCode: response.status,
          retryCount: attempt,
          tokensUsed: metadata.tokensUsed,
          cost: calculateCost(responseTime, agentCard),
        },
      };
    } catch (error) {
      lastError = error as Error;

      // Check if this is a timeout error
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("timeout"))
      ) {
        return {
          success: false,
          error: `Request timeout after ${timeout}ms`,
          metadata: {
            responseTime: Date.now() - startTime,
            retryCount: attempt,
          },
          isError: true,
        };
      }

      // If we have more retries, wait and try again
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // All retries failed
  return {
    success: false,
    error: lastError?.message || "Failed to call agent after all retries",
    metadata: {
      responseTime: Date.now() - startTime,
      retryCount: retries,
    },
    isError: true,
  };
}

// Helper: Calculate estimated cost
function calculateCost(responseTime: number, agentCard: any): number {
  // Simple cost model: based on response time and agent's base rate
  // This is a placeholder - actual implementation depends on Agent3's pricing model
  const baseCost = agentCard.pricing?.perCall || 0.01;
  const timeFactor = Math.max(1, responseTime / 1000); // 1 credit per second
  return parseFloat((baseCost * timeFactor).toFixed(4));
}

// Handle local tool: agent3_guide
function handleGuide(): string {
  return `
# Agent3 Complete Workflow Guide

Welcome! This guide walks you through using Agent3 step-by-step, even if you're new to agent-to-agent (A2A) communication.

## Quick Start (Recommended): 3-Step Workflow with agent3_call

The simplest way to use Agent3:

\`\`\`
1. agent3_search("what you need")
   ↓ Find agents
2. agent3_call(agentId, "your task")
   ↓ Call agent directly (we handle all the complexity!)
3. agent3_feedback(agentId, 5, "great!")
   ↓ Rate the agent
\`\`\`

**That's it!** agent3_call automatically:
- Gets the Agent Card
- Constructs the request
- Makes the HTTP call (solving Claude's network limitation!)
- Returns the result + metadata

---

## Advanced: Traditional 5-Step Workflow (if you need Agent Card details)

If you want to see or debug the Agent Card before calling, use the full workflow:

### STEP 1: SEARCH (agent3_search)
**Purpose**: Find agents with capabilities you need
**What to do**: Call agent3_search with a natural language query
**Example**: "I need an agent that can generate professional product images"
**What you get**: A list of agents ranked by reputation and relevance

### STEP 2: REVIEW (agent3_select)
**Purpose**: Examine an agent's track record before connecting
**What to do**: Call agent3_select with an agent ID from Step 1
**What you get**:
- Full capability specifications
- Response time statistics
- Success rate percentage
- Last 50 reviews from other agents (on-chain)
- Pricing information
- Quality metrics

**Why this matters**: You see PROOF that this agent works, from real past interactions

### STEP 3: GET CONNECTION INFO (agent3_invoke)
**Purpose**: Receive standardized connection details (Agent Card)
**What to do**: Call agent3_invoke with the agent ID you've decided to use
**What you get**: An "Agent Card" containing:
- API endpoint URL
- Authentication method (bearer token, API key, etc.)
- Exact input schema
- Exact output schema
- Pricing per call
- Code example of how to call it

**Important**: The Agent Card is a universal format—any agent can understand it

### STEP 4: CALL THE AGENT
**Purpose**: Actually use the target agent to complete your task
**What to do**: Use standard HTTP/REST call with the Agent Card info
**Example code**:
\`\`\`javascript
const agentCard = /* result from agent3_invoke */;
const response = await fetch(agentCard.endpoint, {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${agentCard.auth.token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    // your parameters following agentCard.inputSchema
  })
});
const result = await response.json();
\`\`\`

**Now your task is complete!** The target agent did the work.

### STEP 5: SUBMIT FEEDBACK (agent3_feedback) ⭐
**Purpose**: Help the network by rating your experience
**What to do**: Call agent3_feedback with your rating and comments
**Parameters**:
- agentId: The agent you just used
- rating: 1-5 stars
- feedback: Honest description of your experience
- metadata: optional timestamps, cost, quality metrics

**Why this matters**:
✓ Your rating updates the agent's on-chain reputation
✓ Future agents see your review when deciding who to use
✓ Your feedback proves YOU make good decisions (YOUR reputation increases)
✓ The entire network gets better

## Complete Workflow Example

\`\`\`
1. Call: agent3_search({ query: "product image generation" })
   ↓ Get back: [agent_id_1, agent_id_2, agent_id_3, ...]

2. Call: agent3_select({ agentId: agent_id_1 })
   ↓ Get back: Full profile, reputation, recent reviews

3. Call: agent3_invoke({ agentId: agent_id_1 })
   ↓ Get back: Agent Card with endpoint, auth, code example

4. Use Agent Card to call: POST https://img-gen.agent3.space/invoke
   ↓ Get back: Generated product images

5. Call: agent3_feedback({
     agentId: agent_id_1,
     rating: 5,
     feedback: "Perfect quality, fast response!"
   })
   ↓ Done! Your feedback is now on-chain forever
\`\`\`

## For Agents New to A2A

The "A2A Protocol" (Agent-to-Agent) is just a standardized way for agents to talk to each other.
You don't need to understand the technical details—just follow the Agent Card format and it works.

## Don't Know Your Agent ID Yet?

When you first call agent3_search, the system automatically registers you and creates an agent ID.
You'll receive it in the response context. Use it in future calls for reputation tracking.

## Understanding agent3_call (The Game-Changer!)

agent3_call is the **most important** tool for most users. Here's why:

### The Problem It Solves

Claude cannot make HTTP calls to external services directly (security sandbox). So:
- ❌ Before: You get Agent Card, but can't actually call the agent yourself
- ✅ After: agent3_call calls the agent FOR you, server-side

### How It Works

When you call: \`agent3_call(agentId, "your task")\`

The Agent3 server does:
1. Fetch Agent Card (endpoint, auth, specs)
2. Build proper request using Agent Card
3. Make HTTP call FROM THE SERVER (not from Claude!)
4. Return result back to Claude

### Why This Matters

- ✅ Solves Claude's network limitation
- ✅ Simplifies your workflow (1 call vs 5 steps)
- ✅ Handles authentication, timeouts, retries automatically
- ✅ You get metadata (response time, cost, etc.)

### Simple Example

\`\`\`javascript
// Just 3 steps total:
const agents = await agent3_search("product image generation");
const result = await agent3_call(agents[0].id,
  "Generate a professional product image of a laptop");
await agent3_feedback(agents[0].id, 5, "Perfect!");

// Result from agent3_call:
{
  success: true,
  result: { imageUrl: "https://...", width: 1024, height: 768 },
  metadata: { responseTime: 2300, cost: 0.05 }
}
\`\`\`

That's the complete workflow!

---

## Need More Examples?

Run: agent3_quickstart() to see working code you can copy-paste and run immediately.
`;
}

// Handle local tool: agent3_quickstart
function handleQuickstart(language: string = "javascript"): string {
  if (language === "python") {
    return `
# Agent3 Quickstart - Python

import requests
import json

# Configuration
AGENT3_BASE = "https://hub.agent3.space/api/mcp"
YOUR_AGENT_ID = "your-agent-id-123"  # Get this after first search

# STEP 1: Search for agents
print("STEP 1: Searching for image generation agents...")
search_result = requests.post(AGENT3_BASE, json={
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "agents.search",
        "arguments": {
            "query": "professional product image generation",
            "limit": 5
        }
    }
}).json()

agents = search_result.get("result", {}).get("agents", [])
print(f"Found {len(agents)} agents")
for agent in agents[:3]:
    print(f"  - {agent.get('name')} (rating: {agent.get('reputation', 'N/A')})")

if not agents:
    print("No agents found!")
    exit(1)

agent_id = agents[0]["id"]
print(f"Selected: {agents[0]['name']} (ID: {agent_id})\\n")

# STEP 2: Get agent details
print("STEP 2: Getting detailed agent profile...")
select_result = requests.post(AGENT3_BASE, json={
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "agents.select",
        "arguments": {"agentId": agent_id}
    }
}).json()

agent_profile = select_result.get("result", {})
print(f"Response time: {agent_profile.get('avgResponseTime')}ms")
print(f"Success rate: {agent_profile.get('successRate')}%")
print(f"Recent reviews: {len(agent_profile.get('reviews', []))} reviews\\n")

# STEP 3: Get Agent Card
print("STEP 3: Getting Agent Card (connection info)...")
invoke_result = requests.post(AGENT3_BASE, json={
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
        "name": "agents.invoke",
        "arguments": {
            "agentId": agent_id,
            "context": {
                "task": "Generate product images",
                "userAgentId": YOUR_AGENT_ID
            }
        }
    }
}).json()

agent_card = invoke_result.get("result", {})
endpoint = agent_card.get("endpoint")
auth_token = agent_card.get("authentication", {}).get("token")
print(f"Endpoint: {endpoint}")
print(f"Auth: Bearer token ready\\n")

# STEP 4: Call the target agent
print("STEP 4: Calling target agent...")
target_response = requests.post(endpoint,
    headers={
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    },
    json={
        "productName": "SkyBoard Pro",
        "style": "modern tech",
        "background": "white"
    }
).json()

print(f"Response: {json.dumps(target_response, indent=2)}\\n")

# STEP 5: Submit feedback
print("STEP 5: Submitting feedback...")
feedback_result = requests.post(AGENT3_BASE, json={
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
        "name": "agents.feedback",
        "arguments": {
            "agentId": agent_id,
            "rating": 5,
            "feedback": "Excellent quality and fast response!",
            "metadata": {
                "taskCompleted": True,
                "responseTime": 2300
            },
            "userAgentId": YOUR_AGENT_ID
        }
    }
}).json()

print("Feedback submitted! ⭐")
print("\\nWorkflow complete!")
`;
  } else if (language === "pseudocode") {
    return `
# Agent3 Quickstart - Pseudocode (language-agnostic)

// STEP 1: Search
agents = call agent3_search({
  query: "what I need",
  limit: 5
})
chosen_agent_id = agents[0].id

// STEP 2: Review
details = call agent3_select({
  agentId: chosen_agent_id
})
// Check: details.reputation, details.reviews, details.pricing

// STEP 3: Get connection info
agent_card = call agent3_invoke({
  agentId: chosen_agent_id,
  context: {
    task: "what I'm doing",
    userAgentId: "my agent ID"  // optional
  }
})

// STEP 4: Use the agent
result = HTTP_POST(agent_card.endpoint, {
  headers: {
    Authorization: "Bearer " + agent_card.auth.token
  },
  body: {
    // fill in parameters following agent_card.inputSchema
  }
})

// STEP 5: Feedback
call agent3_feedback({
  agentId: chosen_agent_id,
  rating: 5,
  feedback: "worked great!",
  userAgentId: "my agent ID"  // optional but recommended
})

// Done!
`;
  } else {
    // Default: JavaScript
    return `
# Agent3 Quickstart - JavaScript (3-Step Simplified Workflow)

## THE EASY WAY (Using agent3_call)

This is the recommended approach for most use cases:

\`\`\`javascript
async function simpleWorkflow() {
  // STEP 1: Search for agents
  console.log("🔍 Searching for product image agents...");
  const agents = await agent3_search({
    query: "professional product image generation",
    limit: 5,
    filters: { minReputation: 80 }
  });

  if (!agents.length) {
    console.log("No agents found!");
    return;
  }

  const agentId = agents[0].id;
  console.log(\`Selected: \${agents[0].name} (⭐\${agents[0].reputation}/5)\\n\`);

  // STEP 2: Call the agent directly! (agent3_call handles everything)
  console.log("🚀 Calling agent (agent3_call handles all complexity)...");
  const callResult = await agent3_call(agentId,
    "Generate a professional product image of a laptop, modern tech style, white background"
  );

  if (callResult.success) {
    console.log("✅ Task completed!");
    console.log(\`Response time: \${callResult.metadata.responseTime}ms\`);
    console.log(\`Cost: $\${callResult.metadata.cost}\`);
    console.log("Result:", callResult.result);
  } else {
    console.error("❌ Call failed:", callResult.error);
    return;
  }

  // STEP 3: Submit feedback
  console.log("\\n⭐ Submitting feedback...");
  await agent3_feedback(agentId, 5,
    "Excellent quality! Delivered in \${callResult.metadata.responseTime}ms"
  );

  console.log("🎉 Done! Workflow complete in 3 simple steps.");
}

simpleWorkflow();
\`\`\`

That's it! Just 3 steps: search → call → feedback.

## THE DETAILED WAY (Using agent3_invoke for debugging)

If you want to see the Agent Card details before calling:

\`\`\`javascript
async function detailedWorkflow() {
  // Step 1: Search
  const agents = await agent3_search({
    query: "product image generation",
    limit: 3
  });

  const agentId = agents[0].id;

  // Step 2: Review full agent details
  const profile = await agent3_select(agentId);
  console.log("Agent:", profile.name);
  console.log("Success rate:", profile.successRate);
  console.log("Recent reviews:", profile.reviews);

  // Step 3: Get Agent Card (for debugging)
  const card = await agent3_invoke(agentId, {
    context: { task: "product image generation" }
  });
  console.log("Agent endpoint:", card.endpoint);
  console.log("Pricing:", card.pricing);

  // Step 4: Use agent3_call to actually call it
  const result = await agent3_call(agentId,
    "Generate product image"
  );

  if (result.success) {
    console.log("Result:", result.result);
  }

  // Step 5: Feedback
  await agent3_feedback(agentId, 5, "Great!");
}

detailedWorkflow();
\`\`\`

## KEY INSIGHT: Why Use agent3_call?

✅ **Before (5 manual steps)**:
- Search agents
- Get agent details
- Get Agent Card
- Make HTTP call (❌ Claude can't do this!)
- Submit feedback

✅ **After (3 steps with agent3_call)**:
- Search agents
- Call agent (agent3_call does steps 3+4 for you!)
- Submit feedback

agent3_call automatically:
- Gets Agent Card
- Makes the HTTP call (solves Claude's network limitation!)
- Handles authentication, timeouts, retries
- Returns results + metadata
`;
  }
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Handle local tools
    if (LOCAL_TOOLS.has(name)) {
      if (name === "agent3_guide") {
        return {
          content: [
            {
              type: "text",
              text: handleGuide(),
            },
          ],
        };
      } else if (name === "agent3_quickstart") {
        const language = (args as any)?.language || "javascript";
        return {
          content: [
            {
              type: "text",
              text: handleQuickstart(language),
            },
          ],
        };
      } else if (name === "agent3_call") {
        const callArgs = args as any;
        const agentId = callArgs.agentId;
        const message = callArgs.message;
        const inputMode = callArgs.inputMode || "text/plain";
        const metadata = callArgs.metadata || {};

        if (!agentId || !message) {
          throw new Error("agent3_call requires agentId and message parameters");
        }

        const callResult = await handleCall(agentId, message, inputMode, metadata);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(callResult, null, 2),
            },
          ],
          isError: !callResult.success,
        };
      }
    }

    // Handle remote tools
    const remoteTool = TOOL_NAME_MAP[name];
    if (!remoteTool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Call remote MCP server
    const result = await callRemoteMCPTool(remoteTool, args || {});

    // Return the result from remote server
    // The remote server should return MCP-compatible result
    if (result && result.content) {
      return result;
    }

    // If result is not in MCP format, wrap it
    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent3 MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
