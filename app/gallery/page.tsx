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
    const [isLoading, setIsLoading] = useState(true);

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
                    <Link
                        href="/"
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        ← Back to Chat
                    </Link>
                </div>
            </header>

            {/* Gallery grid */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
                    </div>
                ) : assets.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                            <p className="text-lg mb-2">No images yet</p>
                            <p className="text-sm">
                                Create or save images from the chat to see them here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {assets.map((asset) => (
                            <div
                                key={asset.id}
                                onClick={() => setSelectedAsset(asset)}
                                className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer border border-gray-200 dark:border-gray-700"
                            >
                                <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                                    <img
                                        src={getImageUrl(asset.path)}
                                        alt="Gallery item"
                                        className="w-full h-full object-cover"
                                    />
                                    {asset.provider === 'gemini-nano-banana' && (
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
                        ))}
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
                                        Image Details
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
                                <img
                                    src={getImageUrl(selectedAsset.path)}
                                    alt="Selected"
                                    className="w-full rounded-lg"
                                />
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Metadata
                                    </h3>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        <p>Size: {selectedAsset.bytes} bytes</p>
                                        {selectedAsset.width && selectedAsset.height && (
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
                                    <Link
                                        href={`/?imageId=${selectedAsset.id}`}
                                        className="flex-1 px-4 py-2 text-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                    >
                                        Send to Chat
                                    </Link>
                                    <button
                                        onClick={() => {
                                            window.open(getImageUrl(selectedAsset.path), '_blank');
                                        }}
                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
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
                                    ⬇️ Download Image
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!confirm('Are you sure you want to delete this image? This cannot be undone.')) {
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
                                            console.error('Error deleting image:', error);
                                            alert('Failed to delete image');
                                        }
                                    }}
                                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                >
                                    🗑️ Delete Image
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

