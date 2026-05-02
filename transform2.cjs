const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// I only want to modify lines inside the VIP modules, which start around line 1404 and end around 3196. 
const lines = content.split('\n');
const startMatch = lines.findIndex(l => l.includes("activeModule === 'vip-gex'"));
const endMatch = lines.findIndex((l, i) => i > startMatch && l.includes("!['vip-journal', 'vip-conversion', 'vip-gex', 'vip-strategy'].includes(activeModule)"));

for (let i = startMatch; i < endMatch; i++) {
  lines[i] = lines[i]
    .replace(/bg-\[#0b0e14\]/gi, 'bg-white')
    .replace(/bg-\[#050505\]/gi, 'bg-neutral-50')
    .replace(/bg-\[#0D0D11\]/gi, 'bg-white')
    .replace(/bg-\[#121212\]/gi, 'bg-white')
    .replace(/bg-\[#111111\]/gi, 'bg-neutral-100')
    .replace(/bg-\[#222222\]/gi, 'bg-neutral-200')
    .replace(/border-\[#111111\]/gi, 'border-black/5')
    .replace(/border-\[#222222\]/gi, 'border-black/10')
    .replace(/border-neutral-/gi, 'border-black/');
    
    // There are some leftover text-white/XX that was replaced to text-black/XX
    // Let's make sure no text-white is remaining, except those explicitly intended.
    // Wait, the "text-[#...]" where it is white
}

fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf-8');
console.log('Transform complete part 2.');
