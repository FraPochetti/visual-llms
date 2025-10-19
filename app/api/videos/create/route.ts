import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { generateVideo } from '@/lib/gemini';
import { saveVideo, readMediaFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const {
            prompt,
            mode = 'text',
            firstFrameId
        } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Validate mode
        if (!['text', 'single-frame'].includes(mode)) {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        // Load frame image if provided
        let firstFrameBuffer: Buffer | undefined;

        if (mode === 'single-frame') {
            if (!firstFrameId) {
                return NextResponse.json({
                    error: 'First frame is required for single-frame mode'
                }, { status: 400 });
            }

            // Load first frame from database
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

        // Generate video with Veo 3.1
        let videoResult;
        try {
            videoResult = await generateVideo(prompt, {
                firstFrame: firstFrameBuffer,
            });
        } catch (geminiError: any) {
            console.error('Video generation API error:', geminiError);

            // Provide helpful error message
            if (geminiError.message?.includes('API key')) {
                return NextResponse.json(
                    { error: 'Invalid or missing Gemini API key. Please check your .env file.' },
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
                    mode,
                    duration: videoResult.duration,
                    resolution: videoResult.resolution,
                    fps: 24,
                    hasAudio: true,
                    generatedAt: new Date().toISOString(),
                    firstFrameId: firstFrameId || null,
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
                    mode,
                    firstFrameId: firstFrameId || null,
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

