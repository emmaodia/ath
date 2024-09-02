import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  parseEther,
  createWalletClient,
  custom,
  formatEther
} from "viem";
import { lineaSepolia } from "viem/chains";
import { ABI } from "../abi";

const publicClient = createPublicClient({
  chain: lineaSepolia,
  transport: http(),
});

export default function Home() {
  const [client, setClient] = useState(null);
  const [address, setAddress] = useState(null);
  const [connected, setConnected] = useState(false);
  const [houseBalance, setHouseBalance] = useState(null);
  const [prediction, setPrediction] = useState(""); // State to store user input for prediction
  const [betAmount, setBetAmount] = useState(""); // State to store the amount to bet
  const [transactionHash, setTransactionHash] = useState(""); // State to store the transaction hash
  const [gameResult, setGameResult] = useState(""); // State to store game result
  
  // Function to connect to MetaMask and create a wallet client
  const connectToMetaMask = async () => {
    if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
      try {
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });

        // Create a wallet client using MetaMask
        const walletClient = createWalletClient({
          chain: lineaSepolia,
          transport: custom(window.ethereum),
        });

        // Get the connected address
        const [userAddress] = await walletClient.getAddresses();
        setClient(walletClient);
        setAddress(userAddress);
        setConnected(true);
        console.log("Connected account:", userAddress);
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
        address: "0x8fa509ab0087755fdd5fb49df1d5fad95f9d9eb7", 
        abi: ABI,
        functionName: "houseBalance",
      });

      setHouseBalance(formatEther(balance));
      console.log("House Balance:", balance);
    } catch (error) {
      console.error("Failed to fetch house balance:", error);
    }
  };

  const handlePlay = async (event) => {
    event.preventDefault();

    if (!client || !address) {
      console.error("Client or address not available");
      return;
    }

    try {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: "0x8fa509ab0087755fdd5fb49df1d5fad95f9d9eb7", 
        abi: ABI,
        functionName: "play",
        args: [parseInt(prediction, 10)], // Ensure prediction is an integer
        value: parseEther(betAmount), // Convert bet amount to wei
      });

      if (!request) {
        console.error("Simulation failed to return a valid request object.");
        return;
      }

      console.log("Simulation successful. Request object:", request);

      const hash = await client.writeContract(request);
      setTransactionHash(hash);
      console.log(`Transaction sent: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({hash});
      console.log(`Transaction confirmed: ${receipt.transactionHash}`);

      // After confirmation, fetch and handle events
      await fetchGameEvents(receipt.blockNumber, receipt.transactionHash);
    } catch (error) {
      console.error("Simulation or transaction failed:", error);
    }
  };

  const fetchGameEvents = async (blockNumber, transactionHash) => {
    try {
      // Fetch the logs for the GamePlayed event
      const logs = await publicClient.getContractEvents({
        client: publicClient,
        address: "0x8fa509ab0087755fdd5fb49df1d5fad95f9d9eb7", // Your contract address
        abi: ABI,
        eventName: "GamePlayed",
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      if (logs.length > 0) {
        const event = logs[0];
        console.log("GamePlayed event:", event);
        const { args } = event;
        const { player, amount, prediction, houseNumber } = args;
        setGameResult(`Game Played: Player ${player} predicted ${prediction}, House Number: ${houseNumber}, Bet Amount: ${amount}`);
      }

      // Fetch the logs for the GameWon event
      const wonLogs = await publicClient.getContractEvents({
        client: publicClient,
        address: "0x8fa509ab0087755fdd5fb49df1d5fad95f9d9eb7", // Your contract address
        abi: ABI,
        eventName: "GameWon",
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      if (wonLogs.length > 0) {
        setGameResult(`You won the game!`);
      }

      // Fetch the logs for the GameLost event
      const lostLogs = await publicClient.getContractEvents({
        client: publicClient,
        address: "0x8fa509ab0087755fdd5fb49df1d5fad95f9d9eb7", // Your contract address
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
    <main
      className={`flex min-h-screen flex-col items-center p-24`}
    >

      Hello, World!
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
