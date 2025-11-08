#!/usr/bin/env node

/**
 * Recover a completed Replicate video prediction that wasn't processed by webhook
 * 
 * Usage: node scripts/recover-video.js <prediction_id>
 * Example: node scripts/recover-video.js 8e055e81-ab4b-45a9-a0f1-a5a642c7bb5a
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function recoverVideo(predictionDbId) {
    try {
        console.log(`\n🔍 Looking up prediction: ${predictionDbId}`);
        
        // Find the prediction in our database
        const prediction = await prisma.prediction.findUnique({
            where: { id: predictionDbId }
        });

        if (!prediction) {
            console.error(`❌ Prediction not found in database: ${predictionDbId}`);
            process.exit(1);
        }

        console.log(`✅ Found prediction:`);
        console.log(`   Replicate ID: ${prediction.predictionId}`);
        console.log(`   Status: ${prediction.status}`);
        console.log(`   Owner: ${prediction.owner}`);
        console.log(`   Prompt: ${prediction.prompt.substring(0, 100)}...`);

        if (prediction.status === 'succeeded' && prediction.assetId) {
            console.log(`✅ This prediction already has a video saved (assetId: ${prediction.assetId})`);
            process.exit(0);
        }

        // Query Replicate API for the prediction
        const replicateApiKey = process.env.REPLICATE_API_KEY;
        if (!replicateApiKey) {
            console.error('❌ REPLICATE_API_KEY not found in environment');
            process.exit(1);
        }

        console.log(`\n🌐 Fetching prediction from Replicate API...`);
        const response = await fetch(
            `https://api.replicate.com/v1/predictions/${prediction.predictionId}`,
            {
                headers: {
                    'Authorization': `Bearer ${replicateApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error(`❌ Failed to fetch from Replicate: ${response.status} ${response.statusText}`);
            process.exit(1);
        }

        const replicateData = await response.json();
        console.log(`✅ Replicate status: ${replicateData.status}`);

        if (replicateData.status !== 'succeeded') {
            console.error(`❌ Video is not ready yet. Status: ${replicateData.status}`);
            if (replicateData.error) {
                console.error(`   Error: ${replicateData.error}`);
            }
            process.exit(1);
        }

        // Extract video URL
        let videoUrl = null;
        if (Array.isArray(replicateData.output)) {
            videoUrl = replicateData.output[0];
        } else if (typeof replicateData.output === 'string') {
            videoUrl = replicateData.output;
        }

        if (!videoUrl) {
            console.error(`❌ No video URL found in output`);
            process.exit(1);
        }

        console.log(`\n⬇️  Downloading video from: ${videoUrl}`);

        // Download the video
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            console.error(`❌ Failed to download video: ${videoResponse.statusText}`);
            process.exit(1);
        }

        const arrayBuffer = await videoResponse.arrayBuffer();
        const videoBuffer = Buffer.from(arrayBuffer);
        console.log(`✅ Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Save video to storage
        const timestamp = Date.now();
        const filename = `${timestamp}-video_${timestamp - 5}.mp4`;
        const mediaDir = path.join('/var/visualneurons/media', prediction.owner);
        
        await fs.mkdir(mediaDir, { recursive: true });
        
        const relativePath = `${prediction.owner}/${filename}`;
        const absolutePath = `/var/visualneurons/media/${relativePath}`;
        
        await fs.writeFile(absolutePath, videoBuffer);
        console.log(`✅ Saved to: ${relativePath}`);

        // Parse metadata
        const metadata = prediction.metadata ? JSON.parse(prediction.metadata) : {};

        // Create media asset
        const mediaAsset = await prisma.mediaAsset.create({
            data: {
                owner: prediction.owner,
                kind: 'video',
                provider: 'google-veo-3.1',
                path: relativePath,
                bytes: videoBuffer.length,
                metadata: JSON.stringify({
                    ...metadata,
                    prompt: prediction.prompt,
                    model: 'google/veo-3.1',
                    generatedAt: new Date().toISOString(),
                    duration: 8,
                    resolution: metadata.resolution || '1080p',
                    fps: 24,
                    hasAudio: metadata.generateAudio !== false,
                    recoveredManually: true,
                }),
                saved: true,
            },
        });

        console.log(`✅ Created media asset: ${mediaAsset.id}`);

        // Log the action
        await prisma.action.create({
            data: {
                userId: prediction.owner,
                action: 'create_video',
                assetId: mediaAsset.id,
                detail: JSON.stringify({
                    prompt: prediction.prompt,
                    manualRecovery: true,
                    predictionId: prediction.predictionId,
                }),
            },
        });

        // Update prediction
        await prisma.prediction.update({
            where: { id: predictionDbId },
            data: {
                status: 'succeeded',
                assetId: mediaAsset.id,
                updatedAt: new Date(),
            },
        });

        console.log(`✅ Updated prediction record`);

        console.log(`\n✨ Success! Video recovered and saved to gallery.`);
        console.log(`   Media Asset ID: ${mediaAsset.id}`);
        console.log(`   Path: /api/media/${relativePath}`);

    } catch (error) {
        console.error(`\n❌ Error:`, error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Get prediction ID from command line
const predictionDbId = process.argv[2];

if (!predictionDbId) {
    console.error('Usage: node scripts/recover-video.js <prediction_db_id>');
    console.error('Example: node scripts/recover-video.js 8e055e81-ab4b-45a9-a0f1-a5a642c7bb5a');
    process.exit(1);
}

recoverVideo(predictionDbId);

