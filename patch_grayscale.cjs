const fs = require('fs');

const files = [
  'src/components/InboxScreen.tsx',
  'src/components/ChatRoomScreen.tsx',
  'src/components/ProfileScreen.tsx',
  'src/components/ChatProfilePanel.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    
    // Remove grayscale classes specifically from img tags related to avatars
    code = code.replace(/className="w-full h-full rounded-full object-cover filter grayscale group-hover:grayscale-0 transition-all"/g, 'className="w-full h-full rounded-full object-cover transition-all"');
    code = code.replace(/className="w-full h-full object-cover filter grayscale"/g, 'className="w-full h-full object-cover"');
    
    fs.writeFileSync(file, code);
  }
});

