const fs = require('fs');

let code = fs.readFileSync('src/components/ProfileScreen.tsx', 'utf8');

// Add useRef for file input
if (!code.includes("const fileInputRef")) {
  code = code.replace(
    "const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');",
    "const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');\n  const fileInputRef = React.useRef<HTMLInputElement>(null);\n  const [isProcessingImage, setIsProcessingImage] = useState(false);"
  );

  const imageProcessor = `
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to crop and resize
        const canvas = document.createElement('canvas');
        const size = 300; // max size 300x300
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Calculate crop
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          // Get base64 jpeg
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(dataUrl);
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => setIsProcessingImage(false);
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.onerror = () => setIsProcessingImage(false);
    reader.readAsDataURL(file);
  };
  `;

  code = code.replace(
    "const loadData = async () => {",
    imageProcessor + "\n  const loadData = async () => {"
  );

  // Replace avatarUrl input with custom button and preview
  code = code.replace(
    `<input 
                  type="text" 
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="Avatar Image URL..."
                  className="w-full bg-black/40 border border-[#AFDDFF]/50 rounded px-2 py-1 text-white text-xs mb-2 focus:outline-none"
                />`,
    `<div className="mb-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessingImage}
                      className="px-3 py-1.5 bg-[#AFDDFF]/20 text-[#AFDDFF] rounded text-[10px] font-tech uppercase tracking-wider hover:bg-[#AFDDFF]/30 transition-colors border border-[#AFDDFF]/30"
                    >
                      {isProcessingImage ? 'PROCESSING...' : (avatarUrl ? 'CHANGE PHOTO' : 'ADD PHOTO')}
                    </button>
                    {avatarUrl !== currentUser.avatarUrl && avatarUrl && (
                       <button 
                         onClick={() => setAvatarUrl(currentUser.avatarUrl || '')}
                         className="text-white/50 hover:text-white text-[10px] uppercase font-tech transition-colors"
                       >
                         CANCEL
                       </button>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                </div>`
  );

  // We should also update the preview image when editing, if user picks a new photo
  // The avatar preview is here:
  // {currentUser.avatarUrl ? (
  //   <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover filter grayscale" />
  // )
  // We can change this to use `isEditing ? avatarUrl : currentUser.avatarUrl`
  code = code.replace(
    `{currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover filter grayscale" />
            ) : (
              <span className="text-2xl font-tech text-white/50">{currentUser.fullName.charAt(0).toUpperCase()}</span>
            )}`,
    `{(isEditing ? avatarUrl : currentUser.avatarUrl) ? (
              <img src={(isEditing ? avatarUrl : currentUser.avatarUrl)!} alt="Avatar" className="w-full h-full object-cover filter grayscale" />
            ) : (
              <span className="text-2xl font-tech text-white/50">{(isEditing ? fullName : currentUser.fullName).charAt(0).toUpperCase()}</span>
            )}`
  );
  
  // Also fix `<div className="w-16 h-16 rounded-full...` to preview correct avatar.

  fs.writeFileSync('src/components/ProfileScreen.tsx', code);
}
