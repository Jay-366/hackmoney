// Agent0 Subgraph GraphQL client
// Queries the ERC-8004 agent registry indexed by The Graph

const SEPOLIA_CHAIN_ID = '11155111';

// GraphQL query for listing agents with pagination
const AGENTS_QUERY = `
  query GetAgents($first: Int!, $skip: Int!) {
    agents(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      agentId
      owner
      agentURI
      totalFeedback
      lastActivity
      registrationFile {
        name
        ens
        webEndpoint
      }
    }
  }
`;

// GraphQL query for fetching a single agent by ID
const AGENT_BY_ID_QUERY = `
  query GetAgent($id: ID!) {
    agent(id: $id) {
      agentId
      owner
      agentURI
      totalFeedback
      lastActivity
      registrationFile {
        name
        ens
        webEndpoint
      }
    }
  }
`;

export interface RegistrationFile {
    name: string | null;
    ens: string | null;
    webEndpoint: string | null;
}

export interface Agent {
    agentId: string;
    owner: string;
    agentURI: string;
    totalFeedback: string;
    lastActivity: string;
    registrationFile: RegistrationFile | null;
}

interface AgentsResponse {
    data?: {
        agents: Agent[];
    };
    errors?: Array<{ message: string }>;
}

interface AgentResponse {
    data?: {
        agent: Agent | null;
    };
    errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query against the Agent0 Subgraph
 */
async function querySubgraph<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const subgraphUrl = process.env.AGENT0_SUBGRAPH_URL;

    if (!subgraphUrl) {
        throw new Error('AGENT0_SUBGRAPH_URL environment variable is not set');
    }

    const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });

    if (!response.ok) {
        throw new Error(`Subgraph query failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
}

/**
 * Fetch agents with pagination, ordered by createdAt desc
 * @param first Number of agents to fetch (max 50)
 * @param skip Number of agents to skip (for pagination)
 */
export async function fetchAgents(first: number = 20, skip: number = 0): Promise<Agent[]> {
    // Clamp first to max 50
    const clampedFirst = Math.min(Math.max(1, first), 50);
    const clampedSkip = Math.max(0, skip);

    const result = await querySubgraph<AgentsResponse>(AGENTS_QUERY, {
        first: clampedFirst,
        skip: clampedSkip,
    });

    if (result.errors && result.errors.length > 0) {
        throw new Error(`Subgraph query errors: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data?.agents ?? [];
}

/**
 * Fetch a single agent by its agentId
 * Uses the subgraph ID format: "chainId:agentId" (e.g., "11155111:123")
 * @param agentId The numeric agent ID
 */
export async function fetchAgentById(agentId: string): Promise<Agent | null> {
    // Build the subgraph entity ID: chainId:agentId
    const subgraphId = `${SEPOLIA_CHAIN_ID}:${agentId}`;

    const result = await querySubgraph<AgentResponse>(AGENT_BY_ID_QUERY, {
        id: subgraphId,
    });

    if (result.errors && result.errors.length > 0) {
        throw new Error(`Subgraph query errors: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data?.agent ?? null;
}
