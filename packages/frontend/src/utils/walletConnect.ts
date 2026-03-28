// Wallet connection utilities and debugging

export const detectInstalledWallets = () => {
  const detected: string[] = [];
  
  if ((window as any).martian) detected.push('Martian');
  if ((window as any).petra) detected.push('Petra');
  if ((window as any).pontem) detected.push('Pontem');
  
  return detected;
};

export const waitForWalletDetection = (maxWait = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      const wallets = detectInstalledWallets();
      
      if (wallets.length > 0) {
        clearInterval(checkInterval);
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > maxWait) {
        clearInterval(checkInterval);
        resolve(false);
        return;
      }
    }, 200);
  });
};

export const logWalletDebugInfo = () => {
  const detected = detectInstalledWallets();
  
  console.group('🔍 Wallet Debug Info');
  console.log('Detected wallets:', detected.length > 0 ? detected : 'None');
  console.log('Window properties:', {
    hasMartian: !!(window as any).martian,
    hasPetra: !!(window as any).petra,
    hasPontem: !!(window as any).pontem,
  });
  console.log('Apta SDK:', typeof (window as any).aptos);
  console.groupEnd();
};

export const getWalletErrorSuggestion = (error: any): string => {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('no provider')) {
    return 'Wallet extension not found. Install Petra (petra.app) or Martian (martianwallet.xyz)';
  }
  
  if (message.includes('user rejected') || message.includes('cancelled')) {
    return 'Connection cancelled. Click the button again to try connecting.';
  }
  
  if (message.includes('network') || message.includes('chain')) {
    return 'Network mismatch. Make sure your wallet is set to Aptos Testnet.';
  }
  
  if (message.includes('timeout')) {
    return 'Connection timed out. Unlock your wallet and try again.';
  }
  
  return 'Connection failed. Check your wallet extension is unlocked and enabled.';
};
