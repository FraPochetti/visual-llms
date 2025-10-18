#!/usr/bin/env python3
"""
Simple script to test Google's Veo 3.1 video generation API.
Generates a video from a text prompt and saves it to disk.
"""

import os
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai

def main():
    # Load environment variables from .env file
    load_dotenv()
    
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in .env file")
    
    # Initialize the client
    print("🚀 Initializing Veo 3.1 client...")
    client = genai.Client(api_key=api_key)
    
    # Define the prompt
    prompt = """A serene park in spring next to a lake during golden hour. 
    The sun sets across the water, casting warm light on red wildflowers swaying in the breeze. 
    Camera pans slowly across the peaceful scene."""
    
    print(f"\n📝 Prompt: {prompt}")
    
    # Generate video
    print("\n🎬 Generating video with Veo 3.1...")
    print("   This may take 11 seconds to 6 minutes depending on server load...")
    
    operation = client.models.generate_videos(
        model="veo-3.1-generate-preview",
        prompt=prompt,
    )
    
    # Poll the operation status until the video is ready
    print("\n⏳ Waiting for video generation to complete...")
    while not operation.done:
        print("   Still processing...")
        time.sleep(10)
        operation = client.operations.get(operation)
    
    # Create output directory if it doesn't exist
    output_dir = Path("output_videos")
    output_dir.mkdir(exist_ok=True)
    
    # Download the generated video
    print("\n💾 Downloading generated video...")
    generated_video = operation.response.generated_videos[0]
    client.files.download(file=generated_video.video)
    
    # Save the video
    filename = output_dir / "veo3_test.mp4"
    generated_video.video.save(str(filename))
    
    print(f"   ✅ Saved: {filename}")
    print("\n✨ Done! Check the output_videos/ directory for your generated video.")
    print("   Note: Veo 3.1 generates videos with natively generated audio!")

if __name__ == "__main__":
    main()

