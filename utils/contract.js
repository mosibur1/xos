const { ethers } = require("ethers");
const settings = require("../config/config");
const { generateComplexId, getRandomNumber, sleep } = require("./utils");
const { USDC_ABI, SWAP_ROUTER_ABI, DID_REGISTRAR_ABI, WXOS_UNWRAP_ABI, WXOS_WRAP_ABI } = require("./ABI");
const DID_REGISTRAR_ADDRESS = "0xb8692493fe9baec1152b396188a8e6f0cfa4e4e7";
const SWAP_ROUTER_ADDRESS = "0xdc7d6b58c89a554b3fdc4b5b10de9b4dbf39fb40";
const WXOS_ADDRESS = "0x0aab67cf6f2e99847b9a95dec950b250d648c1bb";
const USDC_ADDRESS = "0xb2c1c007421f0eb5f4b3b3f38723c309bb208d7d";
const BONK_ADDRESS = "0x00309602f7977d45322279c4dd5cf61d16fd061b";
const BNB_ADDRESS = "0x83dfbe02dc1b1db11bc13a8fc7fd011e2dbbd7c0";
const JUP_ADDRESS = "0x26b597804318824a2e88cd717376f025e6bb2219";
const RESOLVER_ADDRESS = "0x17b1bfd1e30f374dbd821f2f52e277bc47829ceb";
const EXPOLER = "https://testnet.xoscan.io/tx/";

const availableTokens = {};

function generateRandomDomain() {
  let usernameLength = Math.floor(Math.random() * 5) + 8; // Random length between 8 and 12
  const usernameCharacters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const firstCharCharacters = "abcdefghijklmnopqrstuvwxyz"; // Characters for the first position
  let username = "";

  // Ensure the first character is not a number
  username += firstCharCharacters.charAt(Math.floor(Math.random() * firstCharCharacters.length));
  usernameLength--; // Decrement the length since we already added the first character

  for (let i = 0; i < usernameLength; i++) {
    username += usernameCharacters.charAt(Math.floor(Math.random() * usernameCharacters.length));
  }

  return `${username}`;
}

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  blue: "\x1b[34;1m",
  bold: "\x1b[1m",
};

const logger = {
  info: (msg) => console.log(`${colors.blue}[✓] ${msg}${colors.reset}`),
  wallet: (msg) => console.log(`${colors.cyan}[➤] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
};

async function registerOpenID(privateKey, provider) {
  const domain = generateRandomDomain();

  const minBalance = ethers.parseEther("0.1");
  const wallet = new ethers.Wallet(privateKey, provider);
  try {
    const balance = await provider.getBalance(wallet.address);
    if (balance < minBalance) {
      logger.error(`Insufficient XOS for ${wallet.address}. Need at least 0.1 XOS, have ${ethers.formatEther(balance)} XOS.`);
      return;
    }

    const contract = new ethers.Contract(DID_REGISTRAR_ADDRESS, DID_REGISTRAR_ABI, wallet);
    logger.wallet(`Registering ${domain}.xos for ${wallet.address}...`);
    const duration = 31536000;
    const value = ethers.parseEther("0.05");
    const tx = await contract.registerWithConfig(domain, wallet.address, duration, RESOLVER_ADDRESS, wallet.address, true, "0x0000000000000000000000000000000000000000", { value });

    logger.loading(`[${wallet.address}] Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    logger.success(`[${wallet.address}] Domain ${domain}.xos registered! Tx: https://testnet.xoscan.io/tx/${receipt.hash}`);
  } catch (error) {
    logger.error(`Error registering for ${wallet.address}: ${error.message}`);
  }
}

