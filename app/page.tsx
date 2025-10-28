'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    imageId?: string; // For saving to gallery
    videoUrl?: string;
    videoId?: string; // For saving to gallery
    mediaType?: 'image' | 'video';
    originalImageId?: string; // For undo functionality
    saved?: boolean; // Track if already saved
    timestamp: Date;
};

export default function ChatPage() {
    const searchParams = useSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'create' | 'edit' | 'video'>('create');
    const [selectedModel, setSelectedModel] = useState<'imagen4' | 'nano-banana'>('imagen4');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadedImageRef = useRef<string | null>(null);

    // Video mode states - Two clear modes: Standard (frame anchors) or Reference (R2V subject consistency)
    const [videoGenerationMode, setVideoGenerationMode] = useState<'standard' | 'reference'>('standard');
    const [firstFrameId, setFirstFrameId] = useState<string | null>(null);
    const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null);
    const [lastFrameId, setLastFrameId] = useState<string | null>(null);
    const [lastFrameUrl, setLastFrameUrl] = useState<string | null>(null);
    const [referenceImageIds, setReferenceImageIds] = useState<string[]>([]);
    const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
    const [videoDuration, setVideoDuration] = useState<number>(8);
    const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('1080p');
    const [generateAudio, setGenerateAudio] = useState<boolean>(true);
    const [showVideoOptions, setShowVideoOptions] = useState<boolean>(false); // Collapse by default to save space

    // Handle images from gallery (single or multiple)
    useEffect(() => {
        // Check for single imageId (backward compatibility)
        const singleImageId = searchParams.get('imageId');

        // Check for multiple imageIds
        const multipleIds = searchParams.get('imageIds');

        const imageIds = multipleIds
            ? multipleIds.split(',').filter(id => id.trim())
            : singleImageId
                ? [singleImageId]
                : [];

        if (imageIds.length > 0) {
            const idsKey = imageIds.join(',');
            if (loadedImageRef.current !== idsKey) {
                loadedImageRef.current = idsKey;

                // Fetch the image details to get the paths
                fetch('/api/gallery')
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            const foundAssets = imageIds
                                .map(id => data.assets.find((a: any) => a.id === id))
                                .filter(Boolean);

                            if (foundAssets.length > 0) {
                                // Add all images as messages in chat
                                const newMessages: Message[] = [];

                                if (foundAssets.length === 1) {
                                    // Single image - set as selected for editing
                                    const asset = foundAssets[0];
                                    setSelectedImage(asset.id);
                                    setSelectedImageUrl(`/api/media/${asset.path}`);
                                    setMode('edit');

                                    newMessages.push({
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: 'Image loaded from gallery. What would you like me to do with it?',
                                        imageUrl: `/api/media/${asset.path}`,
                                        imageId: asset.id,
                                        saved: true,
                                        timestamp: new Date(),
                                    });
                                } else {
                                    // Multiple images - add to chat and switch to video mode
                                    newMessages.push({
                                        id: Date.now().toString(),
                                        role: 'assistant',
                                        content: `${foundAssets.length} images loaded from gallery. Select frames for video generation using the buttons below each image.`,
                                        timestamp: new Date(),
                                    });

                                    foundAssets.forEach((asset, index) => {
                                        newMessages.push({
                                            id: `${Date.now()}-${index}`,
                                            role: 'assistant',
                                            content: `Image ${index + 1}`,
                                            imageUrl: `/api/media/${asset.path}`,
                                            imageId: asset.id,
                                            saved: true,
                                            timestamp: new Date(),
                                        });
                                    });

                                    setMode('video'); // Switch to video mode for multi-image
                                }

                                setMessages(prev => [...prev, ...newMessages]);
                            }
                        }
                    })
                    .catch(err => console.error('Error fetching images:', err));
            }
        }
    }, [searchParams]);

    // Load chat history from localStorage on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('visual-neurons-chat-history');
        if (savedHistory) {
            try {
                const parsed = JSON.parse(savedHistory);
                // Convert timestamp strings back to Date objects
                const restored = parsed.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp),
                }));
                setMessages(restored);
                console.log('Restored', restored.length, 'messages from localStorage');
            } catch (e) {
                console.error('Failed to load chat history:', e);
            }
        }
    }, []); // Run once on mount

    // Save chat history to localStorage whenever it changes
    useEffect(() => {
        if (messages.length > 0) {
            // Keep last 100 messages only to prevent overflow
            const toSave = messages.slice(-100);
            localStorage.setItem('visual-neurons-chat-history', JSON.stringify(toSave));
        }
    }, [messages]);

    // Clear chat history
    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem('visual-neurons-chat-history');
        // Also clear selected images
        setSelectedImage(null);
        setSelectedImageUrl(null);
        setFirstFrameId(null);
        setFirstFrameUrl(null);
        setLastFrameId(null);
        setLastFrameUrl(null);
        setReferenceImageIds([]);
        setReferenceImageUrls([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setLoadingProgress(0);

        try {
            let response;
            if (mode === 'video') {
                // Video generation mode
                // Start progress polling
                const progressInterval = setInterval(() => {
                    setLoadingProgress(prev => prev + 10);
                }, 10000); // Update every 10 seconds

                // Validation for Reference mode
                if (videoGenerationMode === 'reference' && referenceImageIds.length === 0) {
                    throw new Error('Reference mode requires at least 1 reference image. Click "+ Reference" on images above.');
                }

                try {
                    response = await fetch('/api/videos/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: input,
                            videoGenerationMode: videoGenerationMode,
                            firstFrameId: videoGenerationMode === 'standard' ? firstFrameId : undefined,
                            lastFrameId: videoGenerationMode === 'standard' ? lastFrameId : undefined,
                            referenceImageIds: videoGenerationMode === 'reference' ? referenceImageIds : undefined,
                            duration: videoGenerationMode === 'reference' ? 8 : videoDuration,
                            resolution: videoResolution,
                            generateAudio: generateAudio,
                        }),
                    });
                } finally {
                    clearInterval(progressInterval);
                }

                const data = await response.json();

                // Check if webhook mode is being used
                if (data.useWebhook && data.predictionId) {
                    console.log('Webhook mode: polling for prediction status');

                    // Show processing message
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: `🎬 Video generation started! Processing in background...\n\nYou can safely refresh or navigate away. The video will appear in your gallery when complete.\n\nPrediction ID: ${data.predictionId.substring(0, 8)}...`,
                        timestamp: new Date(),
                    }]);

                    // Poll our API for status
                    const pollPrediction = async () => {
                        const statusResponse = await fetch(`/api/predictions/${data.predictionId}`);
                        const statusData = await statusResponse.json();

                        if (statusData.success) {
                            if (statusData.prediction.status === 'succeeded' && statusData.asset) {
                                // Video is ready!
                                setMessages(prev => [...prev, {
                                    id: Date.now().toString(),
                                    role: 'assistant',
                                    content: 'Video generated successfully! Auto-saved to gallery.',
                                    videoUrl: `/api/media/${statusData.asset.path}`,
                                    videoId: statusData.asset.id,
                                    mediaType: 'video',
                                    saved: true,
                                    timestamp: new Date(),
                                }]);
                                setIsLoading(false);
                                return true; // Done
                            } else if (statusData.prediction.status === 'failed') {
                                setMessages(prev => [...prev, {
                                    id: Date.now().toString(),
                                    role: 'assistant',
                                    content: `Video generation failed: ${statusData.prediction.error || 'Unknown error'}`,
                                    timestamp: new Date(),
                                }]);
                                setIsLoading(false);
                                return true; // Done (failed)
                            }
                        }
                        return false; // Still processing
                    };

                    // Poll every 10 seconds
                    const pollInterval = setInterval(async () => {
                        const isDone = await pollPrediction();
                        if (isDone) {
                            clearInterval(pollInterval);
                        }
                    }, 10000);

                    // Check immediately once
                    const isDone = await pollPrediction();
                    if (isDone) {
                        clearInterval(pollInterval);
                    }

                    setIsLoading(false);
                    return; // Exit early for webhook mode
                }

                // Fall through to synchronous mode handling
            } else if (mode === 'create') {
                response = await fetch('/api/images/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: input, model: selectedModel }),
                });
            } else {
                response = await fetch('/api/images/edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageId: selectedImage, instruction: input }),
                });
            }

            const data = await response.json();

            // Handle both success and error responses
            if (!response.ok || !data.success) {
                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.error || data.message || `Failed to process ${mode === 'video' ? 'video' : 'image'}`,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMessage]);
                return;
            }

            // Create assistant message based on mode
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.message || 'Processed successfully!',
                imageUrl: data.imageUrl,
                imageId: data.imageId,
                videoUrl: data.videoUrl,
                videoId: data.videoId,
                mediaType: mode === 'video' ? 'video' : 'image',
                originalImageId: data.originalImageId || undefined, // For undo
                saved: false, // Not saved yet
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Update selected image to the newly created/edited one for chaining edits
            if (mode !== 'video' && data.imageId && data.imageUrl) {
                setSelectedImage(data.imageId);
                setSelectedImageUrl(data.imageUrl);
                // Stay in edit mode so user can continue editing
                if (mode === 'create') {
                    setMode('edit');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, there was an error processing your request. Please check your connection and try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setLoadingProgress(0);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/images/save', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.success) {
                const imageUrl = `/api/media/${data.asset.path}`;
                setSelectedImage(data.asset.id);
                setSelectedImageUrl(imageUrl);
                setMode('edit');

                // Add uploaded image to chat
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: 'Image uploaded successfully! What would you like me to do with it?',
                    imageUrl,
                    imageId: data.asset.id,
                    saved: true, // User uploads are auto-saved
                    timestamp: new Date(),
                }]);
            }
        } catch (error) {
            console.error('Error uploading image:', error);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {/* Left column - Messages */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Visual Neurons
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Prompt. Picture. Video.
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            {messages.length > 0 && (
                                <button
                                    onClick={clearChat}
                                    className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition"
                                    title="Clear chat history"
                                >
                                    Clear Chat
                                </button>
                            )}
                            <Link
                                href="/usage"
                                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
                            >
                                Usage
                            </Link>
                            <Link
                                href="/gallery"
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                Gallery
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-gray-500 dark:text-gray-400">
                                <p className="text-lg mb-2">
                                    Drop an image to edit, or start with a prompt to create.
                                </p>
                                <p className="text-sm">
                                    Choose between Create and Edit modes below.
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                            >
                                <div
                                    className={`max-w-2xl rounded-lg px-4 py-3 ${message.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                    {message.imageUrl && (
                                        <div className="mt-3">
                                            <img
                                                src={message.imageUrl}
                                                alt="Generated"
                                                className={`rounded-lg max-w-md cursor-pointer hover:opacity-90 transition ${selectedImage === message.imageId
                                                    ? 'ring-4 ring-blue-500'
                                                    : ''
                                                    }`}
                                                onClick={() => window.open(message.imageUrl, '_blank')}
                                                title="Click to view full size"
                                            />
                                            <div className="mt-2 flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs opacity-75">
                                                        ✨ AI-generated
                                                    </span>
                                                    {message.imageId && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedImage(message.imageId!);
                                                                    setSelectedImageUrl(message.imageUrl!);
                                                                    setMode('edit');
                                                                }}
                                                                className={`text-xs px-2 py-1 rounded transition ${selectedImage === message.imageId
                                                                    ? 'bg-green-600 text-white'
                                                                    : 'bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600/30'
                                                                    }`}
                                                                title="Select this image for editing"
                                                            >
                                                                {selectedImage === message.imageId ? '✓ Selected' : 'Edit This'}
                                                            </button>
                                                            {mode === 'video' && (
                                                                <>
                                                                    {videoGenerationMode === 'standard' && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setFirstFrameId(message.imageId!);
                                                                                    setFirstFrameUrl(message.imageUrl!);
                                                                                }}
                                                                                className={`text-xs px-2 py-1 rounded transition ${firstFrameId === message.imageId
                                                                                    ? 'bg-purple-600 text-white'
                                                                                    : 'bg-purple-600/20 text-purple-600 dark:text-purple-400 hover:bg-purple-600/30'
                                                                                    }`}
                                                                                title="Use as video starting frame"
                                                                            >
                                                                                {firstFrameId === message.imageId ? '✓ First' : 'First Frame'}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setLastFrameId(message.imageId!);
                                                                                    setLastFrameUrl(message.imageUrl!);
                                                                                }}
                                                                                className={`text-xs px-2 py-1 rounded transition ${lastFrameId === message.imageId
                                                                                    ? 'bg-orange-600 text-white'
                                                                                    : 'bg-orange-600/20 text-orange-600 dark:text-orange-400 hover:bg-orange-600/30'
                                                                                    }`}
                                                                                title="Use as video ending frame"
                                                                            >
                                                                                {lastFrameId === message.imageId ? '✓ Last' : 'Last Frame'}
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {videoGenerationMode === 'reference' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                const imageId = message.imageId!;
                                                                                const imageUrl = message.imageUrl!;

                                                                                if (referenceImageIds.includes(imageId)) {
                                                                                    // Remove from references
                                                                                    setReferenceImageIds(prev => prev.filter(id => id !== imageId));
                                                                                    setReferenceImageUrls(prev => prev.filter(url => url !== imageUrl));
                                                                                } else if (referenceImageIds.length < 3) {
                                                                                    // Add to references
                                                                                    setReferenceImageIds(prev => [...prev, imageId]);
                                                                                    setReferenceImageUrls(prev => [...prev, imageUrl]);
                                                                                }
                                                                            }}
                                                                            className={`text-xs px-2 py-1 rounded transition ${referenceImageIds.includes(message.imageId!)
                                                                                ? 'bg-green-600 text-white'
                                                                                : referenceImageIds.length >= 3
                                                                                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                                                    : 'bg-green-600/20 text-green-600 dark:text-green-400 hover:bg-green-600/30'
                                                                                }`}
                                                                            title={referenceImageIds.length >= 3 && !referenceImageIds.includes(message.imageId!)
                                                                                ? 'Maximum 3 reference images'
                                                                                : 'Add as reference for subject consistency (R2V)'
                                                                            }
                                                                            disabled={referenceImageIds.length >= 3 && !referenceImageIds.includes(message.imageId!)}
                                                                        >
                                                                            {referenceImageIds.includes(message.imageId!) ? '✓ Ref' : '+ Reference'}
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                    {message.originalImageId && (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    // Fetch the original image details
                                                                    const response = await fetch(`/api/images/${message.originalImageId}`);
                                                                    const data = await response.json();
                                                                    if (data.success) {
                                                                        // Switch back to original image
                                                                        const origUrl = `/api/media/${data.asset.path}`;
                                                                        setSelectedImage(message.originalImageId || null);
                                                                        setSelectedImageUrl(origUrl);

                                                                        // Add message to show what happened
                                                                        setMessages(prev => [...prev, {
                                                                            id: Date.now().toString(),
                                                                            role: 'assistant',
                                                                            content: 'Reverted to previous image. You can continue editing from here.',
                                                                            imageUrl: origUrl,
                                                                            imageId: message.originalImageId,
                                                                            timestamp: new Date(),
                                                                        }]);
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error loading previous image:', error);
                                                                }
                                                            }}
                                                            className="text-xs px-2 py-1 bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-600/30 transition"
                                                            title="Go back to previous version"
                                                        >
                                                            ← Previous
                                                        </button>
                                                    )}
                                                </div>
                                                {message.imageId && !message.saved ? (
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const response = await fetch(`/api/images/${message.imageId}/save`, {
                                                                    method: 'POST',
                                                                });
                                                                const data = await response.json();
                                                                if (data.success) {
                                                                    // Mark message as saved
                                                                    setMessages(prev => prev.map(m =>
                                                                        m.id === message.id ? { ...m, saved: true } : m
                                                                    ));
                                                                }
                                                            } catch (error) {
                                                                console.error('Error saving image:', error);
                                                            }
                                                        }}
                                                        className="text-xs px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition"
                                                    >
                                                        Save
                                                    </button>
                                                ) : message.saved ? (
                                                    <span className="text-xs opacity-75">
                                                        ✓ Saved
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                    {message.videoUrl && (
                                        <div className="mt-3">
                                            <video
                                                src={message.videoUrl}
                                                controls
                                                className="rounded-lg max-w-md"
                                                style={{ maxHeight: '400px' }}
                                                preload="metadata"
                                            >
                                                Your browser does not support video playback.
                                            </video>
                                            <div className="mt-2 flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs opacity-75">
                                                        🎬 AI-generated video
                                                    </span>
                                                </div>
                                                {message.videoId && !message.saved ? (
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const response = await fetch(`/api/images/${message.videoId}/save`, {
                                                                    method: 'POST',
                                                                });
                                                                const data = await response.json();
                                                                if (data.success) {
                                                                    setMessages(prev => prev.map(m =>
                                                                        m.id === message.id ? { ...m, saved: true } : m
                                                                    ));
                                                                }
                                                            } catch (error) {
                                                                console.error('Error saving video:', error);
                                                            }
                                                        }}
                                                        className="text-xs px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition"
                                                    >
                                                        Save
                                                    </button>
                                                ) : message.saved ? (
                                                    <span className="text-xs opacity-75">
                                                        ✓ Saved
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-100" />
                                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-200" />
                                    {mode === 'video' && loadingProgress > 0 && (
                                        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
                                            {loadingProgress}s elapsed... (11s-6min expected)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input area */}
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
                    {/* Mode selector */}
                    <div className="flex items-center space-x-4 mb-4">
                        <button
                            onClick={() => setMode('create')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'create'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Create
                        </button>
                        <button
                            onClick={() => {
                                setMode('edit');
                                if (!selectedImage) {
                                    fileInputRef.current?.click();
                                }
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'edit'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Edit selected
                        </button>
                        <button
                            onClick={() => setMode('video')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'video'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            🎬 Video
                        </button>
                        {selectedImage && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Image selected ✓
                            </span>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Model selector - only visible in create mode */}
                    {mode === 'create' && (
                        <div className="flex gap-6 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="imagen4"
                                    checked={selectedModel === 'imagen4'}
                                    onChange={(e) => setSelectedModel(e.target.value as 'imagen4')}
                                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Imagen 4 <span className="text-xs text-gray-500">(Standard)</span>
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="nano-banana"
                                    checked={selectedModel === 'nano-banana'}
                                    onChange={(e) => setSelectedModel(e.target.value as 'nano-banana')}
                                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    Nano Banana
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Video mode settings - only visible in video mode */}
                    {mode === 'video' && (
                        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
                            {/* Compact Mode Selector with Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="standard"
                                            checked={videoGenerationMode === 'standard'}
                                            onChange={(e) => setVideoGenerationMode(e.target.value as 'standard')}
                                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            Standard
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="reference"
                                            checked={videoGenerationMode === 'reference'}
                                            onChange={(e) => setVideoGenerationMode(e.target.value as 'reference')}
                                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            Reference (R2V)
                                        </span>
                                    </label>
                                </div>
                                <button
                                    onClick={() => setShowVideoOptions(!showVideoOptions)}
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {showVideoOptions ? '▼ Hide Options' : '▶ Show Options'}
                                </button>
                            </div>

                            {/* Collapsible Options Panel */}
                            {showVideoOptions && (
                                <>
                                    {/* Standard Mode Options */}
                                    {videoGenerationMode === 'standard' && (
                                        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                            {/* First Frame */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    First Frame (Optional)
                                                </label>
                                                {firstFrameUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <img src={firstFrameUrl} alt="First frame" className="w-20 h-20 object-cover rounded" />
                                                        <button
                                                            onClick={() => {
                                                                setFirstFrameId(null);
                                                                setFirstFrameUrl(null);
                                                            }}
                                                            className="text-xs px-2 py-1 bg-red-500/20 text-red-600 rounded hover:bg-red-500/30"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Click "First Frame" on any image above
                                                    </p>
                                                )}
                                            </div>

                                            {/* Last Frame */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Last Frame (Optional)
                                                </label>
                                                {lastFrameUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <img src={lastFrameUrl} alt="Last frame" className="w-20 h-20 object-cover rounded" />
                                                        <button
                                                            onClick={() => {
                                                                setLastFrameId(null);
                                                                setLastFrameUrl(null);
                                                            }}
                                                            className="text-xs px-2 py-1 bg-red-500/20 text-red-600 rounded hover:bg-red-500/30"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Click "Last Frame" on any image above
                                                    </p>
                                                )}
                                            </div>

                                            {/* Duration */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Duration: {videoDuration}s
                                                </label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="8"
                                                    value={videoDuration}
                                                    onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                                                    className="w-full"
                                                />
                                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                                    <span>1s</span>
                                                    <span>8s</span>
                                                </div>
                                            </div>

                                            {/* Resolution */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Resolution
                                                </label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            value="720p"
                                                            checked={videoResolution === '720p'}
                                                            onChange={(e) => setVideoResolution(e.target.value as '720p')}
                                                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">720p</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            value="1080p"
                                                            checked={videoResolution === '1080p'}
                                                            onChange={(e) => setVideoResolution(e.target.value as '1080p')}
                                                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">1080p</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Audio */}
                                            <div>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={generateAudio}
                                                        onChange={(e) => setGenerateAudio(e.target.checked)}
                                                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600 rounded"
                                                    />
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        Generate Audio
                                                    </span>
                                                </label>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                                    Context-aware audio synthesis
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Reference Mode Options */}
                                    {videoGenerationMode === 'reference' && (
                                        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                            {/* Reference Images */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Reference Images ({referenceImageUrls.length}/3) {referenceImageUrls.length === 0 && <span className="text-red-600">*Required</span>}
                                                </label>
                                                {referenceImageUrls.length > 0 ? (
                                                    <div className="flex gap-2 flex-wrap">
                                                        {referenceImageUrls.map((url, index) => (
                                                            <div key={index} className="relative">
                                                                <img src={url} alt={`Reference ${index + 1}`} className="w-16 h-16 object-cover rounded" />
                                                                <button
                                                                    onClick={() => {
                                                                        setReferenceImageIds(prev => prev.filter((_, i) => i !== index));
                                                                        setReferenceImageUrls(prev => prev.filter((_, i) => i !== index));
                                                                    }}
                                                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        Click "+ Reference" on images above for subject consistency
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                                                <p className="text-xs text-blue-800 dark:text-blue-300">
                                                    <strong>ⓘ R2V Mode Constraints:</strong><br />
                                                    • Duration locked to 8 seconds<br />
                                                    • Aspect ratio locked to 16:9<br />
                                                    • Last frame is ignored in this mode<br />
                                                    • Requires 1-3 reference images
                                                </p>
                                            </div>

                                            {/* Resolution */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Resolution
                                                </label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            value="720p"
                                                            checked={videoResolution === '720p'}
                                                            onChange={(e) => setVideoResolution(e.target.value as '720p')}
                                                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">720p</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            value="1080p"
                                                            checked={videoResolution === '1080p'}
                                                            onChange={(e) => setVideoResolution(e.target.value as '1080p')}
                                                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">1080p</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Audio */}
                                            <div>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={generateAudio}
                                                        onChange={(e) => setGenerateAudio(e.target.checked)}
                                                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600 rounded"
                                                    />
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        Generate Audio
                                                    </span>
                                                </label>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                                    Context-aware audio synthesis
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Input form */}
                    <form onSubmit={handleSubmit} className="flex space-x-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Describe what to create or how to change the selected image…"
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-gray-700 dark:text-white"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

