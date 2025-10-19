import { NextRequest, NextResponse } from 'next/server';
import { getSessionId } from '@/lib/session';
import { readMediaFile } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const sessionId = await getSessionId();
        const { path } = await params;

        if (!sessionId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Reconstruct the relative path
        const relativePath = path.join('/');

        // Verify the file belongs to this session
        const asset = await prisma.mediaAsset.findFirst({
            where: {
                path: relativePath,
                owner: sessionId,
            },
        });

        if (!asset) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Read and serve the file
        const fileBuffer = await readMediaFile(relativePath);

        // Determine content type based on file extension
        const ext = relativePath.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'mp4') contentType = 'video/mp4';
        else if (ext === 'webm') contentType = 'video/webm';

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        };

        // Add Accept-Ranges header for video streaming
        if (contentType.startsWith('video/')) {
            headers['Accept-Ranges'] = 'bytes';
        }

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers,
        });
    } catch (error) {
        console.error('Error serving media file:', error);
        return NextResponse.json(
            { error: 'Failed to serve file' },
            { status: 500 }
        );
    }
}