async function wrapToken(action, wallet, total, provider) {
  for (let current = 1; current <= total; current++) {
    try {
      const balance = await provider.getBalance(wallet.address);
      const percent = getRandomNumber(settings.PERCENT_SWAP[0], settings.PERCENT_SWAP[1]);
      if (balance < ethers.parseEther("0.0001")) {
        logger.warn(`Insufficient XOS for ${wallet.address} for swap`);
        return;
      }
      const amount = ((percent * parseFloat(ethers.formatEther(balance))) / 100).toFixed(4);
      const contract = new ethers.Contract(WXOS_ADDRESS, action === "wrap" ? WXOS_WRAP_ABI : WXOS_UNWRAP_ABI, wallet);
      const gasParams = {
        maxPriorityFeePerGas: ethers.parseUnits("10.5", "gwei"),
        maxFeePerGas: ethers.parseUnits("94.5", "gwei"),
      };

      const amountWei = ethers.parseEther(amount.toString());
      let tx;

      logger.info(`[${current}/${total}][${wallet.address}] Estimating gas (${current}/${total})...`);

      if (action === "wrap") {
        const gasEstimate = await contract.deposit.estimateGas({
          value: amountWei,
          ...gasParams,
        });

        logger.info(`[${current}/${total}][${wallet.address}] Wrapping (${current}/${total})...`);
        tx = await contract.deposit({
          value: amountWei,
          ...gasParams,
          gasLimit: (gasEstimate * 12n) / 10n,
        });
      } else {
        const gasEstimate = await contract.withdraw.estimateGas(amountWei, gasParams);

        logger.info(`[${current}/${total}][${wallet.address}] Unwrapping (${current}/${total})...`);
        tx = await contract.withdraw(amountWei, {
          ...gasParams,
          gasLimit: (gasEstimate * 12n) / 10n,
        });
      }
      const receipt = await tx.wait(3);
      logger.success(`[${current}/${total}][${wallet.address}] Transaction ${current}/${total} successful! | ${EXPOLER}${receipt.hash}`);
    } catch (error) {
      logger.warn(`[${current}/${total}][${wallet.address}] Transaction ${current}/${total} failed!`);
      return;
    }
  }
}

