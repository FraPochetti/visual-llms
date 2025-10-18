import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { generateImage } from '@/lib/gemini';
import { saveMediaFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Generate image using Gemini Nano Banana
        let imageData: string;
        let mimeType: string;

        try {
            const result = await generateImage(prompt);
            imageData = result.imageData;
            mimeType = result.mimeType;
        } catch (geminiError: any) {
            console.error('Gemini API error:', geminiError);

            // Provide helpful error message
            if (geminiError.message?.includes('API key')) {
                return NextResponse.json(
                    { error: 'Invalid or missing Gemini API key. Please check your .env file.' },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                success: false,
                error: 'Image generation is not yet available in the Gemini API.',
                message: 'Nano Banana currently supports image editing. Text-to-image generation may require additional API access or is coming soon.',
                prompt,
            }, { status: 501 });
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(imageData, 'base64');

        // Determine file extension from mime type
        const ext = mimeType.split('/')[1] || 'png';
        const filename = `generated-${Date.now()}.${ext}`;

        // Save to local storage
        const relativePath = await saveMediaFile(sessionId, imageBuffer, filename);

        // Create database record
        const mediaAsset = await prisma.mediaAsset.create({
            data: {
                owner: sessionId,
                kind: 'image',
                provider: 'gemini-nano-banana',
                path: relativePath,
                bytes: imageBuffer.length,
                metadata: JSON.stringify({
                    prompt,
                    model: 'gemini-2.5-flash-image',
                    generatedAt: new Date().toISOString(),
                }),
            },
        });

        // Log the action
        await prisma.action.create({
            data: {
                userId: sessionId,
                action: 'create',
                assetId: mediaAsset.id,
                detail: JSON.stringify({ prompt }),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Image generated successfully with Nano Banana!',
            imageUrl: `/api/media/${relativePath}`,
            imageId: mediaAsset.id,
            asset: mediaAsset,
        });
    } catch (error) {
        console.error('Error creating image:', error);
        return NextResponse.json(
            { error: 'Failed to create image', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

