# Extension Icons Setup

The extension currently loads without icons to avoid errors. To add proper icons:

## Quick Fix (Optional)

The extension works perfectly without icons, but if you want to add them:

1. **Create or download 4 PNG icon files:**
   - `icons/icon16.png` (16x16 pixels)
   - `icons/icon32.png` (32x32 pixels) 
   - `icons/icon48.png` (48x48 pixels)
   - `icons/icon128.png` (128x128 pixels)

2. **Add icons back to manifest.json:**

Replace the action section with:
```json
"action": {
  "default_popup": "popup.html",
  "default_title": "AI Sales Agent",
  "default_icon": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png", 
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
},

"icons": {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png", 
  "128": "icons/icon128.png"
},
```

## Icon Design Suggestions

- Use a shopping/AI theme (shopping cart, brain, analysis symbols)
- Keep it simple and recognizable at small sizes
- Use the brand colors: #667eea (blue) to #764ba2 (purple) gradient
- Ensure good contrast on both light and dark Chrome themes

## Free Icon Resources

- **Flaticon.com** - Free icons with attribution
- **Heroicons.com** - Simple, clean SVG icons
- **Feathericons.com** - Minimalist icon set
- **Icons8.com** - Large collection of free icons

The extension is fully functional without icons - they're just for visual polish! 