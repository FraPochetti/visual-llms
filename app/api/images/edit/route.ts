import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { editImage } from '@/lib/replicate';
import { readMediaFile, saveMediaFile } from '@/lib/storage';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const { imageId, instruction } = await request.json();

        if (!imageId || !instruction) {
            return NextResponse.json(
                { error: 'Image ID and instruction are required' },
                { status: 400 }
            );
        }

        // Verify the image belongs to this session
        const originalImage = await prisma.mediaAsset.findFirst({
            where: {
                id: imageId,
                owner: sessionId,
            },
        });

        if (!originalImage) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 });
        }

        // Read the original image from storage
        const imageBuffer = await readMediaFile(originalImage.path);

        // Determine MIME type from file extension
        const ext = path.extname(originalImage.path).toLowerCase();
        const mimeTypeMap: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
        };
        const originalMimeType = mimeTypeMap[ext] || 'image/png';

        // Edit image using Nano Banana via Replicate
        let editedImageData: string;
        let editedMimeType: string;

        try {
            const result = await editImage(imageBuffer, instruction, originalMimeType);
            editedImageData = result.imageData;
            editedMimeType = result.mimeType;
        } catch (geminiError: any) {
            console.error('Replicate API error during editing:', geminiError);

            if (geminiError.message?.includes('API key') || geminiError.message?.includes('auth')) {
                return NextResponse.json(
                    { error: 'Invalid or missing Replicate API key. Please check your .env file.' },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                success: false,
                error: 'Image editing failed',
                message: geminiError.message || 'Nano Banana encountered an error processing your image.',
                originalImageId: imageId,
            }, { status: 500 });
        }

        // Convert base64 to buffer
        const editedBuffer = Buffer.from(editedImageData, 'base64');

        // Save edited image
        const editedExt = editedMimeType.split('/')[1] || 'png';
        const filename = `edited-${Date.now()}.${editedExt}`;
        const relativePath = await saveMediaFile(sessionId, editedBuffer, filename);

        // Create database record for edited image
        const editedAsset = await prisma.mediaAsset.create({
            data: {
                owner: sessionId,
                kind: 'image',
                provider: 'gemini-nano-banana',
                path: relativePath,
                bytes: editedBuffer.length,
                metadata: JSON.stringify({
                    instruction,
                    originalImageId: imageId,
                    model: 'gemini-2.5-flash-image',
                    editedAt: new Date().toISOString(),
                }),
            },
        });

        // Log the action
        await prisma.action.create({
            data: {
                userId: sessionId,
                action: 'edit',
                assetId: editedAsset.id,
                detail: JSON.stringify({
                    instruction,
                    originalImageId: imageId,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Image edited successfully with Nano Banana!',
            imageUrl: `/api/media/${relativePath}`,
            imageId: editedAsset.id,
            originalImageId: imageId,
            asset: editedAsset,
        });
    } catch (error) {
        console.error('Error editing image:', error);
        return NextResponse.json(
            { error: 'Failed to edit image', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

