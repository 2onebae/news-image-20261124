import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const WIDTH = 1024;
const HEIGHT = 1024;

// Simple 5x7 font data for uppercase letters, numbers, punctuation
const FONT_5X7: Record<string, number[]> = {
    'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'B': [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    'C': [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    'D': [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
    'E': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    'F': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    'G': [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    'H': [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'I': [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
    'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    'M': [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    'O': [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'P': [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    'Q': [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    'R': [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    'S': [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
    'T': [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    'X': [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    'Y': [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    '0': [0x0e, 0x13, 0x15, 0x19, 0x11, 0x11, 0x0e],
    '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
    '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    '6': [0x0e, 0x10, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
    ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
    '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
    '/': [0x01, 0x02, 0x04, 0x08, 0x10, 0x00, 0x00],
    '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
    ',': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c, 0x02],
    ';': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x02]
};

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
}

function calculateCRC(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return ~c >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    if (len > 0) data.copy(buf, 8);
    const crcVal = calculateCRC(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    buf.writeUInt32BE(crcVal, 8 + len);
    return buf;
}

function encodePNG(width: number, height: number, rgbaPixels: Buffer): Buffer {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;
    ihdrData[9] = 6;
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;
    const ihdrChunk = createChunk('IHDR', ihdrData);

    const rowSize = width * 4;
    const filtered = Buffer.alloc(height * (rowSize + 1));
    for (let y = 0; y < height; y++) {
        filtered[y * (rowSize + 1)] = 0;
        rgbaPixels.copy(filtered, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
    }

    const idatData = deflateSync(filtered, { level: 9 });
    const idatChunk = createChunk('IDAT', idatData);
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const img = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x: number, y: number, r: number, g: number, b: number, a: number = 255) {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
    const idx = (y * WIDTH + x) * 4;
    img[idx] = r;
    img[idx + 1] = g;
    img[idx + 2] = b;
    img[idx + 3] = a;
}

function fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(WIDTH, x + w);
    const y1 = Math.min(HEIGHT, y + h);
    for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
            setPixel(px, py, r, g, b, 255);
        }
    }
}

function drawChar(char: string, startX: number, startY: number, scale: number, r: number, g: number, b: number) {
    const glyph = FONT_5X7[char.toUpperCase()] || FONT_5X7[' '];
    for (let row = 0; row < glyph.length; row++) {
        const line = glyph[row];
        for (let col = 0; col < 5; col++) {
            if ((line & (1 << (4 - col))) !== 0) {
                fillRect(startX + col * scale, startY + row * scale, scale, scale, r, g, b);
            }
        }
    }
}

function drawText(text: string, startX: number, startY: number, scale: number, r: number, g: number, b: number) {
    let cursorX = startX;
    const charWidth = 6 * scale;
    for (let i = 0; i < text.length; i++) {
        drawChar(text[i], cursorX, startY, scale, r, g, b);
        cursorX += charWidth;
    }
}

// 1. Background (Clean Dark Editorial Slate)
fillRect(0, 0, WIDTH, HEIGHT, 15, 23, 42); // #0f172a

// 2. Header Banner
fillRect(0, 0, WIDTH, 110, 30, 41, 59); // #1e293b
fillRect(0, 110, WIDTH, 6, 59, 130, 246); // Accent blue bar

drawText("WORLD NEWS DAILY", 50, 38, 4, 255, 255, 255);
drawText("24 NOV 2026", WIDTH - 260, 44, 3, 148, 163, 184);

// 3. News Headlines Layout (5 items)
const headlines = [
    { cat: "TECHNOLOGY", title: "NVIDIA REINSTATES HUANG", desc: "BOARD BRINGS BACK CO-FOUNDER; SHARES JUMP ABOUT 30%" },
    { cat: "DEFENSE & GEOPOLITICS", title: "UKRAINE HITS RUSSIAN SHIPS OFF LIBYA", desc: "SEA-DRONE STRIKE ON BENGHAZI NAVAL BASE, ZELENSKYY SAYS" },
    { cat: "CLIMATE & DIPLOMACY", title: "COP31 CLIMATE TALKS COLLAPSE", desc: "NO DEAL ON A FOSSIL FUEL PHASE-OUT; SUMMIT ENDS IN STALEMATE" },
    { cat: "ENERGY MARKETS", title: "IRAN SAYS MINES HIT 3 TANKERS IN HORMUZ", desc: "IRANS NAVY CLAIMS BLASTS SET THREE OIL TANKERS ABLAZE" },
    { cat: "GEOPOLITICS & TRADE", title: "EU SANCTIONS RUSSIA", desc: "NEW SANCTIONS TARGET RUSSIAN BANKS, SOLDIERS AND ATHLETES" }
];

const startY = 145;
const rowH = 160;
const cardW = WIDTH - 100;

for (let i = 0; i < headlines.length; i++) {
    const rx = 50;
    const ry = startY + i * rowH;

    // Card background
    fillRect(rx, ry, cardW, 145, 30, 41, 59); // #1e293b
    // Left category color indicator tag
    const tagColors = [
        [59, 130, 246], // Blue
        [239, 68, 68],  // Red
        [245, 158, 11], // Amber
        [16, 185, 129], // Green
        [168, 85, 247]  // Purple
    ];
    fillRect(rx, ry, 10, 145, tagColors[i][0], tagColors[i][1], tagColors[i][2]);

    // Category tag text
    drawText(headlines[i].cat, rx + 25, ry + 16, 2, tagColors[i][0], tagColors[i][1], tagColors[i][2]);

    // Headline title (Large)
    drawText(headlines[i].title, rx + 25, ry + 46, 3, 255, 255, 255);

    // Description sub-line (scale 2 so it fits well within card with margin)
    drawText(headlines[i].desc, rx + 25, ry + 95, 2, 148, 163, 184);
}

// 4. Footer
fillRect(0, HEIGHT - 40, WIDTH, 40, 30, 41, 59);
drawText("SUMMARY OF 24 NOV 2026 WORLD NEWS", 50, HEIGHT - 28, 2, 148, 163, 184);

// Encode and save
const pngBuffer = encodePNG(WIDTH, HEIGHT, img);
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '.';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), pngBuffer);
console.log('Successfully generated updated entry.png.');
