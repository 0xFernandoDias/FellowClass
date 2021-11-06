import initWeb3W from 'web3w';
import contractsInfo from '$lib/contracts.json';
import { notifications } from './notifications';
import { finality, nodeUrl, chainId } from '$lib/config';
import { base } from '$app/paths';
import { isCorrected, correctTime } from './time';
import { chainTempo } from './chainTempo';

const walletStores = initWeb3W({
  //  type ContractsInfos = {[name: string]: {address: string; abi: Abi}};
  // export type ChainConfig = {
  //   chainId: string;
  //   name?: string;
  //   contracts: ContractsInfos;
  // };
  chainConfigs: { chainId: "42", name: "kovan", contracts: { "FellowMarket": { address: "", abi: contractsInfo } } },
  builtin: { autoProbe: true },
  transactions: {
    autoDelete: false,
    finality,
  },
  flow: {
    autoUnlock: true,
  },
  autoSelectPrevious: true,
  localStoragePrefix: base.startsWith('/ipfs/') || base.startsWith('/ipns/') ? base.slice(6) : undefined, // ensure local storage is not conflicting across web3w-based apps on ipfs gateways
  options: [

  ],
  fallbackNode: nodeUrl, // TODO use query string to specify it // TODO settings
  checkGenesis: true,
});

export const { wallet, transactions, builtin, chain, balance, flow, fallback } = walletStores;

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).walletStores = walletStores;
}

chainTempo.startOrUpdateProvider(wallet.provider);

function notifyFailure(tx: { hash: string }) {
  notifications.queue({
    id: tx.hash,
    delay: 0,
    title: 'Transaction Error',
    text: 'The Transaction failed',
    type: 'error',
    onAcknowledge: () => transactions.acknowledge(tx.hash, 'failure'),
  });
}

function notifyCancelled(tx: { hash: string }) {
  notifications.queue({
    id: tx.hash,
    delay: 3,
    title: 'Transaction Cancelled',
    text: 'The Transaction Has Been Replaced',
    type: 'info',
    onAcknowledge: () => transactions.acknowledge(tx.hash, 'cancelled'),
  });
}

transactions.subscribe(($transactions) => {
  for (const tx of $transactions.concat()) {
    if (tx.confirmations > 0 && !tx.acknowledged) {
      if (tx.status === 'failure') {
        notifyFailure(tx);
      } else if (tx.status === 'cancelled') {
        notifyCancelled(tx);
      } else {
        // auto acknowledge
        transactions.acknowledge(tx.hash, tx.status);
      }
    }
  }
});

chain.subscribe(async (v) => {
  chainTempo.startOrUpdateProvider(wallet.provider);
  if (!isCorrected()) {
    if (v.state === 'Connected' || v.state === 'Ready') {
      const latestBlock = await wallet.provider?.getBlock('latest');
      if (latestBlock) {
        correctTime(latestBlock.timestamp);
      }
    }
  }
});

fallback.subscribe(async (v) => {
  if (!isCorrected()) {
    if (v.state === 'Connected' || v.state === 'Ready') {
      const latestBlock = await wallet.provider?.getBlock('latest');
      if (latestBlock) {
        correctTime(latestBlock.timestamp);
      }
    }
  }
});
