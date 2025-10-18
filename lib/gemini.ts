import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
}

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate an image from a text prompt using Gemini Nano Banana
 * Uses Gemini 2.5 Flash Image model
 */
export async function generateImage(prompt: string): Promise<{
    imageData: string;
    mimeType: string;
}> {
    try {
        // Use Gemini 2.5 Flash Image (Nano Banana)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image'
        });

        const result = await model.generateContent(prompt);

        const response = result.response;

        // Extract image data from response parts
        if (response.candidates && response.candidates[0]?.content?.parts) {
            const parts = response.candidates[0].content.parts;

            // Look for inline data (images)
            for (const part of parts) {
                if ('inlineData' in part && part.inlineData) {
                    return {
                        imageData: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || 'image/png',
                    };
                }
            }
        }

        throw new Error('No image data found in Gemini response');
    } catch (error) {
        console.error('Error generating image with Gemini:', error);
        throw error;
    }
}

/**
 * Edit an existing image using Gemini Nano Banana
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
        // Use Gemini 2.5 Flash Image (Nano Banana)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image'
        });

        // Convert buffer to base64
        const imageBase64 = imageBuffer.toString('base64');

        const result = await model.generateContent([
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType,
                },
            },
            { text: instruction }
        ]);

        const response = result.response;

        // Debug: Log what we received
        console.log('Gemini response candidates:', response.candidates?.length);
        if (response.candidates && response.candidates[0]) {
            console.log('First candidate parts:', response.candidates[0].content?.parts?.length);
            console.log('Parts types:', response.candidates[0].content?.parts?.map((p: any) =>
                Object.keys(p).join(',')
            ));
        }

        // Extract edited image from response
        if (response.candidates && response.candidates[0]?.content?.parts) {
            const parts = response.candidates[0].content.parts;

            for (const part of parts) {
                // Check for inline data (images)
                if ('inlineData' in part && part.inlineData) {
                    return {
                        imageData: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || mimeType,
                    };
                }

                // Log if we got text instead
                if ('text' in part && part.text) {
                    console.log('Got text response from Gemini:', part.text.substring(0, 200));
                }
            }
        }

        // More detailed error with what we actually got
        const receivedTypes = response.candidates?.[0]?.content?.parts?.map((p: any) =>
            Object.keys(p)[0]
        ).join(', ') || 'no parts';

        throw new Error(`No edited image data found in Gemini response. Received: ${receivedTypes}`);
    } catch (error) {
        console.error('Error editing image with Gemini:', error);
        throw error;
    }
}

/**
 * Get text response from Gemini (for chat features)
 */
export async function generateText(prompt: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp'
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 1,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
            },
        });

        const response = result.response;
        return response.text();
    } catch (error) {
        console.error('Error generating text with Gemini:', error);
        throw error;
    }
}

