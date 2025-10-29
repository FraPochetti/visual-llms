import Replicate from 'replicate';

if (!process.env.REPLICATE_API_KEY) {
    throw new Error('REPLICATE_API_KEY is not set in environment variables');
}

// Initialize the Replicate client
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY,
});

// Best-effort extraction of a downloadable URL from Replicate outputs
function extractUrlFromOutput(rawOutput: any): string | null {
    // If the output is an array, try first element recursively
    if (Array.isArray(rawOutput)) {
        return extractUrlFromOutput(rawOutput[0]);
    }

    // If it's already a string, assume it's a URL
    if (typeof rawOutput === 'string') {
        return rawOutput;
    }

    // If it's a URL instance
    if (rawOutput instanceof URL) {
        return rawOutput.toString();
    }

    // If it's an object, check common shapes
    if (rawOutput && typeof rawOutput === 'object') {
        // Some SDKs may expose a callable url() that returns a URL
        if (typeof (rawOutput as any).url === 'function') {
            const result = (rawOutput as any).url();
            if (typeof result === 'string') return result;
            if (result instanceof URL) return result.toString();
        }

        // url as string
        if (typeof (rawOutput as any).url === 'string') {
            return (rawOutput as any).url as string;
        }

        // Some outputs may have a path property; try constructing a delivery URL
        if (typeof (rawOutput as any).path === 'string') {
            const path = (rawOutput as any).path as string;
            // Replicate usually serves from replicate.delivery
            if (path.startsWith('http')) return path;
            return `https://replicate.delivery${path.startsWith('/') ? '' : '/'}${path}`;
        }
    }

    return null;
}

export type EditModel = 'nano-banana' | 'qwen-image-edit-plus' | 'seededit-3.0' | 'seedream-4';

async function downloadImageFromUrl(url: string): Promise<{ imageData: string; mimeType: string; }> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
        imageData: buffer.toString('base64'),
        mimeType: response.headers.get('content-type') || 'image/png',
    };
}

/**
 * Generate an image from a text prompt using Imagen 4 Ultra via Replicate
 * Uses google/imagen-4-ultra model
 */
export async function generateImageWithImagen4(prompt: string): Promise<{
    imageData: string;
    mimeType: string;
}> {
    try {
        const output = await replicate.run(
            'google/imagen-4-ultra',
            {
                input: {
                    prompt: prompt,
                    aspect_ratio: '1:1',
                    output_format: 'png',
                }
            }
        ) as any;

        // Debug: log the actual output structure
        console.log('Replicate output type:', typeof output);
        console.log('Replicate output:', JSON.stringify(output).substring(0, 200));

        // Replicate returns URLs or objects; extract a usable URL
        const resolvedUrl = extractUrlFromOutput(output);
        if (!resolvedUrl) {
            console.error('Unexpected output structure:', output);
            throw new Error('Unable to resolve image URL from Imagen 4 Ultra output');
        }

        // Download the image from URL
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const imageData = buffer.toString('base64');

        return {
            imageData,
            mimeType: 'image/png',
        };
    } catch (error) {
        console.error('Error generating image with Imagen 4 Ultra:', error);
        throw error;
    }
}

/**
 * Generate an image from a text prompt using Nano Banana via Replicate
 * Uses google/nano-banana model
 */
export async function generateImage(prompt: string): Promise<{
    imageData: string;
    mimeType: string;
}> {
    try {
        const output = await replicate.run(
            'google/nano-banana',
            {
                input: {
                    prompt: prompt,
                }
            }
        ) as any;

        console.log('Nano Banana output type:', typeof output);
        console.log('Nano Banana output:', JSON.stringify(output).substring(0, 200));

        // Replicate returns URLs or objects; extract a usable URL
        const resolvedUrl = extractUrlFromOutput(output);
        if (!resolvedUrl) {
            console.error('Unexpected output structure:', output);
            throw new Error('Unable to resolve image URL from Nano Banana output');
        }

        // Download the image from URL
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const imageData = buffer.toString('base64');

        return {
            imageData,
            mimeType: 'image/png',
        };
    } catch (error) {
        console.error('Error generating image with Nano Banana:', error);
        throw error;
    }
}

async function editImageWithNano(dataUri: string, instruction: string): Promise<{ imageData: string; mimeType: string; }> {
    const output = await replicate.run(
        'google/nano-banana',
        {
            input: {
                image_input: [dataUri],
                prompt: instruction,
            }
        }
    ) as any;

    console.log('Nano Banana edit output type:', typeof output);
    console.log('Nano Banana edit output:', JSON.stringify(output).substring(0, 200));

    const resolvedUrl = extractUrlFromOutput(output);
    if (!resolvedUrl) {
        console.error('Unexpected output structure:', output);
        throw new Error('Unable to resolve edited image URL from Nano Banana output');
    }

    return downloadImageFromUrl(resolvedUrl);
}

