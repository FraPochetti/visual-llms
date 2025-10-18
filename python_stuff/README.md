# Python Test Scripts for Gemini API

Simple standalone Python scripts to test Google's Gemini API models.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements-python.txt
   ```

2. **Set up your API key:**
   - Make sure you have a `.env` file in the project root or this directory
   - Add your API key: `GEMINI_API_KEY=your_actual_key_here`
   - Get your key at: https://aistudio.google.com/app/apikey

## Test Scripts

### 🎨 Imagen 4 - Image Generation

Generate high-fidelity images with Imagen 4 Ultra.

```bash
python test_imagen4.py
```

**What it does:**
- Generates 4 images from a text prompt
- Resolution: 2K (2048×2048)
- Saves to `output_images/` directory
- Uses model: `imagen-4.0-generate-001`

**Example prompt:**
> "A park in the spring next to a lake, the sun sets across the lake, golden hour, red wildflowers."

**Cost:** ~$0.24 (4 images × $0.06/image)

---

### 🎬 Veo 3.1 - Video Generation

Generate realistic videos with natively generated audio.

```bash
python test_veo3.py
```

**What it does:**
- Generates an 8-second video from a text prompt
- Resolution: 720p or 1080p
- **Includes natively generated audio!**
- Saves to `output_videos/` directory
- Uses model: `veo-3.1-generate-preview`

**Example prompt:**
> "A serene park in spring next to a lake during golden hour. The sun sets across the water, casting warm light on red wildflowers swaying in the breeze. Camera pans slowly across the peaceful scene."

**Processing time:** 11 seconds to 6 minutes (depending on server load)

**Features:**
- Text-to-video generation
- Cinematic camera movements
- Realistic physics and lighting
- SynthID watermarking for verification
- Native audio synthesis

**Documentation:** https://ai.google.dev/gemini-api/docs/video

---

## Output

- **Images:** `output_images/imagen4_test_1.png`, `imagen4_test_2.png`, etc.
- **Videos:** `output_videos/veo3_test.mp4`

## Troubleshooting

**API key not found:**
- Verify `.env` file exists in project root or this directory
- Check that it contains `GEMINI_API_KEY=your_key` (no quotes)

**Import errors:**
- Run `pip install -r requirements-python.txt`
- Make sure you're using Python 3.8+

**Video generation takes too long:**
- Processing can take up to 6 minutes during peak hours
- The script will poll every 10 seconds and show progress
- Be patient - video generation is computationally intensive!

## Models Used

| Model | Type | Resolution | Audio | Purpose |
|-------|------|-----------|-------|---------|
| Imagen 4 Ultra | Image | 2K (2048×2048) | N/A | High-fidelity photorealistic images |
| Veo 3.1 | Video | 720p/1080p | ✅ Yes | Cinematic video generation with sound |

## Resources

- **Gemini API Docs:** https://ai.google.dev/docs
- **Veo 3.1 Documentation:** https://ai.google.dev/gemini-api/docs/video
- **Google AI Studio:** https://aistudio.google.com/
- **Pricing:** https://ai.google.dev/gemini-api/docs/pricing

