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

/**
 * Edit an existing image using Nano Banana via Replicate
 * Maintains consistent likenesses and supports advanced edits
 */
export async function editImage(
    imageBuffer: Buffer,
    instruction: string,
    mimeType: string = 'image/png'
): Promise<{
    imageData: string;
    mimeType: string;
}> {
    try {
        // Convert buffer to base64 data URI for Replicate
        const imageBase64 = imageBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${imageBase64}`;

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

        // Replicate returns URLs or objects; extract a usable URL
        const resolvedUrl = extractUrlFromOutput(output);
        if (!resolvedUrl) {
            console.error('Unexpected output structure:', output);
            throw new Error('Unable to resolve edited image URL from Nano Banana output');
        }

        // Download the edited image from URL
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
            throw new Error(`Failed to download edited image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const imageData = buffer.toString('base64');

        return {
            imageData,
            mimeType: 'image/png',
        };
    } catch (error) {
        console.error('Error editing image with Nano Banana:', error);
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
        onProgress?: (seconds: number) => void;
    }
): Promise<{
    videoData: Buffer;
    mimeType: string;
    duration: number;
    resolution: string;
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

        let prediction;
        try {
            prediction = await replicate.predictions.create({
                model: 'google/veo-3.1',
                input: input,
            });
        } catch (createError: any) {
            console.error('Error creating prediction:', createError);
            console.error('Error details:', JSON.stringify(createError, null, 2));
            throw new Error(`Failed to create Veo 3.1 prediction: ${createError.message}`);
        }

        console.log('Video generation started:', prediction.id);

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