async function editImageWithQwen(dataUri: string, instruction: string): Promise<{ imageData: string; mimeType: string; }> {
    const output = await replicate.run(
        'qwen/qwen-image-edit-plus',
        {
            input: {
                prompt: instruction,
                image: [dataUri],
                output_format: 'png',
                output_quality: 95,
                go_fast: true,
            }
        }
    ) as any;

    console.log('Qwen edit output type:', typeof output);
    console.log('Qwen edit output:', JSON.stringify(output).substring(0, 200));

    const resolvedUrl = extractUrlFromOutput(output);
    if (!resolvedUrl) {
        console.error('Unexpected Qwen output structure:', output);
        throw new Error('Unable to resolve edited image URL from Qwen Image Edit Plus output');
    }

    return downloadImageFromUrl(resolvedUrl);
}

async function editImageWithSeedEdit(dataUri: string, instruction: string): Promise<{ imageData: string; mimeType: string; }> {
    const output = await replicate.run(
        'bytedance/seededit-3.0',
        {
            input: {
                image: dataUri,
                prompt: instruction,
                guidance_scale: 7.5,
            }
        }
    ) as any;

    console.log('SeedEdit 3.0 output type:', typeof output);
    console.log('SeedEdit 3.0 output:', JSON.stringify(output).substring(0, 200));

    const resolvedUrl = extractUrlFromOutput(output);
    if (!resolvedUrl) {
        console.error('Unexpected SeedEdit 3.0 output structure:', output);
        throw new Error('Unable to resolve edited image URL from SeedEdit 3.0 output');
    }

    return downloadImageFromUrl(resolvedUrl);
}

async function editImageWithSeedream(dataUri: string, instruction: string): Promise<{ imageData: string; mimeType: string; }> {
    const output = await replicate.run(
        'bytedance/seedream-4',
        {
            input: {
                prompt: instruction,
                image_input: [dataUri],  // Seedream 4 uses image_input array (supports 1-10 images)
                size: '2K',
            }
        }
    ) as any;

    console.log('Seedream 4 output type:', typeof output);
    console.log('Seedream 4 output:', JSON.stringify(output).substring(0, 200));

    const resolvedUrl = extractUrlFromOutput(output);
    if (!resolvedUrl) {
        console.error('Unexpected Seedream 4 output structure:', output);
        throw new Error('Unable to resolve edited image URL from Seedream 4 output');
    }

    return downloadImageFromUrl(resolvedUrl);
}

/**
 * Edit an existing image using selected Replicate model
 */
