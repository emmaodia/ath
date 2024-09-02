import { useEffect, useState, FormEvent } from "react";
import {
  createPublicClient,
  http,
  parseEther,
  createWalletClient,
  custom,
  formatEther,
  WalletClient,
  PublicClient,
} from "viem";
import { lineaSepolia } from "viem/chains";
import { ABI } from "../abi";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const CONTRACT_ADDRESS = "0x8fa509ab0087755fdd5fb49df1d5fad95f9d9eb7";

const publicClient: PublicClient = createPublicClient({
  chain: lineaSepolia,
  transport: http(),
});

export default function Home() {
  const [client, setClient] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [houseBalance, setHouseBalance] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<string>(""); 
  const [betAmount, setBetAmount] = useState<string>(""); 
  const [transactionHash, setTransactionHash] = useState<string | null>(null); 
  const [gameResult, setGameResult] = useState<string | null>(null); 

  const connectToMetaMask = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const walletClient = createWalletClient({
          chain: lineaSepolia,
          transport: custom(window.ethereum),
        });
        const [userAddress] = await walletClient.getAddresses();
        setClient(walletClient);
        setAddress(userAddress);
        setConnected(true);
      } catch (error) {
        console.error("User denied account access:", error);
      }
    } else {
      console.log("MetaMask is not installed or not running in a browser environment!");
    }
  };

  const fetchHouseBalance = async () => {
    try {
      const balance = await publicClient.readContract({
        address: CONTRACT_ADDRESS, 
        abi: ABI,
        functionName: "houseBalance",
      });

      if (balance !== undefined) {
        const formattedBalance = formatEther(balance);
        setHouseBalance(formattedBalance);
      } else {
        console.error("No balance returned from contract.");
      }
    } catch (error) {
      console.error("Failed to fetch house balance:", error);
    }
  };

  const handlePlay = async (event: FormEvent) => {
    event.preventDefault();

    if (!client || !address) {
      console.error("Client or address not available");
      return;
    }

    try {
      const { request } = await publicClient.simulateContract({
        account: address as `0x${string}`,
        address: CONTRACT_ADDRESS, 
        abi: ABI,
        functionName: "play",
        args: [parseInt(prediction, 10)], 
        value: parseEther(betAmount), 
      });

      if (!request) {
        console.error("Simulation failed to return a valid request object.");
        return;
      }

      const hash = await client.writeContract(request);
      setTransactionHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      await fetchGameEvents(receipt.blockNumber, receipt.transactionHash);
    } catch (error) {
      console.error("Simulation or transaction failed:", error);
    }
  };

  const fetchGameEvents = async (blockNumber: bigint, transactionHash: string) => {
    try {
      const logs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS, 
        abi: ABI,
        eventName: "GamePlayed",
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      if (logs.length > 0) {
        const event = logs[0];
        const { args } = event;
        const { player, amount, prediction, houseNumber } = args;
        setGameResult(`Game Played: Player ${player} predicted ${prediction}, House Number: ${houseNumber}, Bet Amount: ${amount}`);
      } 

      const wonLogs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS, 
        abi: ABI,
        eventName: "GameWon",
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      if (wonLogs.length > 0) {
        setGameResult(`You won the game!`);
      }

      const lostLogs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS, 
        abi: ABI,
        eventName: "GameLost",
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      if (lostLogs.length > 0) {
        setGameResult(`You lost the game.`);
      }
    } catch (error) {
      console.error("Failed to fetch game events:", error);
    }
  };

  useEffect(() => {
    if (client && address) {
      fetchHouseBalance();
    }
  }, [client, address]);

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1>Hello, World!</h1>
      {!connected ? (
        <button
          onClick={connectToMetaMask}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          <p>Connected as: {address}</p>
          {houseBalance !== null ? (
            <p>House Balance: {houseBalance} Ether</p>
          ) : (
            <p>Loading House Balance...</p>
          )}

          <form onSubmit={handlePlay} className="mt-4">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Prediction (0-9):
              </label>
              <input
                type="number"
                min="0"
                max="9"
                value={prediction}
                onChange={(e) => setPrediction(e.target.value)}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Bet Amount (in ETH):
              </label>
              <input
                type="text"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Play
            </button>
          </form>

          {transactionHash && (
            <p className="mt-4">Transaction Hash: {transactionHash}</p>
          )}

          {gameResult && (
            <p className="mt-4">{gameResult}</p>
          )}
        </div>
      )}
    </main>
  );
}
