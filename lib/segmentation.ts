import sharp from 'sharp';

interface GroundedSamInput {
    image: string; // base64 or URL
    prompt: string;
    negative_prompt?: string;
    box_threshold?: number;
    text_threshold?: number;
}

interface GroundedSamResult {
    maskBase64: string; // Inverted and ready for Nova Canvas
    predictionId: string;
    cost: number;
}

/**
 * ⚠️ CRITICAL: Grounded SAM and Nova Canvas use OPPOSITE mask conventions!
 * 
 * Grounded SAM output:
 * - White pixels = segmented object
 * - Black pixels = background
 * 
 * Nova Canvas input requirement:
 * - Black pixels = area to edit/inpaint
 * - White pixels = area to preserve
 * 
 * Solution: We MUST invert the mask colors before using with Nova Canvas.
 */

/**
 * Inverts a mask image colors using Sharp
 * Converts Grounded SAM format to Nova Canvas format
 */
async function invertMask(maskUrl: string): Promise<string> {
    const response = await fetch(maskUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const invertedBuffer = await sharp(buffer)
        .negate() // Flips colors: white→black, black→white
        .toBuffer();

    return invertedBuffer.toString('base64');
}

/**
 * Generate a segmentation mask using Grounded SAM, inverted for Nova Canvas
 * @param imageBase64 - Base64 encoded image
 * @param prompt - Text description of what to segment (e.g., "person", "shirt")
 * @param negativePrompt - Optional text for areas to exclude
 * @param mimeType - MIME type of the image (e.g., "image/jpeg", "image/png")
 * @returns Inverted mask (black=edit, white=preserve) ready for Nova Canvas
 */
export async function generateMaskForNovaCanvas(
    imageBase64: string,
    prompt: string,
    negativePrompt?: string,
    mimeType: string = 'image/jpeg'
): Promise<GroundedSamResult> {
    if (!process.env.REPLICATE_API_KEY) {
        throw new Error('REPLICATE_API_KEY is not set in environment variables');
    }

    // 1. Create prediction with Grounded SAM
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            version: 'ee871c19efb1941f55f66a3d7d960428c8a5afcb77449547fe8e5a3ab9ebc21c',
            input: {
                image: `data:${mimeType};base64,${imageBase64}`,
                mask_prompt: prompt,  // Fixed: was "prompt", should be "mask_prompt"
                negative_mask_prompt: negativePrompt || '',  // Fixed: was "negative_prompt"
                adjustment_factor: 0  // No erosion/dilation by default
            }
        })
    });

    if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create Grounded SAM prediction: ${errorText}`);
    }

    const prediction = await createResponse.json();
    console.log('Grounded SAM prediction created:', prediction.id, 'Status:', prediction.status);

    // 2. Poll for completion (max 180 seconds to account for Replicate queue)
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 180; // 3 minutes to handle busy Replicate servers

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        const statusResponse = await fetch(
            `https://api.replicate.com/v1/predictions/${result.id}`,
            {
                headers: {
                    'Authorization': `Token ${process.env.REPLICATE_API_KEY}`
                }
            }
        );

        if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            throw new Error(`Failed to check prediction status: ${errorText}`);
        }

        result = await statusResponse.json();
        
        // Log progress every 10 seconds
        if (attempts % 10 === 0) {
            console.log(`Grounded SAM polling attempt ${attempts}/180, status: ${result.status}`);
        }
        
        // Special message if stuck in queue
        if (attempts === 30 && result.status === 'starting') {
            console.log('⚠️ Mask generation queued on Replicate. This may take 2-3 minutes during busy times...');
        }
    }

    console.log('Grounded SAM final status:', result.status, 'after', attempts, 'attempts');

    if (result.status === 'failed') {
        const errorMsg = result.error || 'Unknown error';
        console.error('Grounded SAM failed:', errorMsg);

        // Check for common Grounded SAM errors
        if (errorMsg.includes('cannot reshape tensor of 0 elements')) {
            throw new Error('No objects matching "' + prompt + '" were found in the image. Try a different prompt or check if the object is clearly visible.');
        }

        throw new Error('Mask generation failed: ' + errorMsg);
    }

    if (attempts >= maxAttempts) {
        throw new Error(`Mask generation timed out after ${maxAttempts} seconds. The prediction may still be processing on Replicate. Status: ${result.status}`);
    }

    // 3. Download and invert mask for Nova Canvas
    if (!result.output) {
        throw new Error('No output from Grounded SAM prediction');
    }

    console.log('Grounded SAM output type:', typeof result.output);
    console.log('Grounded SAM full output:', result.output);

    // Grounded SAM returns an array of outputs
    // Output structure: [annotated_image_url, pure_mask_url] or similar
    let maskUrl: string;
    
    if (typeof result.output === 'string') {
        maskUrl = result.output;
    } else if (Array.isArray(result.output)) {
        console.log('Number of outputs:', result.output.length);
        result.output.forEach((url: string, index: number) => {
            console.log(`Output ${index}:`, url);
        });
        
        // Try to find the pure mask (usually contains 'mask' in filename, not 'annotated')
        const pureMask = result.output.find((url: string) => 
            url.includes('mask') && !url.includes('annotated')
        );
        
        if (pureMask) {
            console.log('Found pure mask:', pureMask);
            maskUrl = pureMask;
        } else {
            console.log('Pure mask not found, using last output:', result.output[result.output.length - 1]);
            maskUrl = result.output[result.output.length - 1];
        }
    } else {
        throw new Error('Invalid output format from Grounded SAM');
    }

    console.log('Using mask URL:', maskUrl);
    console.log('Inverting mask colors for Nova Canvas...');

    const invertedMaskBase64 = await invertMask(maskUrl);

    return {
        maskBase64: invertedMaskBase64, // Ready for Nova Canvas (black=edit, white=preserve)
        predictionId: result.id,
        cost: 0.0014
    };
}

/**
 * Test function to verify mask inversion works correctly
 */
export async function testMaskInversion(testImageBase64: string) {
    console.log('1. Generating mask with Grounded SAM (white=object, black=background)');
    const result = await generateMaskForNovaCanvas(testImageBase64, 'person');

    console.log('2. Mask inverted for Nova Canvas (black=object, white=background)');
    console.log('   Ready to use with Nova Canvas inpainting');
    console.log('   Prediction ID:', result.predictionId);
    console.log('   Cost: $', result.cost);

    return result;
}
