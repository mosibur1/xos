import axios from 'axios';
import { ethers } from 'ethers';
import { promises as fs } from 'fs';

// ANSI color codes for console output
const colors = {
    CYAN: '\x1b[36m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    WHITE: '\x1b[37m',
    RESET: '\x1b[0m'
};

const BANNER = `
${colors.CYAN}██╗  ██╗ ██████╗ ███████╗    ████████╗███████╗███████╗████████╗███╗   ██╗███████╗████████╗
╚██╗██╔╝██╔═══██╗██╔════╝    ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝████╗  ██║██╔════╝╚══██╔══╝
 ╚███╔╝ ██║   ██║███████╗       ██║   █████╗  ███████╗   ██║   ██╔██╗ ██║█████╗     ██║   
 ██╔██╗ ██║   ██║╚════██║       ██║   ██╔══╝  ╚════██║   ██║   ██║╚██╗██║██╔══╝     ██║   
██╔╝ ██╗╚██████╔╝███████║       ██║   ███████╗███████║   ██║   ██║ ╚████║███████╗   ██║   
╚═╝  ╚═╝ ╚═════╝ ╚══════╝       ╚═╝   ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚══════╝   ╚═╝${colors.RESET}
${colors.YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.RESET}
${colors.CYAN}              XOS BOT @BYDONTOL - LOGIN, DAILY TASKS & AUTO SWAP${colors.RESET}
${colors.YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.RESET}`;

class XOSCombinedBot {
    constructor() {
        // API Configuration
        this.baseHeaders = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": "https://x.ink",
            "Referer": "https://x.ink/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };
        
        this.BASE_API = "https://api.x.ink/v1";
        this.REF_CODE = "1V7NKQ";
        this.tokens = {};

        // Swap Configuration
        this.CONFIG = {
            RPC_URL_XOS: "https://testnet-rpc.x.ink/",
            WXOS_ADDRESS: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB",
            USDC_ADDRESS: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", // Fixed USDC address
            BNB_ADDRESS: "0x83DFbE02dc1B1Db11bc13a8Fc7fd011E2dBbd7c0",
            SOL_ADDRESS: "0x0c8a3D1fE7E40a39D3331D5Fa4B9fee1EcA1926A",
            JUP_ADDRESS: "0x26b597804318824a2E88Cd717376f025E6bb2219",
            MIN_SWAP: 0.00005,
            MAX_SWAP: 0.0001,
            ITERATIONS: 5, // Reduced for testing
            MIN_DELAY: 10000,
            MAX_DELAY: 15000
        };

        this.SWAP_ROUTER_ADDRESS = "0xdc7D6b58c89A554b3FDC4B5B10De9b4DbF39FB40";

        // Token ABIs
        this.ERC20ABI = [
            "function decimals() view returns (uint8)",
            "function balanceOf(address owner) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)"
        ];

        this.WXOS_ABI = [
            "function deposit() payable",
            "function withdraw(uint256 amount)",
            ...this.ERC20ABI
        ];

        this.SWAP_ROUTER_ABI = [
            "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)"
        ];

        // Swap pairs
        this.swapPairs = [
            { from: "XOS", to: "WXOS" },
            { from: "WXOS", to: "XOS" },
            { from: "XOS", to: "USDC" },
            { from: "XOS", to: "BNB" },
            { from: "XOS", to: "SOL" },
            { from: "XOS", to: "JUP" }
        ];

        this.walletBalances = {};
        this.transactionQueue = Promise.resolve();
        this.transactionId = 0;
    }

    printHeader() {
        console.log(BANNER);
    }

    printStatusInfo(accountsCount) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${colors.CYAN}Timestamp      : ${timestamp}${colors.RESET}`);
        console.log(`${colors.CYAN}Status         : Starting combined automation...${colors.RESET}`);
        console.log(`${colors.CYAN}Accounts       : ${accountsCount} active${colors.RESET}`);
        console.log(`${colors.YELLOW}───────────────────────────────────────────────────────────────────────────────────────────${colors.RESET}`);
    }

    printAccountHeader(maskedAddress) {
        console.log(`\n${colors.CYAN}[ Processing Account: ${maskedAddress} ]${colors.RESET}`);
    }

    log(message, status = "info") {
        const timestamp = new Date().toLocaleTimeString();
        
        if (message.includes(":")) {
            const parts = message.split(":", 2);
            const action = parts[0].trim();
            const result = parts[1] ? parts[1].trim() : "";
            
            let resultColor = colors.WHITE;
            if (result.toLowerCase().includes("success") || result.toLowerCase().includes("claimed") || result.toLowerCase().includes("completed")) {
                resultColor = colors.GREEN;
            } else if (result.toLowerCase().includes("failed") || result.toLowerCase().includes("insufficient") || result.toLowerCase().includes("error")) {
                resultColor = colors.RED;
            } else if (result.toLowerCase().includes("skipped") || result.toLowerCase().includes("already") || result.toLowerCase().includes("disabled")) {
                resultColor = colors.YELLOW;
            }
            
            const actionFormatted = action.padEnd(20);
            console.log(`${colors.CYAN}[${timestamp}] ${actionFormatted} : ${resultColor}${result}${colors.RESET}`);
        } else {
            console.log(`${colors.CYAN}[${timestamp}] ${message}${colors.RESET}`);
        }
    }

    printSeparator() {
        console.log(`${colors.YELLOW}───────────────────────────────────────────────────────────────────────────────────────────${colors.RESET}`);
    }

    generateAddress(privateKey) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            return wallet.address;
        } catch (error) {
            return null;
        }
    }

    async generatePayload(privateKey, address, message) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            const signature = await wallet.signMessage(message);
            return {
                walletAddress: address,
                signMessage: message,
                signature: signature,
                referrer: this.REF_CODE
            };
        } catch (error) {
            throw new Error(`Failed to create payload: ${error.message}`);
        }
    }

    maskAccount(account) {
        try {
            return account.substring(0, 6) + '******' + account.substring(account.length - 6);
        } catch (error) {
            return null;
        }
    }

    formatBalance(balance) {
        return parseFloat(balance).toFixed(6).replace(/\.?0+$/, '');
    }

    getRandomAmount() {
        const amount = Math.random() * (this.CONFIG.MAX_SWAP - this.CONFIG.MIN_SWAP) + this.CONFIG.MIN_SWAP;
        return parseFloat(amount.toFixed(6));
    }

    getRandomDelay() {
        const delay = Math.floor(Math.random() * (this.CONFIG.MAX_DELAY - this.CONFIG.MIN_DELAY + 1)) + this.CONFIG.MIN_DELAY;
        return Math.floor(delay / 1000);
    }

    async httpRequest(method, url, options = {}) {
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const config = {
                    method: method,
                    url: url,
                    timeout: 60000,
                    ...options
                };
                
                const response = await axios(config);
                return response.data;
            } catch (error) {
                if (attempt < 4) {
                    await this.sleep(5000);
                    continue;
                }
                this.log(`HTTP request failed: ${error.message}`);
            }
        }
        return null;
    }

    // ===== LOGIN & DAILY TASKS FUNCTIONS =====
    async processVerifySignature(privateKey, address) {
        const messageData = await this.httpRequest('get', `${this.BASE_API}/get-sign-message2?walletAddress=${address}`, {
            headers: this.baseHeaders
        });
        
        if (!messageData) {
            this.log("Login: Failed to get message");
            return false;
        }
        
        const message = messageData.message;
        const payload = await this.generatePayload(privateKey, address, message);
        const verifyData = await this.httpRequest('post', `${this.BASE_API}/verify-signature2`, {
            headers: this.baseHeaders,
            data: payload
        });
        
        if (verifyData && verifyData.token) {
            this.tokens[address] = verifyData.token;
            this.log("Login: Success");
            return true;
        } else {
            this.log("Login: Failed");
            return false;
        }
    }

    async processCheckinDraw(address) {
        const authHeaders = { ...this.baseHeaders, "Authorization": `Bearer ${this.tokens[address]}` };
        
        const user = await this.httpRequest('get', `${this.BASE_API}/me`, { headers: authHeaders });
        if (user) {
            const balance = user.data?.points || 0;
            this.log(`Points: ${balance}`);
        }
        
        const claim = await this.httpRequest('post', `${this.BASE_API}/check-in`, {
            headers: authHeaders,
            data: {}
        });
        
        if (claim && claim.success === true) {
            const days = claim.check_in_count;
            const reward = claim.pointsEarned;
            this.log(`Daily Check-in: Day ${days} claimed - Reward: ${reward} PTS`);
        } else if (claim && claim.error === "Already checked in today") {
            this.log("Daily Check-in: Already completed");
        }

        const userAfter = await this.httpRequest('get', `${this.BASE_API}/me`, { headers: authHeaders });
        if (userAfter) {
            const currentDraw = userAfter.data?.currentDraws || 0;
            if (currentDraw > 0) {
                this.log(`Garapon Draw: ${currentDraw} draws available`);
                for (let i = 0; i < currentDraw; i++) {
                    const draw = await this.httpRequest('post', `${this.BASE_API}/draw`, {
                        headers: authHeaders,
                        data: {}
                    });
                    if (draw && draw.message === "Draw successful") {
                        const reward = draw.pointsEarned;
                        this.log(`Garapon Draw: Draw ${i + 1} successful - Reward: ${reward} PTS`);
                    } else {
                        break;
                    }
                }
            } else {
                this.log("Garapon Draw: No draws available");
            }
        }
    }

    // ===== AUTO SWAP FUNCTIONS =====
    async getTokenBalance(tokenAddress, walletAddress, provider) {
        try {
            if (tokenAddress === 'XOS') {
                const balance = await provider.getBalance(walletAddress);
                return ethers.utils.formatEther(balance);
            }
            
            // Validate address format before creating contract
            if (!ethers.utils.isAddress(tokenAddress)) {
                this.log(`Invalid token address: ${tokenAddress}`, "error");
                return "0";
            }
            
            const contract = new ethers.Contract(tokenAddress, this.ERC20ABI, provider);
            const balance = await contract.balanceOf(walletAddress);
            const decimals = await contract.decimals();
            return ethers.utils.formatUnits(balance, decimals);
        } catch (error) {
            this.log(`Failed to get token balance for ${tokenAddress}: ${error.message}`, "error");
            return "0";
        }
    }

    async updateBalances(wallet, provider) {
        try {
            // Get balances with proper error handling for each token
            const balancePromises = [
                { symbol: 'XOS', address: 'XOS' },
                { symbol: 'WXOS', address: this.CONFIG.WXOS_ADDRESS },
                { symbol: 'USDC', address: this.CONFIG.USDC_ADDRESS },
                { symbol: 'BNB', address: this.CONFIG.BNB_ADDRESS },
                { symbol: 'JUP', address: this.CONFIG.JUP_ADDRESS },
                { symbol: 'SOL', address: this.CONFIG.SOL_ADDRESS }
            ];

            for (const token of balancePromises) {
                try {
                    this.walletBalances[token.symbol] = await this.getTokenBalance(token.address, wallet.address, provider);
                } catch (error) {
                    this.log(`Failed to get ${token.symbol} balance: ${error.message}`, "error");
                    this.walletBalances[token.symbol] = "0";
                }
            }
            
            const balanceStr = `XOS=${this.formatBalance(this.walletBalances.XOS)}, WXOS=${this.formatBalance(this.walletBalances.WXOS)}, USDC=${this.formatBalance(this.walletBalances.USDC)}, BNB=${this.formatBalance(this.walletBalances.BNB)}, JUP=${this.formatBalance(this.walletBalances.JUP)}, SOL=${this.formatBalance(this.walletBalances.SOL)}`;
            this.log(`Balances: ${balanceStr}`);
        } catch (error) {
            this.log(`Failed to update balances: ${error.message}`, "error");
        }
    }

    async swapXosToWxos(amount, wallet) {
        const formattedAmount = amount.toFixed(6);
        const wxosContract = new ethers.Contract(this.CONFIG.WXOS_ADDRESS, this.WXOS_ABI, wallet);
        const amountWei = ethers.utils.parseEther(formattedAmount);
        
        const xosBalance = parseFloat(this.walletBalances.XOS);
        if (xosBalance < amount) {
            this.log(`Swap XOS→WXOS: Insufficient balance ${xosBalance} < ${amount}`);
            return false;
        }
        
        try {
            this.log(`Swap XOS→WXOS: ${formattedAmount} XOS`);
            const tx = await wxosContract.deposit({ 
                value: amountWei, 
                gasLimit: ethers.BigNumber.from("100000")
            });
            this.log(`Swap XOS→WXOS: Success - TX: ${tx.hash}`);
            await tx.wait();
            return true;
        } catch (error) {
            this.log(`Swap XOS→WXOS: Failed - ${error.message}`);
            return false;
        }
    }

    async swapWxosToXos(amount, wallet) {
        const formattedAmount = parseFloat(amount).toFixed(6);
        const wxosContract = new ethers.Contract(this.CONFIG.WXOS_ADDRESS, this.WXOS_ABI, wallet);
        const amountWei = ethers.utils.parseEther(formattedAmount);
        
        const wxosBalance = parseFloat(this.walletBalances.WXOS);
        if (wxosBalance < amount) {
            this.log(`Swap WXOS→XOS: Insufficient balance ${wxosBalance} < ${amount}`);
            return false;
        }
        
        try {
            this.log(`Swap WXOS→XOS: ${formattedAmount} WXOS`);
            const tx = await wxosContract.withdraw(amountWei, { 
                gasLimit: ethers.BigNumber.from("100000")
            });
            this.log(`Swap WXOS→XOS: Success - TX: ${tx.hash}`);
            await tx.wait();
            return true;
        } catch (error) {
            this.log(`Swap WXOS→XOS: Failed - ${error.message}`);
            return false;
        }
    }

    async executeSwap(pair, wallet, provider) {
        try {
            const { from, to } = pair;
            const amount = this.getRandomAmount();
            
            this.log(`Starting swap: ${amount} ${from} → ${to}`);
            
            if (from === 'XOS' && to === 'WXOS') {
                return await this.swapXosToWxos(amount, wallet);
            } else if (from === 'WXOS' && to === 'XOS') {
                return await this.swapWxosToXos(amount, wallet);
            } else {
                // For other token swaps, we'll wrap XOS first if needed
                if (from === 'XOS') {
                    const wrapSuccess = await this.swapXosToWxos(amount, wallet);
                    if (!wrapSuccess) return false;
                    
                    await this.updateBalances(wallet, provider);
                    await this.sleep(2000);
                    
                    // Then swap WXOS to target token
                    return await this.swapTokens('WXOS', to, amount, wallet);
                }
                return await this.swapTokens(from, to, amount, wallet);
            }
        } catch (error) {
            this.log(`Swap execution error: ${error.message}`, "error");
            return false;
        }
    }

    async swapTokens(tokenIn, tokenOut, amount, wallet) {
        const tokenInAddress = this.getTokenAddress(tokenIn);
        const tokenOutAddress = this.getTokenAddress(tokenOut);
        
        if (!tokenInAddress || !tokenOutAddress) {
            this.log(`Invalid token pair: ${tokenIn} ↔ ${tokenOut}`);
            return false;
        }
        
        try {
            const tokenInContract = new ethers.Contract(tokenInAddress, this.ERC20ABI, wallet);
            const swapRouter = new ethers.Contract(this.SWAP_ROUTER_ADDRESS, this.SWAP_ROUTER_ABI, wallet);
            
            const decimalsIn = await tokenInContract.decimals();
            const amountWei = ethers.utils.parseUnits(amount.toString(), decimalsIn);
            
            // Check and approve if needed
            const allowance = await tokenInContract.allowance(wallet.address, this.SWAP_ROUTER_ADDRESS);
            if (allowance.lt(amountWei)) {
                this.log(`Approving ${tokenIn}...`);
                const approveTx = await tokenInContract.approve(this.SWAP_ROUTER_ADDRESS, ethers.constants.MaxUint256);
                await approveTx.wait();
            }
            
            const swapParams = {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                fee: 500,
                recipient: wallet.address,
                amountIn: amountWei,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            };
            
            this.log(`Swap ${tokenIn}→${tokenOut}: ${amount} ${tokenIn}`);
            const tx = await swapRouter.exactInputSingle(swapParams);
            this.log(`Swap ${tokenIn}→${tokenOut}: Success - TX: ${tx.hash}`);
            await tx.wait();
            return true;
        } catch (error) {
            this.log(`Swap ${tokenIn}→${tokenOut}: Failed - ${error.message}`);
            return false;
        }
    }

    getTokenAddress(token) {
        const addresses = {
            'WXOS': this.CONFIG.WXOS_ADDRESS,
            'USDC': this.CONFIG.USDC_ADDRESS,
            'BNB': this.CONFIG.BNB_ADDRESS,
            'SOL': this.CONFIG.SOL_ADDRESS,
            'JUP': this.CONFIG.JUP_ADDRESS
        };
        return addresses[token] || null;
    }

    async runAutoSwap(privateKey) {
        try {
            this.log("Starting Auto Swap...");
            
            const provider = new ethers.providers.JsonRpcProvider(this.CONFIG.RPC_URL_XOS);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            await this.updateBalances(wallet, provider);
            
            for (let i = 0; i < this.CONFIG.ITERATIONS; i++) {
                this.log(`--- Swap Iteration ${i + 1}/${this.CONFIG.ITERATIONS} ---`);
                
                const pairIndex = Math.floor(Math.random() * this.swapPairs.length);
                let pair = this.swapPairs[pairIndex];
                
                // Alternate direction every few swaps
                if (i > 0 && i % 2 === 0) {
                    pair = { from: pair.to, to: pair.from };
                }
                
                await this.updateBalances(wallet, provider);
                
                const success = await this.executeSwap(pair, wallet, provider);
                
                if (success) {
                    this.log(`Swap ${i + 1}: Completed successfully`);
                } else {
                    this.log(`Swap ${i + 1}: Failed`);
                }
                
                await this.updateBalances(wallet, provider);
                
                if (i < this.CONFIG.ITERATIONS - 1) {
                    const delay = this.getRandomDelay();
                    this.log(`Waiting ${delay} seconds...`);
                    await this.sleep(delay * 1000);
                }
            }
            
            this.log("Auto Swap: Completed all iterations");
        } catch (error) {
            this.log(`Auto Swap Error: ${error.message}`);
        }
    }

    // ===== MAIN PROCESS FUNCTIONS =====
    async processSingleAccount(privateKey) {
        const address = this.generateAddress(privateKey);
        if (!address) {
            this.log("Error: Invalid private key");
            return;
        }

        const maskedAddress = this.maskAccount(address);
        this.printAccountHeader(maskedAddress);
        
        // Phase 1: Login and Daily Tasks
        this.log("=== Phase 1: Login & Daily Tasks ===");
        if (await this.processVerifySignature(privateKey, address)) {
            await this.processCheckinDraw(address);
        }
        
        await this.sleep(3000);
        
        // Phase 2: Auto Swap
        this.log("=== Phase 2: Auto Swap ===");
        await this.runAutoSwap(privateKey);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async main() {
        try {
            console.clear();
            this.printHeader();
            
            const accountsData = await fs.readFile('privatekey.txt', 'utf8');
            const accounts = accountsData.split('\n').map(line => line.trim()).filter(line => line);

            const accountsCount = accounts.length;
            this.printStatusInfo(accountsCount);

            while (true) {
                for (let i = 0; i < accounts.length; i++) {
                    const account = accounts[i];
                    if (account) {
                        await this.processSingleAccount(account);
                        this.printSeparator();
                        await this.sleep(5000);
                    }
                }

                this.log("All accounts processed. Waiting 24 hours...");
                await this.sleep(24 * 60 * 60 * 1000); // 24 hours
            }

        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log("Error: accounts.txt not found");
            } else {
                this.log(`Error: ${error.message}`);
            }
        }
    }
}

// Export and run
const bot = new XOSCombinedBot();

process.on('SIGINT', () => {
    console.log(`\n${colors.RED}Bot stopped by user${colors.RESET}`);
    process.exit(0);
});

bot.main().catch(error => {
    console.error(`${colors.RED}Unhandled error: ${error.message}${colors.RESET}`);
    process.exit(1);
});

export default XOSCombinedBot;