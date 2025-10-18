import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { saveMediaFile } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const formData = await request.formData();

        const file = formData.get('file') as File;
        const metadata = formData.get('metadata') as string;

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save file to disk
        const relativePath = await saveMediaFile(sessionId, buffer, file.name);

        // Parse metadata if provided
        let parsedMetadata: any = {};
        if (metadata) {
            try {
                parsedMetadata = JSON.parse(metadata);
            } catch (e) {
                console.error('Failed to parse metadata:', e);
            }
        }

        // Create database record
        const mediaAsset = await prisma.mediaAsset.create({
            data: {
                owner: sessionId,
                kind: 'image',
                provider: 'local-fs',
                path: relativePath,
                bytes: buffer.length,
                width: parsedMetadata.width || null,
                height: parsedMetadata.height || null,
                metadata: metadata || null,
                saved: true, // User uploads are automatically saved
            },
        });

        // Log the action
        await prisma.action.create({
            data: {
                userId: sessionId,
                action: 'upload',
                assetId: mediaAsset.id,
                detail: JSON.stringify({ filename: file.name }),
            },
        });

        return NextResponse.json({
            success: true,
            asset: mediaAsset,
        });
    } catch (error) {
        console.error('Error saving image:', error);
        return NextResponse.json(
            { error: 'Failed to save image' },
            { status: 500 }
        );
    }
}