export async function editImage(
    imageBuffer: Buffer,
    instruction: string,
    mimeType: string = 'image/png',
    model: EditModel = 'nano-banana'
): Promise<{
    imageData: string;
    mimeType: string;
}> {
    try {
        const imageBase64 = imageBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${imageBase64}`;

        switch (model) {
            case 'nano-banana':
                return await editImageWithNano(dataUri, instruction);
            case 'qwen-image-edit-plus':
                return await editImageWithQwen(dataUri, instruction);
            case 'seededit-3.0':
                return await editImageWithSeedEdit(dataUri, instruction);
            case 'seedream-4':
                return await editImageWithSeedream(dataUri, instruction);
            default:
                throw new Error(`Unsupported edit model: ${model}`);
        }
    } catch (error) {
        console.error(`Error editing image with model ${model}:`, error);
        throw error;
    }
}

/**
 * Generate a video from a text prompt using Veo 3.1 via Replicate
 * Supports multiple modes:
 * - Text-only
 * - With first frame (image-to-video)
 * - With last frame (video-to-image)
 * - With reference images (up to 3 for subject consistency)
 * 
 * @param useWebhook - If true, returns prediction ID instead of waiting. Webhook will handle completion.
 */
export async function generateVideo(
    prompt: string,
    options?: {
        firstFrame?: Buffer;
        lastFrame?: Buffer;
        referenceImages?: Buffer[];  // Up to 3 reference images
        duration?: number;           // Duration in seconds (default 8)
        resolution?: '720p' | '1080p'; // Video resolution
        aspectRatio?: '16:9';        // Aspect ratio (16:9 required for reference images)
        generateAudio?: boolean;     // Generate audio (default true)
        webhookUrl?: string;         // If provided, use webhook instead of polling
        onProgress?: (seconds: number) => void;
    }
): Promise<{
    videoData?: Buffer;
    mimeType: string;
    duration: number;
    resolution: string;
    predictionId?: string;  // Returned when using webhooks
}> {
    try {
        console.log('Starting video generation with Veo 3.1 via Replicate...');
        console.log('Prompt:', prompt);
        console.log('Has first frame:', !!options?.firstFrame);
        console.log('Has last frame:', !!options?.lastFrame);
        console.log('Reference images:', options?.referenceImages?.length || 0);
        console.log('Aspect ratio:', options?.aspectRatio || 'auto');

        const input: any = {
            prompt: prompt,
            duration: options?.duration || 8,
            resolution: options?.resolution || '1080p',
            generate_audio: options?.generateAudio !== false, // Default true
        };

        // Add aspect_ratio if specified (required for reference images)
        if (options?.aspectRatio) {
            input.aspect_ratio = options.aspectRatio;
        }

        // Add first frame if provided (for image-to-video)
        if (options?.firstFrame) {
            const imageBase64 = options.firstFrame.toString('base64');
            const dataUri = `data:image/png;base64,${imageBase64}`;
            input.image = dataUri;
        }

        // Add last frame if provided (for video ending anchor)
        if (options?.lastFrame) {
            const imageBase64 = options.lastFrame.toString('base64');
            const dataUri = `data:image/png;base64,${imageBase64}`;
            input.last_frame = dataUri;
        }

        // Add reference images if provided (up to 3 for subject consistency)
        if (options?.referenceImages && options.referenceImages.length > 0) {
            const refImageUris = options.referenceImages.slice(0, 3).map(buffer => {
                const imageBase64 = buffer.toString('base64');
                return `data:image/png;base64,${imageBase64}`;
            });
            input.reference_images = refImageUris;
        }

        // Start the prediction with detailed logging
        console.log('Starting Veo 3.1 prediction...');
        console.log('Input keys:', Object.keys(input));
        console.log('Input values:', JSON.stringify(input, null, 2).substring(0, 500));
        console.log('Webhook URL:', options?.webhookUrl || 'none (polling mode)');

        let prediction;
        try {
            const createParams: any = {
                model: 'google/veo-3.1',
                input: input,
            };

            // Add webhook if provided
            if (options?.webhookUrl) {
                createParams.webhook = options.webhookUrl;
                createParams.webhook_events_filter = ["completed"]; // Only notify when done
            }

            prediction = await replicate.predictions.create(createParams);
        } catch (createError: any) {
            console.error('Error creating prediction:', createError);
            console.error('Error details:', JSON.stringify(createError, null, 2));
            throw new Error(`Failed to create Veo 3.1 prediction: ${createError.message}`);
        }

        console.log('Video generation started:', prediction.id);

        // If webhook mode, return prediction ID immediately
        if (options?.webhookUrl) {
            console.log('Webhook mode: returning prediction ID immediately');
            return {
                predictionId: prediction.id,
                mimeType: 'video/mp4',
                duration: options?.duration || 8,
                resolution: options?.resolution || '1080p',
            };
        }

        // Poll for completion
        let currentPrediction = prediction;
        let elapsedSeconds = 0;

        while (currentPrediction.status !== 'succeeded' && currentPrediction.status !== 'failed') {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            elapsedSeconds += 10;

            if (options?.onProgress) {
                options.onProgress(elapsedSeconds);
            }

            console.log(`Waiting for video generation... ${elapsedSeconds}s elapsed`);
            currentPrediction = await replicate.predictions.get(prediction.id);

            // Timeout after 7 minutes (420 seconds)
            if (elapsedSeconds >= 420) {
                throw new Error('Video generation timeout: exceeded 7 minutes');
            }
        }

        if (currentPrediction.status === 'failed') {
            console.error('Prediction failed:', currentPrediction.error);
            throw new Error(`Video generation failed: ${currentPrediction.error}`);
        }

        console.log('Video generation complete!');

        console.log('Veo output type:', typeof currentPrediction.output);
        console.log('Veo output:', JSON.stringify(currentPrediction.output).substring(0, 200));

        // Get the video URL from output
        const videoUrl = extractUrlFromOutput(currentPrediction.output);
        if (!videoUrl) {
            console.error('Unexpected output structure:', currentPrediction.output);
            throw new Error('Unable to resolve video URL from Veo 3.1 output');
        }

        console.log('Video URL:', videoUrl);

        // Download the video
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }

        const arrayBuffer = await videoResponse.arrayBuffer();
        const videoBuffer = Buffer.from(arrayBuffer);

        // Extract metadata (Veo 3.1 generates 8-second videos at 24fps)
        const duration = 8; // Default for Veo 3.1
        const resolution = '720p'; // Default resolution

        return {
            videoData: videoBuffer,
            mimeType: 'video/mp4',
            duration,
            resolution,
        };
    } catch (error) {
        console.error('Error generating video with Veo 3.1:', error);
        throw error;
    }
}

