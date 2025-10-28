import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

/**
 * Get prediction status
 * Used by frontend to poll for video generation completion
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sessionId = await getOrCreateSession();
        const { id: predictionId } = await params;

        // Find the prediction
        const prediction = await prisma.prediction.findUnique({
            where: { id: predictionId }
        });

        if (!prediction) {
            return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
        }

        // Verify ownership
        if (prediction.owner !== sessionId) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Return prediction status and asset if complete
        return NextResponse.json({
            success: true,
            prediction: {
                id: prediction.id,
                predictionId: prediction.predictionId,
                status: prediction.status,
                type: prediction.type,
                prompt: prediction.prompt,
                assetId: prediction.assetId,
                error: prediction.error,
                createdAt: prediction.createdAt,
                updatedAt: prediction.updatedAt,
            },
            // If succeeded, include asset details
            asset: prediction.assetId ? await prisma.mediaAsset.findUnique({
                where: { id: prediction.assetId }
            }) : null,
        });

    } catch (error) {
        console.error('Error fetching prediction:', error);
        return NextResponse.json(
            { error: 'Failed to fetch prediction', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

