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
    originalImageId?: string; // For undo functionality
    saved?: boolean; // Track if already saved
    timestamp: Date;
};

export default function ChatPage() {
    const searchParams = useSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [selectedModel, setSelectedModel] = useState<'imagen4' | 'nano-banana'>('imagen4');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadedImageRef = useRef<string | null>(null);

    // Handle image from gallery
    useEffect(() => {
        const imageId = searchParams.get('imageId');
        if (imageId && loadedImageRef.current !== imageId) {
            loadedImageRef.current = imageId;

            // Fetch the image details to get the path
            fetch('/api/gallery')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        const asset = data.assets.find((a: any) => a.id === imageId);
                        if (asset) {
                            setSelectedImage(imageId);
                            const imageUrl = `/api/media/${asset.path}`;
                            setSelectedImageUrl(imageUrl);
                            setMode('edit');

                            // Add as a message in chat for better UX
                            setMessages(prev => [...prev, {
                                id: Date.now().toString(),
                                role: 'assistant',
                                content: 'Image loaded from gallery. What would you like me to do with it?',
                                imageUrl,
                                imageId: asset.id,
                                saved: true, // Gallery images are already saved
                                timestamp: new Date(),
                            }]);
                        }
                    }
                })
                .catch(err => console.error('Error fetching image:', err));
        }
    }, [searchParams]);

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

        try {
            let response;
            if (mode === 'create') {
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
                    content: data.error || data.message || 'Failed to process image',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMessage]);
                return;
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.message || 'Image processed successfully!',
                imageUrl: data.imageUrl,
                imageId: data.imageId,
                originalImageId: data.originalImageId || undefined, // For undo
                saved: false, // Not saved yet
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Update selected image to the newly created/edited one for chaining edits
            if (data.imageId && data.imageUrl) {
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
                                Powered by Nano Banana 🍌 (Gemini 2.5 Flash Image)
                            </p>
                        </div>
                        <Link
                            href="/gallery"
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Gallery
                        </Link>
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
                                                className="rounded-lg max-w-md cursor-pointer hover:opacity-90 transition"
                                                onClick={() => window.open(message.imageUrl, '_blank')}
                                                title="Click to view full size"
                                            />
                                            <div className="mt-2 flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs opacity-75">
                                                        ✨ AI-generated
                                                    </span>
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
                                    Nano Banana <span className="text-xs text-gray-500">(Gemini)</span>
                                </span>
                            </label>
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

