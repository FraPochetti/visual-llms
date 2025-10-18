import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sessionId = await getOrCreateSession();
        const { id } = await params;

        // Verify the image belongs to this session
        const asset = await prisma.mediaAsset.findFirst({
            where: {
                id,
                owner: sessionId,
            },
        });

        if (!asset) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }

        // Mark as saved
        const updatedAsset = await prisma.mediaAsset.update({
            where: { id },
            data: { saved: true },
        });

        return NextResponse.json({
            success: true,
            asset: updatedAsset,
        });
    } catch (error) {
        console.error('Error saving image:', error);
        return NextResponse.json(
            { error: 'Failed to save image' },
            { status: 500 }
        );
    }
}

