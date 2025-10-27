#!/usr/bin/env python3
"""
Simple script to test Google's Gemini 2.5 Flash Image generation API.
Generates images from a text prompt and saves them to disk.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from PIL import Image
from io import BytesIO

def main():
    # Load environment variables from .env file
    load_dotenv()
    
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in .env file")
    
    # Initialize the client
    print("🚀 Initializing Gemini 2.5 Flash Image client...")
    client = genai.Client(api_key=api_key)
    
    # Define the prompt
    prompt = "A park in the spring next to a lake, the sun sets across the lake, golden hour, red wildflowers."
    print(f"\n📝 Prompt: {prompt}")
    
    # Generate image
    print("\n🎨 Generating image with Gemini 2.5 Flash Image...")
    response = client.models.generate_content(
        model='gemini-2.5-flash-image-preview',
        contents=[prompt],
    )
    
    # Create output directory if it doesn't exist
    output_dir = Path("output_images")
    output_dir.mkdir(exist_ok=True)
    
    # Save generated images
    print(f"\n💾 Saving images to {output_dir}/")
    image_count = 0
    
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            image_count += 1
            filename = output_dir / f"gemini_flash_image_test_{image_count}.png"
            
            # Get the image bytes and save
            image = Image.open(BytesIO(part.inline_data.data))
            image.save(filename)
            
            print(f"   ✅ Saved: {filename}")
    
    if image_count == 0:
        print("   ⚠️  No images were generated in the response.")
    
    print("\n✨ Done! Check the output_images/ directory for your generated images.")

if __name__ == "__main__":
    main()

