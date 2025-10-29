import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { editImage, type EditModel } from '@/lib/replicate';
import { readMediaFile, saveMediaFile } from '@/lib/storage';
import path from 'path';

const MODEL_LABELS: Record<EditModel, string> = {
    'nano-banana': 'Nano Banana',
    'qwen-image-edit-plus': 'Qwen Image Edit Plus',
    'seededit-3.0': 'SeedEdit 3.0',
    'seedream-4': 'Seedream 4',
};

const PROVIDER_MAP: Record<EditModel, string> = {
    'nano-banana': 'gemini-nano-banana',
    'qwen-image-edit-plus': 'qwen-image-edit-plus',
    'seededit-3.0': 'seededit-3.0',
    'seedream-4': 'seedream-4',
};

const REPLICATE_MODEL_MAP: Record<EditModel, string> = {
    'nano-banana': 'google/nano-banana',
    'qwen-image-edit-plus': 'qwen/qwen-image-edit-plus',
    'seededit-3.0': 'bytedance/seededit-3.0',
    'seedream-4': 'bytedance/seedream-4',
};

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const body = await request.json();
        const { imageId, instruction } = body;
        const requestedModel = typeof body.model === 'string' ? body.model : undefined;
        const allowedModels = ['nano-banana', 'qwen-image-edit-plus', 'seededit-3.0', 'seedream-4'] as const satisfies readonly EditModel[];
        const isEditModel = (value: string): value is EditModel => (allowedModels as readonly string[]).includes(value);

        let selectedModel: EditModel = 'nano-banana';
        if (requestedModel) {
            if (isEditModel(requestedModel)) {
                selectedModel = requestedModel;
            } else {
                return NextResponse.json(
                    { error: 'Invalid editing model selected' },
                    { status: 400 }
                );
            }
        }

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

        // Edit image via selected Replicate model
        let editedImageData: string;
        let editedMimeType: string;

        try {
            const result = await editImage(imageBuffer, instruction, originalMimeType, selectedModel);
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
                message: geminiError.message || `${MODEL_LABELS[selectedModel]} encountered an error processing your image.`,
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
                provider: PROVIDER_MAP[selectedModel],
                path: relativePath,
                bytes: editedBuffer.length,
                metadata: JSON.stringify({
                    instruction,
                    originalImageId: imageId,
                    model: REPLICATE_MODEL_MAP[selectedModel],
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
                    model: REPLICATE_MODEL_MAP[selectedModel],
                }),
            },
        });

        return NextResponse.json({
            success: true,
            message: `Image edited successfully with ${MODEL_LABELS[selectedModel]}!`,
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

