import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { improvePromptWithClaude } from '@/lib/bedrock';
import { readMediaFile } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const { prompt, mode, imageId, frameIds } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        let selectedImage: string | undefined;
        let frameImages: string[] | undefined;

        // Load selected image for edit mode
        if (mode === 'edit' && imageId) {
            const asset = await prisma.mediaAsset.findFirst({
                where: { id: imageId, owner: sessionId }
            });
            if (asset) {
                const buffer = await readMediaFile(asset.path);
                selectedImage = buffer.toString('base64');
            }
        }

        // Load frame images for video mode
        if (mode === 'video' && frameIds && frameIds.length > 0) {
            frameImages = [];
            for (const fid of frameIds) {
                const asset = await prisma.mediaAsset.findFirst({
                    where: { id: fid, owner: sessionId }
                });
                if (asset) {
                    const buffer = await readMediaFile(asset.path);
                    frameImages.push(buffer.toString('base64'));
                }
            }
        }

        const result = await improvePromptWithClaude(prompt, {
            mode,
            selectedImage,
            frameImages
        });

        return NextResponse.json({
            success: true,
            original: prompt,
            improved: result.improvedPrompt,
            example2: result.example2,
            improvements: result.improvements
        });
    } catch (error) {
        console.error('Error improving prompt:', error);
        return NextResponse.json(
            { error: 'Failed to improve prompt' },
            { status: 500 }
        );
    }
}

