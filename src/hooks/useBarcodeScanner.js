import { useEffect } from 'react';

export function useBarcodeScanner(onScan) {
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      // 1. Ignore keystrokes if the user is clicking and typing inside an actual text input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      
      // 2. Barcode scanners type incredibly fast. Humans do not.
      // If the time between keystrokes is more than 50 milliseconds, it's a human. Reset the buffer.
      if (currentTime - lastKeyTime > 50) {
        buffer = '';
      }

      lastKeyTime = currentTime;

      // 3. When the scanner finishes reading the barcode, it automatically hits the 'Enter' key
      if (e.key === 'Enter') {
        if (buffer.length > 2) { // Ensure it actually captured a real SKU
          onScan(buffer);
          buffer = '';
        }
        return;
      }

      // 4. If it's a normal letter or number, add it to our growing string of characters
      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup the event listener when the component unmounts
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}