// ==========================
// DOM ELEMENTS
// ==========================
const connectBtn = document.getElementById("connectBtn");
const sendBtn = document.getElementById("sendBtn");

const walletAddressEl = document.getElementById("walletAddress");
const balanceEl = document.getElementById("balance");
const statusEl = document.getElementById("status");

// ==========================
// GLOBALS
// ==========================
let provider = null;
let connection = null;

const NETWORK = "https://api.devnet.solana.com";

// ==========================
// GET PHANTOM PROVIDER
// ==========================
function getProvider() {
  if (window.solana && window.solana.isPhantom) {
    return window.solana;
  }
  alert("❌ Phantom Wallet not found");
  return null;
}

// ==========================
// CONNECT WALLET
// ==========================
connectBtn.addEventListener("click", async () => {
  try {
    provider = getProvider();
    if (!provider) return;

    console.log("Connecting Phantom...");
    await provider.connect({ onlyIfTrusted: false });

    walletAddressEl.innerText = provider.publicKey.toString();

    connection = new solanaWeb3.Connection(NETWORK, "confirmed");

    await updateBalance();
    statusEl.innerText = "Wallet connected ✅";

  } catch (err) {
    console.error("Wallet connect error:", err);
    statusEl.innerText = "Wallet connection failed ❌";
  }
});

// ==========================
// UPDATE BALANCE
// ==========================
async function updateBalance() {
  const balance = await connection.getBalance(provider.publicKey);
  balanceEl.innerText = (
    balance / solanaWeb3.LAMPORTS_PER_SOL
  ).toFixed(4);
}

// ==========================
// SEND SOL (REAL & VERIFIED)
// ==========================
sendBtn.addEventListener("click", async () => {
  try {
    if (!provider || !connection) {
      alert("Connect wallet first");
      return;
    }

    const toAddress = document.getElementById("toAddress").value.trim();
    const amount = Number(document.getElementById("amount").value);

    if (!toAddress || !amount || amount <= 0) {
      alert("Enter valid address and amount");
      return;
    }

    let recipient;
    try {
      recipient = new solanaWeb3.PublicKey(toAddress);
    } catch {
      alert("Invalid Solana address");
      return;
    }

    statusEl.innerText = "Preparing transaction...";

    // --------------------------
    // CREATE TRANSACTION
    // --------------------------
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: recipient,
        lamports: amount * solanaWeb3.LAMPORTS_PER_SOL,
      })
    );

    transaction.feePayer = provider.publicKey;

    const latestBlockhash = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = latestBlockhash.blockhash;

    console.log("Transaction prepared");

    // --------------------------
    // SIGN (POPUP OPENS HERE)
    // --------------------------
    statusEl.innerText = "Approve transaction in Phantom...";
    const signedTx = await provider.signTransaction(transaction);

    console.log("Transaction signed");

    // --------------------------
    // SEND TO NETWORK
    // --------------------------
    const signature = await connection.sendRawTransaction(
      signedTx.serialize(),
      { skipPreflight: false }
    );

    console.log("Transaction sent:", signature);
    statusEl.innerText = "Waiting for finalization...";

    // --------------------------
    // WAIT FOR FINALIZATION
    // --------------------------
    await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "finalized"
    );

    // --------------------------
    // VERIFY ON-CHAIN RESULT
    // --------------------------
    const tx = await connection.getTransaction(signature, {
      commitment: "finalized",
    });

    if (!tx) {
      statusEl.innerText = "Transaction not found ❌";
      return;
    }

    if (tx.meta && tx.meta.err) {
      console.error("On-chain error:", tx.meta.err);
      statusEl.innerText = "Transaction failed on-chain ❌";
      return;
    }

    // --------------------------
    // REAL SUCCESS
    // --------------------------
    statusEl.innerText = "Transaction finalized ✅";
    await updateBalance();

    console.log(
      `Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );

  } catch (err) {
    console.error("Transaction error:", err);

    if (err.message?.includes("User rejected")) {
      statusEl.innerText = "Transaction rejected ❌";
    } else {
      statusEl.innerText = "Transaction failed ❌ (check console)";
    }
  }
});
