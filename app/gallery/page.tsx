'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type MediaAsset = {
    id: string;
    path: string;
    kind: string;
    provider: string;
    bytes: number | null;
    width: number | null;
    height: number | null;
    saved: boolean;
    createdAt: string;
    metadata: string | null;
    actions: Array<{
        action: string;
        detail: string | null;
        createdAt: string;
    }>;
};

export default function GalleryPage() {
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
    const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set()); // Multi-select state
    const [isLoading, setIsLoading] = useState(true);
    const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');

    useEffect(() => {
        loadGallery();
    }, []);

    const loadGallery = async () => {
        try {
            const response = await fetch('/api/gallery');
            const data = await response.json();
            if (data.success) {
                setAssets(data.assets);
            }
        } catch (error) {
            console.error('Error loading gallery:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getImageUrl = (path: string) => {
        return `/api/media/${path}`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Gallery
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Your saved creations
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Link
                            href="/usage"
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
                        >
                            Usage
                        </Link>
                        <Link
                            href="/"
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            ← Back to Chat
                        </Link>
                        <button
                            onClick={async () => {
                                await fetch('/api/auth/logout', { method: 'POST' });
                                window.location.href = '/login';
                            }}
                            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
                            title="Sign out"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Gallery grid */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Media filter tabs and multi-select controls */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMediaFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mediaFilter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            All ({assets.length})
                        </button>
                        <button
                            onClick={() => setMediaFilter('image')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mediaFilter === 'image'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Images ({assets.filter(a => a.kind === 'image').length})
                        </button>
                        <button
                            onClick={() => setMediaFilter('video')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mediaFilter === 'video'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Videos ({assets.filter(a => a.kind === 'video').length})
                        </button>
                    </div>

                    {/* Multi-select controls */}
                    <div className="flex items-center gap-3">
                        {selectedAssets.size > 0 && (
                            <>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {selectedAssets.size} selected
                                </span>
                                <button
                                    onClick={() => setSelectedAssets(new Set())}
                                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                >
                                    Clear
                                </button>
                                <Link
                                    href={`/?imageIds=${Array.from(selectedAssets).join(',')}`}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    Send {selectedAssets.size} to Chat →
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
                    </div>
                ) : assets.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                            <p className="text-lg mb-2">No media yet</p>
                            <p className="text-sm">
                                Create or save images/videos from the chat to see them here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {assets.filter(asset =>
                            mediaFilter === 'all' || asset.kind === mediaFilter
                        ).map((asset) => {
                            const isSelected = selectedAssets.has(asset.id);
                            return (
                                <div
                                    key={asset.id}
                                    className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition border border-gray-200 dark:border-gray-700 relative"
                                >
                                    {/* Selection checkbox overlay */}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newSelected = new Set(selectedAssets);
                                            if (isSelected) {
                                                newSelected.delete(asset.id);
                                            } else {
                                                newSelected.add(asset.id);
                                            }
                                            setSelectedAssets(newSelected);
                                        }}
                                        className="absolute top-2 left-2 z-10 cursor-pointer"
                                    >
                                        <div className={`w-6 h-6 rounded flex items-center justify-center transition ${isSelected
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white/90 dark:bg-gray-800/90 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-600'
                                            }`}>
                                            {isSelected && <span className="text-sm">✓</span>}
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setSelectedAsset(asset)}
                                        className="cursor-pointer"
                                    >
                                        <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                                            {asset.kind === 'video' ? (
                                                <>
                                                    <video
                                                        src={getImageUrl(asset.path)}
                                                        className="w-full h-full object-cover"
                                                        preload="metadata"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
                                                            <div className="w-0 h-0 border-l-8 border-l-white border-y-6 border-y-transparent ml-1"></div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <img
                                                    src={getImageUrl(asset.path)}
                                                    alt="Gallery item"
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                            {asset.provider === 'google-veo-3.1' && (
                                                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                                    🎬 VIDEO
                                                </div>
                                            )}
                                            {(asset.provider === 'gemini-nano-banana' || asset.provider === 'google-imagen4') && (
                                                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                                    ✨ AI
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatDate(asset.createdAt)}
                                            </p>
                                            {asset.actions[0] && (
                                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                                    {asset.actions[0].action}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Detail modal */}
            {selectedAsset && (
                <div
                    className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50"
                    onClick={() => setSelectedAsset(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {selectedAsset.kind === 'video' ? 'Video' : 'Image'} Details
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        Created {formatDate(selectedAsset.createdAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedAsset(null)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="mb-4">
                                {selectedAsset.kind === 'video' ? (
                                    <video
                                        src={getImageUrl(selectedAsset.path)}
                                        controls
                                        className="w-full rounded-lg"
                                        preload="metadata"
                                    >
                                        Your browser does not support video playback.
                                    </video>
                                ) : (
                                    <img
                                        src={getImageUrl(selectedAsset.path)}
                                        alt="Selected"
                                        className="w-full rounded-lg"
                                    />
                                )}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Metadata
                                    </h3>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        <p>Size: {selectedAsset.bytes} bytes</p>
                                        {selectedAsset.kind === 'video' && selectedAsset.metadata && (() => {
                                            try {
                                                const metadata = JSON.parse(selectedAsset.metadata);
                                                return (
                                                    <>
                                                        <p>Duration: {metadata.duration || 8}s</p>
                                                        <p>Resolution: {metadata.resolution || '720p'}</p>
                                                        <p>FPS: {metadata.fps || 24}</p>
                                                        <p>Audio: {metadata.hasAudio ? 'Yes' : 'No'}</p>
                                                    </>
                                                );
                                            } catch {
                                                return null;
                                            }
                                        })()}
                                        {selectedAsset.kind === 'image' && selectedAsset.width && selectedAsset.height && (
                                            <p>
                                                Dimensions: {selectedAsset.width} × {selectedAsset.height}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {selectedAsset.actions.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                            Recent Actions
                                        </h3>
                                        <div className="mt-1 space-y-2">
                                            {selectedAsset.actions.map((action, idx) => (
                                                <div
                                                    key={idx}
                                                    className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded"
                                                >
                                                    <span className="font-medium">{action.action}</span>
                                                    {action.detail && (
                                                        <span className="ml-2">
                                                            {JSON.parse(action.detail).prompt ||
                                                                JSON.parse(action.detail).instruction ||
                                                                JSON.parse(action.detail).filename}
                                                        </span>
                                                    )}
                                                    <span className="block text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                        {formatDate(action.createdAt)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 space-y-3">
                                <div className="flex space-x-3">
                                    {selectedAsset.kind === 'image' && (
                                        <Link
                                            href={`/?imageId=${selectedAsset.id}`}
                                            className="flex-1 px-4 py-2 text-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                        >
                                            Send to Chat
                                        </Link>
                                    )}
                                    <button
                                        onClick={() => {
                                            window.open(getImageUrl(selectedAsset.path), '_blank');
                                        }}
                                        className={`px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition ${selectedAsset.kind === 'image' ? '' : 'flex-1'
                                            }`}
                                    >
                                        Open Full Size
                                    </button>
                                </div>
                                <button
                                    onClick={async () => {
                                        try {
                                            // Fetch the image as blob
                                            const response = await fetch(getImageUrl(selectedAsset.path));
                                            const blob = await response.blob();

                                            // Create download link
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = selectedAsset.path.split('/').pop() || 'image.png';
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            window.URL.revokeObjectURL(url);
                                        } catch (error) {
                                            console.error('Error downloading image:', error);
                                            alert('Failed to download image');
                                        }
                                    }}
                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                >
                                    ⬇️ Download {selectedAsset.kind === 'video' ? 'Video' : 'Image'}
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Are you sure you want to delete this ${selectedAsset.kind}? This cannot be undone.`)) {
                                            return;
                                        }

                                        try {
                                            const response = await fetch(`/api/images/${selectedAsset.id}/delete`, {
                                                method: 'DELETE',
                                            });

                                            if (response.ok) {
                                                // Remove from local state
                                                setAssets(prev => prev.filter(a => a.id !== selectedAsset.id));
                                                // Close modal
                                                setSelectedAsset(null);
                                            } else {
                                                alert('Failed to delete image');
                                            }
                                        } catch (error) {
                                            console.error(`Error deleting ${selectedAsset.kind}:`, error);
                                            alert(`Failed to delete ${selectedAsset.kind}`);
                                        }
                                    }}
                                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                >
                                    🗑️ Delete {selectedAsset.kind === 'video' ? 'Video' : 'Image'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

