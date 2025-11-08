import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

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
 * Uses natural language masking OR manual mask image to identify which part to edit
 */
export async function editImageWithNovaCanvas(
    dataUri: string,
    instruction: string,
    options?: {
        maskImageBase64?: string;  // Optional manual mask (black=edit, white=preserve)
    }
): Promise<{
    imageData: string;
    mimeType: string;
    maskPrompt?: string;
}> {
    try {
        // Extract base64 data from data URI
        const base64Data = dataUri.split(',')[1] || dataUri;

        const requestBody: any = {
            taskType: "INPAINTING",
            inPaintingParams: {
                image: base64Data,
                text: instruction,
            },
            imageGenerationConfig: {
                numberOfImages: 1,
                quality: "premium",
                cfgScale: 8.0,
            },
        };

        // Use manual mask if provided, otherwise use maskPrompt
        let maskPrompt: string | undefined;
        if (options?.maskImageBase64) {
            // Manual mask provided - use maskImage parameter
            requestBody.inPaintingParams.maskImage = options.maskImageBase64;
            console.log('Nova Canvas editing with manual maskImage');
        } else {
            // No manual mask - extract maskPrompt from instruction
            maskPrompt = extractMaskPrompt(instruction);
            requestBody.inPaintingParams.maskPrompt = maskPrompt;
            console.log('Nova Canvas editing with maskPrompt:', { instruction, maskPrompt });
        }

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

/**
 * Use Claude 4.5 Sonnet to explain errors and suggest fixes
 */
export async function explainErrorWithClaude(
    errorMessage: string,
    userInstruction: string,
    context: {
        model: string;
        mode: 'generation' | 'editing' | 'video';
        extractedMaskPrompt?: string;
        imageBase64?: string;
    }
): Promise<{
    explanation: string;
    suggestedFix: string;
}> {
    try {
        const systemPrompt = `You are a helpful AI assistant explaining image/video generation errors to users in a friendly, concise way.

${context.imageBase64 && context.mode !== 'video' ? 'You can see the image the user is trying to edit.' : ''}

Error: ${errorMessage}
User's instruction: "${userInstruction}"
Model: ${context.model}
Mode: ${context.mode}
${context.extractedMaskPrompt ? `Extracted mask prompt: "${context.extractedMaskPrompt}"` : ''}

${context.imageBase64 && context.mode !== 'video' ?
                `Please analyze the image and the user's instruction together. If the instruction doesn't make sense for this image (e.g., asking to edit something that's not there), point this out clearly.` : ''}

Please provide:
1. A brief, friendly explanation of what went wrong (1-2 sentences max)
2. A corrected version of the user's instruction that will work better

Format your response exactly as:
EXPLANATION: [your explanation]
SUGGESTED: [corrected instruction]`;

        // Build content array - text + optional image
        const contentArray: any[] = [{ text: systemPrompt }];

        // Add image if provided (only for image operations, not video)
        if (context.imageBase64 && context.mode !== 'video') {
            // Convert base64 to Uint8Array for Bedrock
            const imageData = context.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const binaryData = Buffer.from(imageData, 'base64');

            contentArray.push({
                image: {
                    format: "png",
                    source: {
                        bytes: new Uint8Array(binaryData)
                    }
                }
            });
        }

        const response = await client.send(new ConverseCommand({
            modelId: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
            messages: [
                {
                    role: "user",
                    content: contentArray
                }
            ],
            inferenceConfig: {
                maxTokens: 300,
                temperature: 0.3,
            }
        }));

        // Parse Claude's response
        const text = response.output?.message?.content?.[0]?.text;

        if (!text) {
            throw new Error('No response from Claude');
        }

        const explanationMatch = text.match(/EXPLANATION:\s*(.+?)(?=SUGGESTED:|$)/);
        const suggestedMatch = text.match(/SUGGESTED:\s*(.+?)$/);

        const explanation = explanationMatch?.[1]?.trim() || formatErrorMessage(errorMessage);
        const suggestedFix = suggestedMatch?.[1]?.trim() || userInstruction;

        return { explanation, suggestedFix };
    } catch (error) {
        console.error('Error calling Claude for error explanation:', error);
        // Fallback - show the actual error in a formatted way
        return {
            explanation: formatErrorMessage(errorMessage),
            suggestedFix: userInstruction,
        };
    }
}

/**
 * Format error messages nicely for users
 */
function formatErrorMessage(errorMessage: string): string {
    // Extract the key part of AWS errors
    if (errorMessage.includes('ValidationException')) {
        const cleanMessage = errorMessage
            .replace(/ValidationException:\s*/i, '')
            .replace(/\. Please refer to.*$/i, '.');
        return `❌ ${cleanMessage}\n\nPlease adjust your prompt and try again.`;
    }

    // Generic formatting
    const cleanMessage = errorMessage
        .replace(/Error:\s*/i, '')
        .replace(/Exception:\s*/i, '')
        .split('\n')[0]; // Take first line only

    return `❌ ${cleanMessage}\n\nPlease try a different approach.`;
}

/**
 * Use Claude 4.5 Sonnet to improve user prompts proactively
 */
export async function improvePromptWithClaude(
    userPrompt: string,
    context: {
        mode: 'create' | 'edit' | 'video';
        selectedImage?: string;      // base64 for edit mode
        frameImages?: string[];      // base64 array for video mode (first/last/reference)
    }
): Promise<{
    improvedPrompt: string;
    improvements: string;
    example2: string;
}> {
    try {
        const systemPrompt = `You are an expert AI prompt engineer. Your job is to SIGNIFICANTLY improve prompts for image/video generation.

${context.selectedImage ? 'You can see the image the user wants to edit.' : ''}
${context.frameImages && context.frameImages.length > 0 ? `You can see ${context.frameImages.length} reference/frame image(s) for the video.` : ''}

User's prompt: "${userPrompt}"
Mode: ${context.mode}

IMPORTANT: You must ALWAYS improve the prompt. Never return it unchanged.

For CREATE mode: Add specific details about:
- Visual style (photorealistic, artistic, minimalist, etc.)
- Lighting (studio, natural, dramatic, etc.)
- Composition and framing
- Quality indicators (high detail, 4K, professional, etc.)
- Any missing descriptive elements

For EDIT mode: Make the instruction clearer and more specific based on what you see in the image.

For VIDEO mode: Add camera movement, scene transitions, pacing, and cinematic details.

${context.selectedImage ? 'Based on what you see in the image, suggest edits that make sense for the actual content shown.' : ''}

ALWAYS make the prompt better and more detailed. Short prompts like "a cat" should become "A photorealistic portrait of a cat with detailed fur, bright eyes, natural lighting, shallow depth of field, high quality".

Format your response exactly as:
TIPS: [very concise tips on how to improve this specific prompt]
EXAMPLE1: [first improved version of the user's prompt]
EXAMPLE2: [second improved version with different style/approach]`;

        // Build content array - text + optional images
        const contentArray: any[] = [{ text: systemPrompt }];

        // Add image for edit mode
        if (context.selectedImage && context.mode === 'edit') {
            const imageData = context.selectedImage.replace(/^data:image\/\w+;base64,/, '');
            const binaryData = Buffer.from(imageData, 'base64');

            contentArray.push({
                image: {
                    format: "png",
                    source: { bytes: new Uint8Array(binaryData) }
                }
            });
        }

        // Add frame images for video mode (up to 3)
        if (context.frameImages && context.mode === 'video') {
            for (const frameImage of context.frameImages.slice(0, 3)) {
                const imageData = frameImage.replace(/^data:image\/\w+;base64,/, '');
                const binaryData = Buffer.from(imageData, 'base64');

                contentArray.push({
                    image: {
                        format: "png",
                        source: { bytes: new Uint8Array(binaryData) }
                    }
                });
            }
        }

        const response = await client.send(new ConverseCommand({
            modelId: "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
            messages: [{ role: "user", content: contentArray }],
            inferenceConfig: { maxTokens: 400, temperature: 0.5 }
        }));

        const text = response.output?.message?.content?.[0]?.text;
        if (!text) throw new Error('No response from Claude');

        console.log('Claude improvement response:', text);

        const tipsMatch = text.match(/TIPS:\s*([\s\S]+?)(?=EXAMPLE1:|$)/);
        const example1Match = text.match(/EXAMPLE1:\s*([\s\S]+?)(?=EXAMPLE2:|$)/);
        const example2Match = text.match(/EXAMPLE2:\s*([\s\S]+?)$/);

        const tips = tipsMatch?.[1]?.trim() || "Add more descriptive details.";
        const example1 = example1Match?.[1]?.trim() || userPrompt;
        const example2 = example2Match?.[1]?.trim() || userPrompt;

        return {
            improvedPrompt: example1,  // Use first example as default
            improvements: tips,
            example2: example2
        };
    } catch (error) {
        console.error('Error improving prompt with Claude:', error);
        return {
            improvedPrompt: userPrompt,
            improvements: "Unable to improve prompt at this time.",
            example2: userPrompt
        };
    }
}
