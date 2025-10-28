import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveVideo } from '@/lib/storage';

/**
 * Webhook endpoint for Replicate predictions
 * Called by Replicate when a prediction completes
 */
export async function POST(request: NextRequest) {
    try {
        const payload = await request.json();

        console.log('Replicate webhook received:', payload.id, payload.status);

        const { id: predictionId, status, output, error: predictionError } = payload;

        if (!predictionId) {
            return NextResponse.json({ error: 'Missing prediction ID' }, { status: 400 });
        }

        // Find the prediction in our database
        const prediction = await prisma.prediction.findUnique({
            where: { predictionId }
        });

        if (!prediction) {
            console.log('Prediction not found in database:', predictionId);
            return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
        }

        // Update prediction status
        if (status === 'succeeded' && output) {
            console.log('Processing successful prediction:', predictionId);

            try {
                // Extract video URL from output
                let videoUrl: string | null = null;

                if (Array.isArray(output)) {
                    videoUrl = output[0];
                } else if (typeof output === 'string') {
                    videoUrl = output;
                } else if (output && typeof output === 'object') {
                    if (typeof output.url === 'function') {
                        videoUrl = output.url();
                    } else if (output.url) {
                        videoUrl = output.url;
                    }
                }

                if (!videoUrl) {
                    throw new Error('No video URL in webhook output');
                }

                console.log('Downloading video from:', videoUrl);

                // Download the video
                const videoResponse = await fetch(videoUrl);
                if (!videoResponse.ok) {
                    throw new Error(`Failed to download video: ${videoResponse.statusText}`);
                }

                const arrayBuffer = await videoResponse.arrayBuffer();
                const videoBuffer = Buffer.from(arrayBuffer);

                // Save video to storage
                const relativePath = await saveVideo(prediction.owner, videoBuffer);

                // Parse metadata to get original settings
                const metadata = prediction.metadata ? JSON.parse(prediction.metadata) : {};

                // Create media asset
                const mediaAsset = await prisma.mediaAsset.create({
                    data: {
                        owner: prediction.owner,
                        kind: 'video',
                        provider: 'google-veo-3.1',
                        path: relativePath,
                        bytes: videoBuffer.length,
                        metadata: JSON.stringify({
                            ...metadata,
                            prompt: prediction.prompt,
                            model: 'google/veo-3.1',
                            generatedAt: new Date().toISOString(),
                            duration: 8,
                            resolution: metadata.resolution || '1080p',
                            fps: 24,
                            hasAudio: metadata.generateAudio !== false,
                        }),
                        saved: true, // Auto-save webhook-generated videos
                    },
                });

                // Log the action
                await prisma.action.create({
                    data: {
                        userId: prediction.owner,
                        action: 'create_video',
                        assetId: mediaAsset.id,
                        detail: JSON.stringify({
                            prompt: prediction.prompt,
                            webhookGenerated: true,
                            predictionId,
                        }),
                    },
                });

                // Update prediction with asset ID
                await prisma.prediction.update({
                    where: { predictionId },
                    data: {
                        status: 'succeeded',
                        assetId: mediaAsset.id,
                        updatedAt: new Date(),
                    },
                });

                console.log('Video saved successfully:', mediaAsset.id);

                return NextResponse.json({
                    success: true,
                    assetId: mediaAsset.id
                });

            } catch (saveError: any) {
                console.error('Error saving video from webhook:', saveError);

                // Update prediction as failed
                await prisma.prediction.update({
                    where: { predictionId },
                    data: {
                        status: 'failed',
                        error: saveError.message,
                        updatedAt: new Date(),
                    },
                });

                return NextResponse.json({
                    success: false,
                    error: saveError.message
                }, { status: 500 });
            }

        } else if (status === 'failed') {
            // Update prediction as failed
            await prisma.prediction.update({
                where: { predictionId },
                data: {
                    status: 'failed',
                    error: predictionError || 'Unknown error',
                    updatedAt: new Date(),
                },
            });

            console.log('Prediction failed:', predictionId, predictionError);

            return NextResponse.json({ success: true });
        }

        // For other statuses (starting, processing), just acknowledge
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

