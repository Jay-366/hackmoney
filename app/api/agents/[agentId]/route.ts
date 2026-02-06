import { NextRequest, NextResponse } from 'next/server';
import { fetchAgentById } from '@/lib/subgraph';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
) {
    try {
        const { agentId } = await params;

        if (!agentId) {
            return NextResponse.json(
                { error: 'Agent ID is required' },
                { status: 400 }
            );
        }

        const agent = await fetchAgentById(agentId);

        if (!agent) {
            return NextResponse.json(
                { error: 'Not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ agent });
    } catch (error) {
        console.error('Error fetching agent:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch agent' },
            { status: 500 }
        );
    }
}
