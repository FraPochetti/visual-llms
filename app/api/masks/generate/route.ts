import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/session';
import { generateMaskForNovaCanvas } from '@/lib/segmentation';
import { saveMediaFile } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const sessionId = await getOrCreateSession();

        // Parse FormData
        const formData = await request.formData();
        const imageFile = formData.get('image') as File;
        const prompt = formData.get('prompt') as string;
        const negativePrompt = formData.get('negative_prompt') as string | null;

        // Validate inputs
        if (!imageFile) {
            return NextResponse.json(
                { error: 'Image file is required' },
                { status: 400 }
            );
        }

        if (!prompt || prompt.trim() === '') {
            return NextResponse.json(
                { error: 'Prompt is required. Please describe what to segment.' },
                { status: 400 }
            );
        }

        // Convert image to base64
        const imageBuffer = await imageFile.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        const imageMimeType = imageFile.type || 'image/jpeg'; // Get actual MIME type

        console.log('Generating mask with Grounded SAM...');
        console.log('Image type:', imageMimeType);
        console.log('Prompt:', prompt);
        if (negativePrompt) {
            console.log('Negative prompt:', negativePrompt);
        }

        // Call Grounded SAM to generate mask
        const result = await generateMaskForNovaCanvas(
            imageBase64,
            prompt,
            negativePrompt || undefined,
            imageMimeType
        );

        console.log('Mask generated successfully. Prediction ID:', result.predictionId);

        // Save mask to storage
        const maskBuffer = Buffer.from(result.maskBase64, 'base64');
        const timestamp = Date.now();
        const uuid = Math.random().toString(36).substring(2, 15);
        const maskFilename = `mask_${timestamp}_${uuid}.png`;

        const maskPath = await saveMediaFile(sessionId, maskBuffer, maskFilename);
        console.log('Mask saved to:', maskPath);

        // Log action to database
        await prisma.action.create({
            data: {
                userId: sessionId,
                action: 'mask_generated',
                detail: JSON.stringify({
                    prompt: prompt,
                    negative_prompt: negativePrompt || '',
                    cost: result.cost,
                    predictionId: result.predictionId,
                    maskPath: maskPath
                })
            }
        });

        console.log('Mask generation logged to database');

        // Return success response
        return NextResponse.json({
            success: true,
            maskPath: maskPath,
            maskUrl: `/api/media/${maskPath}`,
            maskBase64: result.maskBase64,
            cost: result.cost,
            predictionId: result.predictionId
        });

    } catch (error) {
        console.error('Error generating mask:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            {
                error: 'Failed to generate mask',
                details: errorMessage
            },
            { status: 500 }
        );
    }
}
