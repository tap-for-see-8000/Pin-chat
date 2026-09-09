const fs = require('fs');
let code = fs.readFileSync('src/components/EmojiGatewayModal.tsx', 'utf8');

code = code.replace(
  '{/* Downward Trail Indicator (Static background hint) */}',
  `{/* Downward Trail Indicator (Static background hint) */}
            <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-4 flex flex-col items-center pointer-events-none opacity-40">
              <div className="w-0.5 h-12 bg-gradient-to-b from-[#AFDDFF]/40 to-transparent"></div>
              <div className="mt-2 text-[8px] font-tech text-[#AFDDFF] uppercase tracking-[0.3em] rotate-90 origin-left ml-6 whitespace-nowrap">
                DRAG DOWN TO DECRYPT
              </div>
            </div>`
);

fs.writeFileSync('src/components/EmojiGatewayModal.tsx', code);
