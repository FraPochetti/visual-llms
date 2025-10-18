/**
 * Official Gemini API pricing
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 * Last updated: October 2025
 */

export const API_PRICING = {
    // Imagen 4 pricing (per image, regardless of resolution)
    IMAGEN_4_FAST: 0.02,      // Fast tier
    IMAGEN_4_STANDARD: 0.04,   // Standard tier
    IMAGEN_4_ULTRA: 0.06,      // Ultra tier (our default)

    // Gemini 2.5 Flash Image pricing (per 1024×1024 image)
    // Output = $30 per 1M tokens; ~1,290 tokens per image
    GEMINI_FLASH_IMAGE_STANDARD: 0.039,  // Standard: ~$0.039 per image
    GEMINI_FLASH_IMAGE_BATCH: 0.0195,    // Batch: ~$0.0195 per image (half price)

    // Input tokens (negligible for most prompts, not tracked separately)
    // GEMINI_INPUT_STANDARD: 0.30 per 1M tokens
    // GEMINI_INPUT_BATCH: 0.15 per 1M tokens
} as const;

/**
 * Calculate estimated cost for API operations
 * Note: This assumes Imagen 4 Ultra and Gemini 2.5 Flash Image Standard pricing
 */
export function calculateCost(
    provider: string,
    count: number
): number {
    if (provider === 'google-imagen4') {
        // Using Ultra tier ($0.06 per image)
        return count * API_PRICING.IMAGEN_4_ULTRA;
    } else if (provider === 'gemini-nano-banana') {
        // Gemini 2.5 Flash Image Standard pricing
        return count * API_PRICING.GEMINI_FLASH_IMAGE_STANDARD;
    }
    // local-fs uploads are free
    return 0;
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
    return `$${cost.toFixed(2)}`;
}

