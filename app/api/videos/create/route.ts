import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { generateVideo } from '@/lib/replicate';
import { saveVideo, readMediaFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const {
            prompt,
            videoGenerationMode = 'standard',
            firstFrameId,
            lastFrameId,
            referenceImageIds = [],
            duration = 8,
            resolution = '1080p',
            generateAudio = true,
        } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Validate video generation mode
        if (!['standard', 'reference'].includes(videoGenerationMode)) {
            return NextResponse.json({ error: 'Invalid video generation mode' }, { status: 400 });
        }

        // Validate reference mode requirements
        if (videoGenerationMode === 'reference' && (!referenceImageIds || referenceImageIds.length === 0)) {
            return NextResponse.json({
                error: 'Reference mode requires at least 1 reference image'
            }, { status: 400 });
        }

        // Load first frame image if provided (standard mode only)
        let firstFrameBuffer: Buffer | undefined;

        if (videoGenerationMode === 'standard' && firstFrameId) {
            const firstFrameAsset = await prisma.mediaAsset.findUnique({
                where: { id: firstFrameId }
            });

            if (!firstFrameAsset || firstFrameAsset.owner !== sessionId) {
                return NextResponse.json({
                    error: 'First frame not found or access denied'
                }, { status: 404 });
            }

            firstFrameBuffer = await readMediaFile(firstFrameAsset.path);
        }

        // Load last frame image if provided (standard mode only, ignored in reference mode)
        let lastFrameBuffer: Buffer | undefined;

        if (videoGenerationMode === 'standard' && lastFrameId) {
            const lastFrameAsset = await prisma.mediaAsset.findUnique({
                where: { id: lastFrameId }
            });

            if (!lastFrameAsset || lastFrameAsset.owner !== sessionId) {
                return NextResponse.json({
                    error: 'Last frame not found or access denied'
                }, { status: 404 });
            }

            lastFrameBuffer = await readMediaFile(lastFrameAsset.path);
        }

        // Load reference images if provided (reference mode only, up to 3)
        const referenceImageBuffers: Buffer[] = [];

        if (videoGenerationMode === 'reference' && referenceImageIds && Array.isArray(referenceImageIds)) {
            for (const refImageId of referenceImageIds.slice(0, 3)) {
                const refAsset = await prisma.mediaAsset.findUnique({
                    where: { id: refImageId }
                });

                if (refAsset && refAsset.owner === sessionId) {
                    const buffer = await readMediaFile(refAsset.path);
                    referenceImageBuffers.push(buffer);
                }
            }
        }

        // Generate video with Veo 3.1
        let videoResult;
        try {
            videoResult = await generateVideo(prompt, {
                // Standard mode options
                firstFrame: videoGenerationMode === 'standard' ? firstFrameBuffer : undefined,
                lastFrame: videoGenerationMode === 'standard' ? lastFrameBuffer : undefined,
                // Reference mode options
                referenceImages: videoGenerationMode === 'reference' ? referenceImageBuffers : undefined,
                // Common options
                duration: videoGenerationMode === 'reference' ? 8 : duration, // Lock to 8s for reference mode
                resolution: resolution as '720p' | '1080p',
                aspectRatio: videoGenerationMode === 'reference' ? '16:9' : undefined, // Lock to 16:9 for reference mode
                generateAudio: generateAudio,
            });
        } catch (geminiError: any) {
            console.error('Video generation API error:', geminiError);

            // Provide helpful error message
            if (geminiError.message?.includes('API key') || geminiError.message?.includes('auth')) {
                return NextResponse.json(
                    { error: 'Invalid or missing Replicate API key. Please check your .env file.' },
                    { status: 401 }
                );
            }

            if (geminiError.message?.includes('timeout')) {
                return NextResponse.json({
                    success: false,
                    error: 'Video generation timeout.',
                    message: 'The video generation took too long. Please try again with a simpler prompt.',
                    prompt,
                }, { status: 408 });
            }

            return NextResponse.json({
                success: false,
                error: 'Video generation failed.',
                message: geminiError.message || 'An error occurred during video generation.',
                prompt,
            }, { status: 500 });
        }

        // Save video to local storage
        const relativePath = await saveVideo(sessionId, videoResult.videoData);

        // Create database record
        const mediaAsset = await prisma.mediaAsset.create({
            data: {
                owner: sessionId,
                kind: 'video',
                provider: 'google-veo-3.1',
                path: relativePath,
                bytes: videoResult.videoData.length,
                metadata: JSON.stringify({
                    prompt,
                    model: 'veo-3.1-generate-preview',
                    videoGenerationMode,
                    duration: videoResult.duration,
                    resolution: videoResult.resolution,
                    aspectRatio: videoGenerationMode === 'reference' ? '16:9' : 'auto',
                    fps: 24,
                    hasAudio: generateAudio,
                    generatedAt: new Date().toISOString(),
                    firstFrameId: videoGenerationMode === 'standard' ? (firstFrameId || null) : null,
                    lastFrameId: videoGenerationMode === 'standard' ? (lastFrameId || null) : null,
                    referenceImageIds: videoGenerationMode === 'reference' ? (referenceImageIds || []) : [],
                }),
            },
        });

        // Log the action
        await prisma.action.create({
            data: {
                userId: sessionId,
                action: 'create_video',
                assetId: mediaAsset.id,
                detail: JSON.stringify({
                    prompt,
                    videoGenerationMode,
                    firstFrameId: videoGenerationMode === 'standard' ? (firstFrameId || null) : null,
                    lastFrameId: videoGenerationMode === 'standard' ? (lastFrameId || null) : null,
                    referenceImageIds: videoGenerationMode === 'reference' ? (referenceImageIds || []) : [],
                    duration: videoGenerationMode === 'reference' ? 8 : duration,
                    resolution,
                    aspectRatio: videoGenerationMode === 'reference' ? '16:9' : 'auto',
                    generateAudio,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Video generated successfully with Veo 3.1!',
            videoUrl: `/api/media/${relativePath}`,
            videoId: mediaAsset.id,
            asset: mediaAsset,
            metadata: {
                duration: videoResult.duration,
                resolution: videoResult.resolution,
                hasAudio: true,
            }
        });
    } catch (error) {
        console.error('Error creating video:', error);
        return NextResponse.json(
            { error: 'Failed to create video', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

