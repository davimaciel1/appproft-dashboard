const fs = require('fs');
const path = require('path');

// Create a simple SVG placeholder image
const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#f3f4f6"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">
    Sem Imagem
  </text>
  <path d="M80 70 L120 70 L120 90 L140 90 L100 120 L60 90 L80 90 Z" fill="#d1d5db"/>
</svg>`;

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'client', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write SVG file
fs.writeFileSync(path.join(publicDir, 'placeholder.svg'), svgContent);

// Create a PNG version using data URL
const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

console.log('✅ Placeholder image created at client/public/placeholder.svg');
console.log('You can also use this data URL for a simple 1x1 transparent PNG:');
console.log(pngDataUrl);