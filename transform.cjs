const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// I only want to modify lines inside the VIP modules, which start around line 1404 and end around 3196. 
// A simple way is to slice the array of lines, replace, and stitch back.
const lines = content.split('\n');
const startMatch = lines.findIndex(l => l.includes("activeModule === 'vip-gex'"));
const endMatch = lines.findIndex((l, i) => i > startMatch && l.includes("!['vip-journal', 'vip-conversion', 'vip-gex', 'vip-strategy'].includes(activeModule)"));

for (let i = startMatch; i < endMatch; i++) {
  // We need to be careful not to break specific elements that should maybe stay preserving dark?
  // Actually, the user wants ALL colors to fuse and match perfectly.
  // We remove 'preserve-dark'
  lines[i] = lines[i].replace(/preserve-dark\s*/g, '');
  
  // Replace dark tailwind variants with light tailwind variants
  lines[i] = lines[i]
    .replace(/bg-\[#000000\]/g, 'bg-white')
    .replace(/bg-\[#0b0e14\]/g, 'bg-white')
    .replace(/bg-\[#0A0A0A\]/g, 'bg-white')
    .replace(/bg-\[#111111\]/g, 'bg-neutral-100')
    .replace(/bg-\[#111\]/g, 'bg-neutral-100')
    .replace(/bg-\[#0A0B0E\]/g, 'bg-white')
    .replace(/bg-black\/40/g, 'bg-black/5')
    .replace(/bg-black\/80/g, 'bg-black/10')
    .replace(/bg-[#222222]/g, 'bg-black/5')
    .replace(/border-\[#222222\]/g, 'border-black/10')
    .replace(/border-white\/\[0\.08\]/g, 'border-black/10')
    .replace(/bg-white\/5/g, 'bg-black/5')
    .replace(/bg-white\/\[0\.03\]/g, 'bg-black/[0.03]')
    .replace(/bg-white\/\[0\.05\]/g, 'bg-black/[0.05]')
    .replace(/bg-white\/\[0\.1\]/g, 'bg-black/[0.1]')
    .replace(/bg-white\/10/g, 'bg-black/10')
    .replace(/bg-white\/20/g, 'bg-black/20')
    .replace(/hover:bg-white\/\[0\.08\]/g, 'hover:bg-black/10')
    .replace(/hover:bg-white\/5/g, 'hover:bg-black/5')
    .replace(/border-white\/5/g, 'border-black/5')
    .replace(/border-white\/10/g, 'border-black/10')
    .replace(/border-white\/20/g, 'border-black/20')
    .replace(/border-white\/30/g, 'border-black/30')
    .replace(/border-white\/40/g, 'border-black/40')
    .replace(/border-white\/50/g, 'border-black/50')
    .replace(/hover:border-white\/20/g, 'hover:border-black/20')
    .replace(/hover:border-white\/40/g, 'hover:border-black/40')
    .replace(/text-white\/90/g, 'text-black/90')
    .replace(/text-white\/80/g, 'text-black/80')
    .replace(/text-white\/70/g, 'text-black/70')
    .replace(/text-white\/60/g, 'text-black/60')
    .replace(/text-white\/50/g, 'text-black/50')
    .replace(/text-white\/40/g, 'text-black/40')
    .replace(/text-white\/30/g, 'text-black/30')
    .replace(/text-white\/20/g, 'text-black/20')
    .replace(/text-white\/10/g, 'text-black/10')
    .replace(/text-gray-200/g, 'text-neutral-800')
    .replace(/text-gray-300/g, 'text-neutral-700')
    .replace(/text-gray-400/g, 'text-neutral-600')
    .replace(/text-gray-500/g, 'text-neutral-500')
    .replace(/text-white/g, 'text-black')
    .replace(/hover:text-white\/80/g, 'hover:text-black/80')
    .replace(/hover:text-white/g, 'hover:text-black')
    .replace(/text-\[#3B82F6\]/g, 'text-blue-600')
    .replace(/border-\[#3B82F6\]\/30/g, 'border-blue-600/30')
    .replace(/text-rose-500/g, 'text-rose-600')
    .replace(/text-rose-400/g, 'text-rose-500');
    
    // There are some specific cases, like `shadow-[0_20px_40px_rgba(0,0,0,0.8)]` 
    // It should probably just be standard tailwind shadow-2xl or we can leave shadows as is.
    // Also, inside VIP journal there are `bg-black/40` which should be `bg-black/5` probably, done above
    
}

fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf-8');
console.log('Transform complete.');
