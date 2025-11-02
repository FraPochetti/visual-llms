import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize Bedrock client - uses EC2 instance IAM role automatically
const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'eu-west-1',
});

/**
 * Extract the object/area to mask from an editing instruction
 * Examples:
 * - "remove the bird" → "bird"
 * - "add a scarf to the lady" → "lady"
 * - "change the sky to purple" → "sky"
 * - "make the background darker" → "background"
 */
function extractMaskPrompt(instruction: string): string {
    const lower = instruction.toLowerCase();

    // Common patterns for object extraction
    const patterns = [
        /remove (?:the )?(.+?)(?:\s+from|\s*$)/i,
        /delete (?:the )?(.+?)(?:\s+from|\s*$)/i,
        /change (?:the )?(.+?)(?:\s+to|\s*$)/i,
        /replace (?:the )?(.+?)(?:\s+with|\s*$)/i,
        /add .+? to (?:the )?(.+?)(?:\s*$)/i,
        /(?:make|turn) (?:the )?(.+?)(?:\s+into|\s+more|\s+less|\s*$)/i,
    ];

    for (const pattern of patterns) {
        const match = instruction.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }

    // Fallback: look for common objects
    const commonObjects = ['bird', 'sky', 'background', 'person', 'tree', 'building', 'car', 'dog', 'cat', 'face', 'hair', 'clothes', 'shirt', 'pants'];
    for (const obj of commonObjects) {
        if (lower.includes(obj)) {
            return obj;
        }
    }

    // Default fallback - return the whole instruction as maskPrompt
    return instruction.split(' ').slice(0, 3).join(' ');
}

/**
 * Generate an image from a text prompt using Amazon Nova Canvas (TEXT_IMAGE)
 */
export async function generateImageWithNovaCanvas(prompt: string): Promise<{
    imageData: string;
    mimeType: string;
}> {
    try {
        const requestBody = {
            taskType: "TEXT_IMAGE",
            textToImageParams: {
                text: prompt,
            },
            imageGenerationConfig: {
                numberOfImages: 1,
                height: 2048,
                width: 2048,
                quality: "premium",
                cfgScale: 8.0,
            },
        };

        const command = new InvokeModelCommand({
            modelId: "amazon.nova-canvas-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(requestBody),
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        if (!responseBody.images || responseBody.images.length === 0) {
            throw new Error('No images returned from Nova Canvas');
        }

        // Nova Canvas returns base64-encoded images
        return {
            imageData: responseBody.images[0],
            mimeType: 'image/png',
        };
    } catch (error) {
        console.error('Error generating image with Nova Canvas:', error);
        throw error;
    }
}

/**
 * Edit an image using Amazon Nova Canvas (INPAINTING)
 * Uses natural language to automatically identify the area to edit
 */
export async function editImageWithNovaCanvas(
    dataUri: string,
    instruction: string
): Promise<{
    imageData: string;
    mimeType: string;
    maskPrompt: string;
}> {
    try {
        // Extract base64 data from data URI
        const base64Data = dataUri.split(',')[1] || dataUri;

        // Extract what to mask from the instruction
        const maskPrompt = extractMaskPrompt(instruction);

        console.log('Nova Canvas editing:', { instruction, maskPrompt });

        const requestBody = {
            taskType: "INPAINTING",
            inPaintingParams: {
                image: base64Data,
                text: instruction,
                maskPrompt: maskPrompt,
            },
            imageGenerationConfig: {
                numberOfImages: 1,
                quality: "premium",
                cfgScale: 8.0,
            },
        };

        const command = new InvokeModelCommand({
            modelId: "amazon.nova-canvas-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(requestBody),
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        if (!responseBody.images || responseBody.images.length === 0) {
            throw new Error('No images returned from Nova Canvas');
        }

        return {
            imageData: responseBody.images[0],
            mimeType: 'image/png',
            maskPrompt: maskPrompt,
        };
    } catch (error) {
        console.error('Error editing image with Nova Canvas:', error);
        throw error;
    }
}