async function swapTokens(privateKey, provider) {
  const options = settings.TOKENS_SWAP;
  const wallet = new ethers.Wallet(privateKey, provider);

  for (const choice of options) {
    let tokenOut;
    let isDirectSwap = false;
    const numTx = getRandomNumber(settings.AMOUNT_SWAP[0], settings.AMOUNT_SWAP[1]);
    if (isNaN(numTx) || numTx <= 0) {
      logger.error("Invalid number of transactions.");
      return;
    }
    switch (`${choice}`) {
      case "1":
        tokenOut = USDC_ADDRESS;
        isDirectSwap = true;
        break;
      case "2":
        tokenOut = BONK_ADDRESS;
        break;
      case "3":
        tokenOut = BNB_ADDRESS;
        break;
      case "4":
        tokenOut = JUP_ADDRESS;
        break;
      case "5":
        await wrapToken("wrap", wallet, numTx, provider);
        continue;
      case "6":
        await wrapToken("unwrap", wallet, numTx, provider);
        continue;
      default:
        logger.error(`Invalid options ${choice}`);
        return;
    }

    const wxosContract = new ethers.Contract(WXOS_ADDRESS, USDC_ABI, wallet);
    const swapContract = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, wallet);

    for (let i = 0; i < numTx; i++) {
      try {
        const timesleep = getRandomNumber(settings.DELAY_SWAP[0], settings.DELAY_SWAP[1]);
        logger.info(`[${wallet.address}] Delay ${timesleep}s for next swap...`);
        await sleep(timesleep);

        const balance = await provider.getBalance(wallet.address);
        const percent = getRandomNumber(settings.PERCENT_SWAP[0], settings.PERCENT_SWAP[1]);
        if (balance < ethers.parseEther("0.0001")) {
          logger.warn(`Insufficient XOS for ${wallet.address} for swap`);
          return;
        }
        const amountIn = ((percent * parseFloat(ethers.formatEther(balance))) / 100).toFixed(4);
        let amountInWei;
        try {
          amountInWei = ethers.parseEther(amountIn);
        } catch (error) {
          logger.error("Invalid XOS amount.");
          return;
        }

        const minBalance = amountInWei + ethers.parseEther("0.015");
        if (balance < minBalance) {
          logger.error(`Insufficient XOS for ${wallet.address}. Need at least ${ethers.formatEther(minBalance)} XOS, have ${ethers.formatEther(balance)} XOS.`);
          continue;
        }

        const allowance = await wxosContract.allowance(wallet.address, SWAP_ROUTER_ADDRESS);
        logger.wallet(`[${wallet.address}] Swapping amount ${amountIn} XOS...`);

        if (allowance < amountInWei) {
          logger.wallet(`[${wallet.address}] Approving WXOS for ${wallet.address}...`);
          const approveTx = await wxosContract.approve(SWAP_ROUTER_ADDRESS, amountInWei, { gasLimit: 100000 });
          await approveTx.wait();
          logger.success(`[${wallet.address}] Approval successful: ${EXPOLER}${approveTx.hash}`);
        } else {
          logger.success(`[${wallet.address}] Sufficient allowance for ${wallet.address}`);
        }

        const amountOutMinimum = 0;

        logger.loading(`[${wallet.address}] Performing swap ${i + 1}/${numTx} for ${wallet.address}...`);
        const deadline = Math.floor(Date.now() / 1000) + 1800;
        try {
          let encodedData;
          const swapInterface = new ethers.Interface(SWAP_ROUTER_ABI);

          if (isDirectSwap) {
            const normalizedWxosAddress = WXOS_ADDRESS.toLowerCase();
            const normalizedTokenOut = tokenOut.toLowerCase();
            const isTokenInWxos = normalizedWxosAddress < normalizedTokenOut;

            const swapParams = {
              tokenIn: isTokenInWxos ? WXOS_ADDRESS : tokenOut,
              tokenOut: isTokenInWxos ? tokenOut : WXOS_ADDRESS,
              fee: 500,
              recipient: wallet.address,
              amountIn: amountInWei,
              amountOutMinimum,
              sqrtPriceLimitX96: 0,
            };

            encodedData = swapInterface.encodeFunctionData("exactInputSingle", [swapParams]);
          } else {
            const path = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint24", "address", "uint24", "address"], [WXOS_ADDRESS, 500, USDC_ADDRESS, 500, tokenOut]);

            const swapParams = {
              path,
              recipient: wallet.address,
              amountIn: amountInWei,
              amountOutMinimum,
            };

            encodedData = swapInterface.encodeFunctionData("exactInput", [swapParams]);
          }

          const multicallData = [encodedData];

          let gasLimit;
          try {
            gasLimit = await swapContract.multicall.estimateGas(multicallData, { value: amountInWei });
            gasLimit = (gasLimit * 120n) / 100n;
          } catch (gasError) {
            console.log(gasError);
            logger.warn(`[${wallet.address}] Gas estimation failed: ${gasError.message}. Using default gas limit.`);
            gasLimit = isDirectSwap ? 200000 : 300000;
          }

          const tx = await swapContract.multicall(multicallData, {
            value: amountInWei,
            gasLimit,
          });

          const receipt = await tx.wait();
          logger.success(`Swap successful! Tx: https://testnet.xoscan.io/tx/${receipt.hash}`);
        } catch (swapError) {
          logger.error(`Swap ${i + 1}/${numTx} failed for ${wallet.address}: ${swapError.message}`);
          continue;
        }
      } catch (error) {
        logger.error(`Error processing swaps for ${wallet.address}: ${error.message}`);
      }
    }
  }
}

async function checkBalance(privateKey, tokenAddress, provider) {
  const wallet = new ethers.Wallet(privateKey, provider);
  try {
    if (tokenAddress) {
      const tokenContract = new ethers.Contract(tokenAddress, ["function balanceOf(address owner) view returns (uint256)"], wallet);
      const balance = await tokenContract.balanceOf(wallet.address);
      const decimals = 18;
      return parseFloat(ethers.formatUnits(balance, decimals)).toFixed(4);
    } else {
      const balance = await provider.getBalance(wallet.address);
      return parseFloat(ethers.formatEther(balance)).toFixed(4);
    }
  } catch (error) {
    console.log(`[${wallet.address}] Failed to check balance: ${error.message}`.red);
    return "0";
  }
}

module.exports = { checkBalance, registerOpenID, swapTokens };
