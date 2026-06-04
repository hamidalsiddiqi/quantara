import { Contract, parseEther, formatUnits } from 'ethers';
import { prisma } from '../db';
import {
  getProvider,
  getAdminSigner,
  USDT_ADDRESS,
  USDC_ADDRESS,
  BTCB_ADDRESS,
  ETH_ADDRESS,
  ERC20_ABI,
  SWEEP_GAS_BNB,
} from './bscProvider';
import { deriveSigner } from './hdWalletService';

const SWEEP_TOKENS: { symbol: string; address: string }[] = [
  { symbol: 'USDT', address: USDT_ADDRESS },
  { symbol: 'USDC', address: USDC_ADDRESS },
  { symbol: 'BTCB', address: BTCB_ADDRESS },
  { symbol: 'ETH', address: ETH_ADDRESS },
].filter((t) => !!t.address);

/// Sweep stablecoin balances from a user's derived deposit address into the
/// admin wallet. Sends BNB for gas from the admin signer first, then transfers
/// each non-zero token balance. Best-effort: failures are logged.
export async function sweepUserAddress(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bscDepositIndex: true, bscDepositAddress: true },
  });
  if (user?.bscDepositIndex === null || user?.bscDepositIndex === undefined || !user.bscDepositAddress) return;

  const provider = getProvider();
  const userWallet = deriveSigner(user.bscDepositIndex);
  const admin = getAdminSigner();

  const balances = await Promise.all(SWEEP_TOKENS.map(async (tok) => {
    const c = new Contract(tok.address, ERC20_ABI, userWallet);
    const bal: bigint = await c.balanceOf(user.bscDepositAddress!);
    return { ...tok, balance: bal, contract: c };
  }));

  const nonZero = balances.filter((b) => b.balance > 0n);
  if (nonZero.length === 0) return;

  const gasNeeded = parseEther('0.0009');
  const fundTx = await admin.sendTransaction({ to: user.bscDepositAddress, value: gasNeeded });
  await fundTx.wait(1);
  console.log(`[sweep] funded ${user.bscDepositAddress} with ${SWEEP_GAS_BNB} BNB tx=${fundTx.hash}`);

  for (const tok of nonZero) {
    try {
      const transferTx = await tok.contract.transfer(admin.address, tok.balance);
      await transferTx.wait(1);
      console.log(`[sweep] swept ${formatUnits(tok.balance, 18)} ${tok.symbol} from ${user.bscDepositAddress} to admin tx=${transferTx.hash}`);
    } catch (e) {
      console.error(`[sweep] ${tok.symbol} transfer failed for ${user.bscDepositAddress}:`, e);
    }
  }

  try {
    const reserve = parseEther(SWEEP_GAS_BNB);
    const bnbBalance = await provider.getBalance(user.bscDepositAddress);
    if (bnbBalance > reserve) {
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
      const gasLimit = 21000n;
      const txFee = gasPrice * gasLimit;
      const sendable = bnbBalance - reserve - txFee;
      if (sendable > 0n) {
        const bnbTx = await userWallet.sendTransaction({
          to: admin.address,
          value: sendable,
          gasLimit,
          gasPrice,
        });
        await bnbTx.wait(1);
        console.log(`[sweep] swept ${formatUnits(sendable, 18)} BNB from ${user.bscDepositAddress} to admin tx=${bnbTx.hash}`);
      }
    }
  } catch (e) {
    console.error(`[sweep] BNB sweep failed for ${user.bscDepositAddress}:`, e);
  }
}
