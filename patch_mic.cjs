const fs = require('fs');
let code = fs.readFileSync('src/components/ChatRoomScreen.tsx', 'utf8');

const oldMicEndRegex = /  const handleMicClick = \(\) => \{[\s\S]*?(?=  const formatTimestamp =)/;

// Add import if not present
if (!code.includes("import { GoogleGenAI } from '@google/genai';")) {
  code = code.replace("import React, { useState, useRef, useEffect, useCallback } from 'react';", "import React, { useState, useRef, useEffect, useCallback } from 'react';\nimport { GoogleGenAI } from '@google/genai';");
}

// Add refs if not present
if (!code.includes("mediaRecorderRef.current")) {
  const refsCode = `  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);`;
  code = code.replace("  const textareaRef = useRef<HTMLTextAreaElement | null>(null);", refsCode);
}

const newMicLogic = `  const handleMicClick = async () => {
    if (micActive && mediaRecorderRef.current) {
      // Stop recording
      mediaRecorderRef.current.stop();
      setMicActive(false);
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setMicNotice('Transcribing...');
          try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("API Key missing");
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
               model: 'gemini-3.5-transcribe',
               contents: [{
                  role: 'user',
                  parts: [
                     {
                       inlineData: {
                          mimeType: 'audio/webm',
                          data: base64Audio
                       }
                     },
                     { text: 'Transcribe this audio exactly as spoken.' }
                  ]
               }]
            });
            const transcript = response.text || '';
            setInputText(prev => prev ? \`\${prev} \${transcript}\` : transcript);
            setMicNotice(null);
          } catch(err) {
             console.error('Transcription error:', err);
             setMicNotice('Transcription failed.');
             setTimeout(() => setMicNotice(null), 3000);
          }
        };
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setMicActive(true);
      setMicNotice('Listening... Tap mic again to stop');
    } catch (err) {
      console.error('Mic access denied:', err);
      setMicNotice('Microphone access denied or unavailable.');
      setTimeout(() => setMicNotice(null), 3000);
    }
  };

`;

code = code.replace(oldMicEndRegex, newMicLogic);
fs.writeFileSync('src/components/ChatRoomScreen.tsx', code);
