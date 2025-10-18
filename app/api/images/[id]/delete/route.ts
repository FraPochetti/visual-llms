import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getMediaFilePath } from '@/lib/storage';
import fs from 'fs/promises';

export async function DELETE(
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

        // Delete the file from disk
        try {
            const filePath = await getMediaFilePath(asset.path);
            await fs.unlink(filePath);
        } catch (fileError) {
            console.error('Error deleting file:', fileError);
            // Continue with database deletion even if file deletion fails
        }

        // Delete associated actions first (foreign key constraint)
        await prisma.action.deleteMany({
            where: { assetId: id },
        });

        // Delete the database record
        await prisma.mediaAsset.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Image deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting image:', error);
        return NextResponse.json(
            { error: 'Failed to delete image' },
            { status: 500 }
        );
    }
}

