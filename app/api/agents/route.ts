import { NextRequest, NextResponse } from 'next/server';
import { fetchAgents } from '@/lib/subgraph';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parse pagination parameters with defaults
        const first = parseInt(searchParams.get('first') || '20', 10);
        const skip = parseInt(searchParams.get('skip') || '0', 10);

        // Validate and clamp first to max 50
        const clampedFirst = Math.min(Math.max(1, isNaN(first) ? 20 : first), 50);
        const clampedSkip = Math.max(0, isNaN(skip) ? 0 : skip);

        const agents = await fetchAgents(clampedFirst, clampedSkip);

        return NextResponse.json({
            agents,
            pagination: {
                first: clampedFirst,
                skip: clampedSkip,
                count: agents.length,
            },
        });
    } catch (error) {
        console.error('Error fetching agents:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch agents' },
            { status: 500 }
        );
    }
}
