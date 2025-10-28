import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { generateImage, generateImageWithImagen4 } from '@/lib/replicate';
import { saveMediaFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();
        const { prompt, model = 'imagen4' } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Choose generation function based on model
        let imageData: string;
        let mimeType: string;
        let modelName: string;
        let provider: string;

        try {
            if (model === 'imagen4') {
                const result = await generateImageWithImagen4(prompt);
                imageData = result.imageData;
                mimeType = result.mimeType;
                modelName = 'imagen-4.0-ultra-generate-001';
                provider = 'google-imagen4';
            } else {
                const result = await generateImage(prompt);
                imageData = result.imageData;
                mimeType = result.mimeType;
                modelName = 'gemini-2.5-flash-image';
                provider = 'gemini-nano-banana';
            }
        } catch (geminiError: any) {
            console.error('Image generation API error:', geminiError);

            // Provide helpful error message
            if (geminiError.message?.includes('API key') || geminiError.message?.includes('auth')) {
                return NextResponse.json(
                    { error: 'Invalid or missing Replicate API key. Please check your .env file.' },
                    { status: 401 }
                );
            }

            return NextResponse.json({
                success: false,
                error: 'Image generation failed.',
                message: geminiError.message || 'An error occurred during image generation.',
                prompt,
            }, { status: 500 });
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
                provider: provider,
                path: relativePath,
                bytes: imageBuffer.length,
                metadata: JSON.stringify({
                    prompt,
                    model: modelName,
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

        const successMessage = model === 'imagen4'
            ? 'Image generated successfully with Imagen 4!'
            : 'Image generated successfully with Nano Banana!';

        return NextResponse.json({
            success: true,
            message: successMessage,
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

