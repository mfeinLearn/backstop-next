'use client';

import { useEffect, useState } from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

const ethereumMainnetOnly = [
  {
    blockExplorerUrls: ['https://etherscan.io/'],
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    iconUrls: ['https://app.dynamic.xyz/assets/networks/eth.svg'],
    name: 'Ethereum',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    networkId: 1,
    rpcUrls: ['https://eth.llamarpc.com'],
    vanityName: 'ETH Mainnet',
  },
];

export function Providers({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk',-apple-system,sans-serif", color: '#0C2017', fontWeight: 700 }}>
        Loading…
      </div>
    );
  }

  return (
    <DynamicContextProvider
      theme="auto"
      locale={{
        en: {
          dyn_login: {
            title: { all: 'Select wallet', all_wallet_list: 'Select wallet', wallet_only: 'Select wallet' },
          },
        },
      }}
      settings={{
        environmentId:
          process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || '2762a57b-faa4-41ce-9f16-abff9300e2c9',
        walletConnectors: [EthereumWalletConnectors],
        networkValidationMode: 'always',
        initialAuthenticationMode: 'connect-only',
        overrides: {
          evmNetworks: ethereumMainnetOnly,
          views: [{ type: 'login', sections: [{ type: 'wallet' }] }],
        },
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
