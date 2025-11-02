/**
 * Replicate API pricing
 * Source: https://replicate.com/pricing
 * Last updated: October 2025
 * 
 * Note: Replicate charges based on hardware usage and prediction time
 * Pricing varies by model and hardware tier
 */

export const API_PRICING = {
    // Imagen 4 Ultra on Replicate
    // Estimated: ~$0.08 per image (based on GPU time)
    IMAGEN_4_ULTRA: 0.08,

    // Nano Banana on Replicate
    // Estimated: ~$0.05 per image (based on GPU time)
    NANO_BANANA: 0.05,

    // Qwen Image Edit Plus on Replicate
    // Pricing: $0.03 per output image
    QWEN_IMAGE_EDIT_PLUS: 0.03,

    // SeedEdit 3.0 on Replicate
    // Pricing: $0.03 per output image
    SEEDEDIT_3_0: 0.03,

    // Seedream 4 on Replicate
    // Pricing: $0.03 per output image
    SEEDREAM_4: 0.03,

    // Amazon Nova Canvas on AWS Bedrock
    // Pricing: $0.08 per 2048x2048 premium quality image
    // Source: https://aws.amazon.com/bedrock/pricing/
    NOVA_CANVAS_PREMIUM_2K: 0.08,

    // Veo 3.1 on Replicate
    // Estimated: ~$4.00 per 8-second video (based on GPU time)
    VEO_3_1_PER_VIDEO: 4.00,

    // Replicate hardware pricing (per second)
    // These are used for more accurate cost calculation when predict_time is available
    NVIDIA_T4_GPU: 0.000225,      // $0.81/hr
    NVIDIA_A100_GPU: 0.001400,     // $5.04/hr
    NVIDIA_H100_GPU: 0.001525,     // $5.49/hr
    NVIDIA_L40S_GPU: 0.000975,     // $3.51/hr
} as const;

/**
 * Calculate estimated cost for API operations
 * Note: Replicate pricing is based on prediction time and hardware used
 */
export function calculateCost(
    provider: string,
    count: number
): number {
    if (provider === 'google-imagen4') {
        // Imagen 4 Ultra on Replicate
        return count * API_PRICING.IMAGEN_4_ULTRA;
    } else if (provider === 'gemini-nano-banana') {
        // Nano Banana on Replicate
        return count * API_PRICING.NANO_BANANA;
    } else if (provider === 'qwen-image-edit-plus') {
        // Qwen Image Edit Plus on Replicate
        return count * API_PRICING.QWEN_IMAGE_EDIT_PLUS;
    } else if (provider === 'seededit-3.0') {
        // SeedEdit 3.0 on Replicate
        return count * API_PRICING.SEEDEDIT_3_0;
    } else if (provider === 'seedream-4') {
        // Seedream 4 on Replicate
        return count * API_PRICING.SEEDREAM_4;
    } else if (provider === 'aws-nova-canvas') {
        // Nova Canvas on AWS Bedrock (2048x2048 premium)
        return count * API_PRICING.NOVA_CANVAS_PREMIUM_2K;
    } else if (provider === 'google-veo-3.1') {
        // Veo 3.1 on Replicate
        return count * API_PRICING.VEO_3_1_PER_VIDEO;
    }
    // local-fs uploads are free
    return 0;
}

/**
 * Calculate cost based on actual prediction time and hardware
 * More accurate when prediction metrics are available
 */
export function calculateCostFromPredictTime(
    predictTimeSeconds: number,
    hardwareType: 'T4' | 'A100' | 'H100' | 'L40S' = 'A100'
): number {
    const rateMap = {
        'T4': API_PRICING.NVIDIA_T4_GPU,
        'A100': API_PRICING.NVIDIA_A100_GPU,
        'H100': API_PRICING.NVIDIA_H100_GPU,
        'L40S': API_PRICING.NVIDIA_L40S_GPU,
    };

    return predictTimeSeconds * rateMap[hardwareType];
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
    return `$${cost.toFixed(2)}`;
}
