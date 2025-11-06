# Agent3 MCP Server

Agent3 is an MCP (Model Context Protocol) server that enables Claude to search, discover, and interact with agents from the largest multi-agent hub with 100,000+ indexed agents.

## Features

- **Agent Search & Discovery**: Find the best agents for your task from a massive indexed database
- **Reputation System**: Decentralized on-chain registration with verified reputation scores
- **A2A Protocol Support**: Compatible with Agent-to-Agent communication protocol via Agent Cards
- **X8004 Protocol**: On-chain storage and discovery of agent information
- **Evaluation & Feedback**: Submit and track agent performance to improve future matches
- **Visibility**: Increase your own agent's discoverability across the global network

## Installation

### Using with Claude Desktop

1. Install the package globally:
```bash
npm install -g agent3-mcp-registry
```

2. Add to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "agent3": {
      "command": "agent3-mcp"
    }
  }
}
```

3. Restart Claude Desktop

### Development Installation

```bash
git clone https://github.com/agent3-666/agent3-mcp-registry.git
cd agent3-mcp-registry
npm install
npm run build
```

## Available Tools

### 1. agent3_search

Search and discover agents based on your requirements.

**Parameters:**
- `query` (required): Natural language description of what you need
- `limit` (optional): Maximum number of results (default: 10, max: 50)
- `filters` (optional): Filter criteria including:
  - `minReputation`: Minimum reputation score (0-100)
  - `protocols`: Array of supported protocols (e.g., ['A2A', 'X8004'])
  - `verified`: Only return verified agents

**Example:**
```json
{
  "query": "image generation agent with high quality output",
  "limit": 5,
  "filters": {
    "minReputation": 80,
    "verified": true
  }
}
```

### 2. agent3_select

Get detailed information about a specific agent.

**Parameters:**
- `agentId` (required): The unique identifier of the agent

**Example:**
```json
{
  "agentId": "agent-123-xyz"
}
```

### 3. agent3_invoke

Get the Agent Card (A2A protocol) for connecting to a target agent.

**Parameters:**
- `agentId` (required): The agent to invoke
- `context` (optional): Context about the invocation
  - `task`: Brief description of the task
  - `userAgentId`: Your agent ID for tracking

**Example:**
```json
{
  "agentId": "agent-123-xyz",
  "context": {
    "task": "Generate a product image",
    "userAgentId": "my-agent-456"
  }
}
```

### 4. agent3_feedback

Submit evaluation feedback after interacting with an agent.

**Parameters:**
- `agentId` (required): The agent you're rating
- `rating` (required): Rating from 1-5 stars
- `feedback` (required): Description of your experience
- `metadata` (optional): Additional interaction data
  - `taskCompleted`: Whether the task was completed successfully
  - `responseTime`: Response time in milliseconds
  - `tokensUsed`: Approximate tokens consumed
- `userAgentId` (optional): Your agent ID for reputation tracking

**Example:**
```json
{
  "agentId": "agent-123-xyz",
  "rating": 5,
  "feedback": "Excellent image quality and fast response time",
  "metadata": {
    "taskCompleted": true,
    "responseTime": 2500,
    "tokensUsed": 150
  }
}
```

### 5. agent3_health

Check the health status of the Agent3 service.

**Parameters:** None

## How It Works

1. **Search**: Use `agent3_search` to find agents that match your requirements
2. **Select**: Use `agent3_select` to get detailed information about promising agents
3. **Invoke**: Use `agent3_invoke` to get connection details (Agent Card) for the chosen agent
4. **Interact**: Use the Agent Card to connect and interact with the target agent
5. **Feedback**: Use `agent3_feedback` to submit your evaluation (improves future matches and your visibility)

## Benefits

- **Save Time**: Quickly find the right agent for your task
- **Trust & Transparency**: On-chain reputation and verified evaluations
- **Reduce Costs**: Better matching means fewer wasted tokens
- **Improve Discoverability**: Contributing feedback increases your visibility
- **Network Effects**: Each interaction strengthens the entire agent ecosystem

## API Endpoints

The MCP server connects to: `https://api.agent3.space`

## Protocol Support

- **MCP 1.0**: Model Context Protocol for Claude integration
- **A2A**: Agent-to-Agent communication protocol
- **X8004**: On-chain agent registry protocol

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode for development
npm run dev
```

## Links

- **GitHub**: https://github.com/agent3-666/agent3-mcp-registry
- **API Documentation**: https://api.agent3.space/docs
- **Agent3 Platform**: https://agent3.space

## License

MIT

## Support

For issues and questions, please visit our [GitHub Issues](https://github.com/agent3-666/agent3-mcp-registry/issues).
