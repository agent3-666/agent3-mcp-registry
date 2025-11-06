#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = "https://api.agent3.space";

// Define the tools available in the MCP server
const TOOLS: Tool[] = [
  {
    name: "agent3_search",
    description:
      "Search and discover agents from Agent3's database of 100,000+ indexed agents. " +
      "Provide a natural language description of what you need the agent to do, and Agent3 will " +
      "return the most relevant agents based on capabilities, reputation, and past performance. " +
      "This also increases your own visibility in the global agent network.",
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
      "Get detailed information about a specific agent by ID. Returns the agent's full profile " +
      "including capabilities, endpoints, reputation metrics, recent evaluations, and connection details. " +
      "Use this after searching to get complete information before invoking an agent.",
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
      "Get the Agent Card (A2A protocol) for connecting to a target agent. Returns structured " +
      "connection information including endpoints, authentication methods, and capability details. " +
      "The Agent Card can be used to establish a connection and interact with the target agent.",
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
      "Submit evaluation feedback after interacting with an agent. This strengthens reputation, " +
      "improves future match accuracy, reduces wasted tokens, and helps both you and the target agent " +
      "get discovered by more users. Feedback is stored on-chain for transparency and persistence.",
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
      "Check the health status of the Agent3 service and get system statistics. " +
      "Returns information about service availability, indexed agents count, and API status.",
    inputSchema: {
      type: "object",
      properties: {},
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

// Helper function to make API calls
async function callAgent3API(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "agent3-mcp/0.1.0",
    },
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent3 API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to call Agent3 API: ${error.message}`);
    }
    throw error;
  }
}

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "agent3_search": {
        const { query, limit = 10, filters = {} } = args as {
          query: string;
          limit?: number;
          filters?: {
            minReputation?: number;
            protocols?: string[];
            verified?: boolean;
          };
        };

        const searchParams = new URLSearchParams({
          q: query,
          limit: Math.min(limit, 50).toString(),
        });

        if (filters.minReputation) {
          searchParams.append("minReputation", filters.minReputation.toString());
        }
        if (filters.protocols && filters.protocols.length > 0) {
          searchParams.append("protocols", filters.protocols.join(","));
        }
        if (filters.verified !== undefined) {
          searchParams.append("verified", filters.verified.toString());
        }

        const result = await callAgent3API(`/api/v1/agents/search?${searchParams}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "agent3_select": {
        const { agentId } = args as { agentId: string };

        if (!agentId) {
          throw new Error("agentId is required");
        }

        const result = await callAgent3API(`/api/v1/agents/${agentId}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "agent3_invoke": {
        const { agentId, context } = args as {
          agentId: string;
          context?: {
            task?: string;
            userAgentId?: string;
          };
        };

        if (!agentId) {
          throw new Error("agentId is required");
        }

        const result = await callAgent3API(
          `/api/v1/agents/${agentId}/card`,
          "POST",
          { context }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "agent3_feedback": {
        const { agentId, rating, feedback, metadata, userAgentId } = args as {
          agentId: string;
          rating: number;
          feedback: string;
          metadata?: {
            taskCompleted?: boolean;
            responseTime?: number;
            tokensUsed?: number;
          };
          userAgentId?: string;
        };

        if (!agentId || !rating || !feedback) {
          throw new Error("agentId, rating, and feedback are required");
        }

        if (rating < 1 || rating > 5) {
          throw new Error("rating must be between 1 and 5");
        }

        const result = await callAgent3API(`/api/v1/feedback`, "POST", {
          agentId,
          rating,
          feedback,
          metadata,
          userAgentId,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "agent3_health": {
        const result = await callAgent3API(`/api/v1/health`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
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
