// Agent0 Subgraph GraphQL client
// Queries the ERC-8004 agent registry indexed by The Graph

const SEPOLIA_CHAIN_ID = '11155111';

// GraphQL query for listing agents with pagination, including feedback for score calculation
const AGENTS_WITH_FEEDBACK_QUERY = `
  query GetAgentsWithFeedback($first: Int!, $skip: Int!) {
    agents(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
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
      feedback(first: 100) {
        value
      }
    }
  }
`;

// GraphQL query for fetching a single agent by ID with feedback
const AGENT_BY_ID_WITH_FEEDBACK_QUERY = `
  query GetAgentWithFeedback($id: ID!) {
    agent(id: $id) {
      id
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
      feedback(first: 100) {
        value
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
  score: string | null;
  totalFeedback: string;
  lastActivity: string;
  registrationFile: RegistrationFile | null;
}

interface FeedbackRaw {
  value: string;
}

interface AgentRaw {
  id: string;
  agentId: string;
  owner: string;
  agentURI: string;
  totalFeedback: string;
  lastActivity: string;
  registrationFile: RegistrationFile | null;
  feedback: FeedbackRaw[];
}

interface AgentsResponse {
  data?: {
    agents: AgentRaw[];
  };
  errors?: Array<{ message: string }>;
}

interface AgentResponse {
  data?: {
    agent: AgentRaw | null;
  };
  errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query against the Agent0 Subgraph
 */
async function querySubgraph<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
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

  const result = await response.json();
  return result as T;
}

/**
 * Calculate average score from feedback values
 * @param feedback Array of feedback objects with value field
 * @returns Average score as string with 2 decimal places, or null if no feedback
 */
function calculateScore(feedback: FeedbackRaw[]): string | null {
  if (!feedback || feedback.length === 0) {
    return null;
  }

  const values = feedback
    .map(f => parseFloat(f.value))
    .filter(v => !isNaN(v));

  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  const average = sum / values.length;
  return average.toFixed(2);
}

/**
 * Convert raw agent with feedback to Agent with calculated score
 */
function mapAgentWithScore(agent: AgentRaw): Agent {
  return {
    agentId: agent.agentId,
    owner: agent.owner,
    agentURI: agent.agentURI,
    score: calculateScore(agent.feedback),
    totalFeedback: agent.totalFeedback,
    lastActivity: agent.lastActivity,
    registrationFile: agent.registrationFile,
  };
}

/**
 * Fetch agents with their scores (calculated from feedback)
 * @param first Number of agents to fetch (max 50)
 * @param skip Number of agents to skip (for pagination)
 */
export async function fetchAgents(first: number = 20, skip: number = 0): Promise<Agent[]> {
  const clampedFirst = Math.min(Math.max(1, first), 50);
  const clampedSkip = Math.max(0, skip);

  const result = await querySubgraph<AgentsResponse>(AGENTS_WITH_FEEDBACK_QUERY, {
    first: clampedFirst,
    skip: clampedSkip,
  });

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Subgraph query errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  const agents = result.data?.agents ?? [];
  return agents.map(mapAgentWithScore);
}

/**
 * Fetch a single agent by its agentId, including score
 * @param agentId The numeric agent ID
 */
export async function fetchAgentById(agentId: string): Promise<Agent | null> {
  const subgraphId = `${SEPOLIA_CHAIN_ID}:${agentId}`;

  const result = await querySubgraph<AgentResponse>(AGENT_BY_ID_WITH_FEEDBACK_QUERY, {
    id: subgraphId,
  });

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Subgraph query errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  const agent = result.data?.agent;
  if (!agent) return null;

  return mapAgentWithScore(agent);
}
