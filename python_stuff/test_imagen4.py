#!/usr/bin/env python3
"""
Simple script to test Google's Imagen 4 image generation API.
Generates images from a text prompt and saves them to disk.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

def main():
    # Load environment variables from .env file
    load_dotenv()
    
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in .env file")
    
    # Initialize the client
    print("🚀 Initializing Imagen 4 client...")
    client = genai.Client(api_key=api_key)
    
    # Define the prompt
    prompt = "A park in the spring next to a lake, the sun sets across the lake, golden hour, red wildflowers."
    print(f"\n📝 Prompt: {prompt}")
    
    # Generate images
    print("\n🎨 Generating images with Imagen 4...")
    response = client.models.generate_images(
        model='imagen-4.0-generate-001',
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=4,
            aspect_ratio="1:1",
            person_generation="allow_adult"
        )
    )
    
    # Create output directory if it doesn't exist
    output_dir = Path("output_images")
    output_dir.mkdir(exist_ok=True)
    
    # Save generated images
    print(f"\n💾 Saving images to {output_dir}/")
    for idx, generated_image in enumerate(response.generated_images, 1):
        filename = output_dir / f"imagen4_test_{idx}.png"
        
        # Get the image bytes and save
        image_bytes = generated_image.image.image_bytes
        with open(filename, 'wb') as f:
            f.write(image_bytes)
        
        print(f"   ✅ Saved: {filename}")
    
    print("\n✨ Done! Check the output_images/ directory for your generated images.")

if __name__ == "__main__":
    main()

