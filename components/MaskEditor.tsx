'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface MaskEditorProps {
    imageUrl: string;
    initialMaskBase64: string;
    onApply: (editedMaskBase64: string, previewUrl: string) => void;
    onCancel: () => void;
}

export function MaskEditor({ imageUrl, initialMaskBase64, onApply, onCancel }: MaskEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<'brush' | 'eraser'>('eraser');
    const [brushSize, setBrushSize] = useState(40);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(true);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const maskImageRef = useRef<HTMLImageElement | null>(null);

    // Load image and mask
    useEffect(() => {
        const loadImages = async () => {
            try {
                setIsLoading(true);

                // Load original image
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = (e) => {
                        console.error('Failed to load image:', e);
                        reject(new Error('Failed to load image'));
                    };
                    img.src = imageUrl;
                });
                imageRef.current = img;

                // Load mask image
                const maskImg = new Image();
                await new Promise<void>((resolve, reject) => {
                    maskImg.onload = () => resolve();
                    maskImg.onerror = (e) => {
                        console.error('Failed to load mask:', e);
                        reject(new Error('Failed to load mask'));
                    };
                    maskImg.src = `data:image/png;base64,${initialMaskBase64}`;
                });
                maskImageRef.current = maskImg;

                // Set up canvases (small delay to ensure refs are attached)
                await new Promise(resolve => setTimeout(resolve, 10));
                
                const canvas = canvasRef.current;
                const imageCanvas = imageCanvasRef.current;
                if (!canvas || !imageCanvas) {
                    throw new Error('Canvas elements not available. Please try again.');
                }

                // Size canvases to image dimensions (max 1024px)
                const maxDim = 1024;
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    const scale = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                canvas.width = width;
                canvas.height = height;
                imageCanvas.width = width;
                imageCanvas.height = height;

                // Draw original image on background canvas
                const imageCtx = imageCanvas.getContext('2d');
                if (imageCtx) {
                    imageCtx.drawImage(img, 0, 0, width, height);
                }

                // Draw mask on editing canvas
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(maskImg, 0, 0, width, height);

                    // Save initial state to history
                    const initialState = ctx.getImageData(0, 0, width, height);
                    setHistory([initialState]);
                    setHistoryIndex(0);
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Error loading mask editor:', error);
                setIsLoading(false);
                alert('Failed to load mask editor. Please try again or check the browser console for errors.');
                onCancel();
            }
        };

        loadImages();
    }, [imageUrl, initialMaskBase64, onCancel]);

    // Save current state to history
    const saveToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Remove any future history if we're not at the end
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(imageData);

        // Limit history to 20 states
        if (newHistory.length > 20) {
            newHistory.shift();
            setHistoryIndex(newHistory.length - 1);
        } else {
            setHistoryIndex(newHistory.length - 1);
        }

        setHistory(newHistory);
    }, [history, historyIndex]);

    // Undo
    const handleUndo = useCallback(() => {
        if (historyIndex <= 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const newIndex = historyIndex - 1;
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
    }, [history, historyIndex]);

    // Redo
    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const newIndex = historyIndex + 1;
        ctx.putImageData(history[newIndex], 0, 0);
        setHistoryIndex(newIndex);
    }, [history, historyIndex]);

    // Reset to original mask
    const handleReset = useCallback(() => {
        if (history.length === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.putImageData(history[0], 0, 0);
        setHistoryIndex(0);
        setHistory([history[0]]);
    }, [history]);

    // Clear all (make all black or all white)
    const handleClear = useCallback((color: 'black' | 'white') => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveToHistory();
    }, [saveToHistory]);

    // Get canvas coordinates from mouse event
    const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    // Draw on canvas
    const draw = useCallback((x: number, y: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = tool === 'brush' ? 'black' : 'white';
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }, [tool, brushSize]);

    // Mouse handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);
        if (!coords) return;

        setIsDrawing(true);
        draw(coords.x, coords.y);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coords = getCanvasCoords(e);
        if (!coords) return;

        setCursorPos(coords);

        if (isDrawing) {
            draw(coords.x, coords.y);
        }
    };

    const handleMouseUp = () => {
        if (isDrawing) {
            setIsDrawing(false);
            saveToHistory();
        }
    };

    const handleMouseLeave = () => {
        setCursorPos(null);
        if (isDrawing) {
            setIsDrawing(false);
            saveToHistory();
        }
    };

    // Export mask
    const handleApply = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        onApply(base64, dataUrl);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'b' || e.key === 'B') {
                setTool('brush');
            } else if (e.key === 'e' || e.key === 'E') {
                setTool('eraser');
            } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if (e.key === 'Escape') {
                onCancel();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleUndo, handleRedo, onCancel]);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">✏️ Edit Mask</h2>
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

                {/* Toolbar */}
                <div className="p-4 border-b border-gray-700 space-y-4">
                    {/* Tool Selection */}
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-300">Tool:</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTool('brush')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${tool === 'brush'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                🖌️ Brush (B)
                            </button>
                            <button
                                onClick={() => setTool('eraser')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${tool === 'eraser'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                🧹 Eraser (E)
                            </button>
                        </div>
                    </div>

                    {/* Brush Size */}
                    <div className="flex items-center gap-4">
                        <label htmlFor="brushSize" className="text-sm font-medium text-gray-300 min-w-[80px]">
                            Size: {brushSize}px
                        </label>
                        <input
                            id="brushSize"
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="flex-1 max-w-xs"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                        >
                            ↶ Undo
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                        >
                            ↷ Redo
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                        >
                            🔄 Reset
                        </button>
                        <button
                            onClick={() => handleClear('black')}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                        >
                            All Black
                        </button>
                        <button
                            onClick={() => handleClear('white')}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                        >
                            All White
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="p-4">
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-gray-400">Loading...</div>
                        </div>
                    )}
                    
                    {/* Canvas - Always rendered so refs are available, but hidden during loading */}
                    <div className={`relative inline-block ${isLoading ? 'hidden' : ''}`}>
                        {/* Background: Original Image */}
                        <canvas
                            ref={imageCanvasRef}
                            className="absolute top-0 left-0"
                            style={{ cursor: 'none' }}
                        />
                        {/* Foreground: Editable Mask with red tint overlay */}
                        <canvas
                            ref={canvasRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                            className="relative"
                            style={{
                                cursor: 'none',
                                mixBlendMode: 'multiply',
                                backgroundColor: 'rgba(255, 0, 0, 0.3)'
                            }}
                        />
                        {/* Cursor Preview */}
                        {cursorPos && (
                            <div
                                className="absolute pointer-events-none border-2 rounded-full"
                                style={{
                                    left: cursorPos.x - brushSize / 2,
                                    top: cursorPos.y - brushSize / 2,
                                    width: brushSize,
                                    height: brushSize,
                                    borderColor: tool === 'brush' ? '#000' : '#fff',
                                    transform: 'translate(0, 0)'
                                }}
                            />
                        )}
                    </div>

                    {/* Instructions */}
                    <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500 rounded-lg text-sm text-blue-300">
                        <strong>Instructions:</strong> Use the <strong>Brush</strong> to add areas to the mask (will be edited).
                        Use the <strong>Eraser</strong> to remove areas from the mask (will be preserved).
                        Black areas = edit, White areas = preserve.
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                        Apply Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
