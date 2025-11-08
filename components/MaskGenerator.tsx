'use client';

import { useState } from 'react';

interface MaskGeneratorProps {
    imageUrl: string; // URL of the source image
    onMaskGenerated: (maskBase64: string, maskPreview: string) => void;
    onCancel: () => void;
}

export function MaskGenerator({ imageUrl, onMaskGenerated, onCancel }: MaskGeneratorProps) {
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [maskPreview, setMaskPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt describing what to segment');
            return;
        }

        setError(null);
        setIsGenerating(true);
        setMaskPreview(null);

        try {
            // Fetch the image and convert to File
            const imageResponse = await fetch(imageUrl, {
                credentials: 'include' // Include session cookie for authentication
            });

            if (!imageResponse.ok) {
                throw new Error(`Failed to load image: ${imageResponse.statusText}`);
            }

            const imageBlob = await imageResponse.blob();
            const imageFile = new File([imageBlob], 'image.png', { type: 'image/png' });

            // Create FormData
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('prompt', prompt);
            if (negativePrompt.trim()) {
                formData.append('negative_prompt', negativePrompt);
            }

            // Call mask generation API
            const response = await fetch('/api/masks/generate', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Failed to generate mask');
            }

            const result = await response.json();

            // Set mask preview
            const maskDataUri = `data:image/png;base64,${result.maskBase64}`;
            setMaskPreview(maskDataUri);

            console.log('Mask generated successfully:', {
                cost: result.cost,
                predictionId: result.predictionId
            });

        } catch (err) {
            console.error('Error generating mask:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate mask');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUseMask = () => {
        if (maskPreview) {
            // Extract base64 from data URI
            const base64 = maskPreview.split(',')[1];
            onMaskGenerated(base64, maskPreview);
        }
    };

    const handleRegenerate = () => {
        setMaskPreview(null);
        setError(null);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isGenerating && !maskPreview) {
            handleGenerate();
        }
        if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="bg-gray-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">🎯 Generate Mask</h2>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Image Preview Section */}
            <div className="relative mb-6 rounded-lg overflow-hidden bg-gray-800">
                <div className="relative aspect-video flex items-center justify-center">
                    {/* Use regular img tag to avoid Next.js Image optimization which doesn't send credentials */}
                    <img
                        src={imageUrl}
                        alt="Source image"
                        className="max-w-full max-h-full object-contain"
                    />
                    {/* Mask Overlay */}
                    {maskPreview && (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none bg-red-500/30">
                            <img
                                src={maskPreview}
                                alt="Generated mask (black=edit, white=preserve)"
                                className="max-w-full max-h-full object-contain mix-blend-multiply"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Input Section */}
            {!maskPreview ? (
                <div className="space-y-4">
                    {/* Prompt Input */}
                    <div>
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
                            What to segment? *
                        </label>
                        <input
                            id="prompt"
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="e.g., 'person', 'shirt', 'background'"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isGenerating}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Tip: Use '.' to separate multiple objects (e.g., 'person . shirt')
                        </p>
                    </div>

                    {/* Negative Prompt Input */}
                    <div>
                        <label htmlFor="negativePrompt" className="block text-sm font-medium text-gray-300 mb-2">
                            What to exclude? (optional)
                        </label>
                        <input
                            id="negativePrompt"
                            type="text"
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="e.g., 'background', 'ground'"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isGenerating}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-500 rounded-lg text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating mask...
                            </>
                        ) : (
                            'Generate Mask'
                        )}
                    </button>
                </div>
            ) : (
                /* Mask Preview Actions */
                <div className="space-y-4">
                    <div className="p-4 bg-green-900/20 border border-green-500 rounded-lg">
                        <p className="text-green-300 font-medium">✓ Mask generated successfully!</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Darkened areas (red tint removed) will be edited. Red-tinted areas will be preserved.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleRegenerate}
                            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Regenerate
                        </button>
                        <button
                            onClick={handleUseMask}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Use This Mask
                        </button>
                    </div>
                </div>
            )}

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
                <p className="text-blue-300 text-sm">
                    <strong>How it works:</strong> Grounded SAM will identify all instances of your prompt.
                    For example, "person" will segment all people in the image. The generated mask (black areas)
                    will be used by Nova Canvas to edit only those regions.
                </p>
            </div>
        </div>
    );
}
