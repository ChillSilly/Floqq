const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('bg-[#14161C]') || lines[i].includes('bg-[#0F0F0F]') || lines[i].includes('bg-[#0b0e14]') || lines[i].includes('bg-[#0A0B0E]') || lines[i].includes('bg-[#111115]')) {
    lines[i] = lines[i]
      .replace(/bg-\[#14161C\]/gi, 'bg-white')
      .replace(/bg-\[#0F0F0F\]/gi, 'bg-white')
      .replace(/bg-\[#0b0e14\]/gi, 'bg-white')
      .replace(/bg-\[#0A0B0E\]/gi, 'bg-white')
      .replace(/bg-\[#111115\]/gi, 'bg-neutral-100');
  }
}

fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf-8');
console.log('Transform complete part 3.');
