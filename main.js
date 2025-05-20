const fs = require("fs");
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const { HttpsProxyAgent } = require("https-proxy-agent");
const readline = require("readline");
const user_agents = require("./config/userAgents");
const settings = require("./config/config.js");
const { sleep, loadData, getRandomNumber, saveToken, isTokenExpired, saveJson, getRandomElement, parseProxyUrl } = require("./utils/utils.js");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { checkBaseUrl } = require("./checkAPI");
const headers = require("./core/header.js");
const { showBanner } = require("./core/banner.js");
const localStorage = require("./localStorage.json");
const ethers = require("ethers");
const { solveCaptcha } = require("./utils/captcha.js");
const { checkBalance, registerOpenID, swapTokens } = require("./utils/contract.js");

// const refcodes = loadData("reffCodes.txt");
let REF_CODE = settings.REF_CODE;
class ClientAPI {
  constructor(itemData, accountIndex, proxy, baseURL) {
    this.headers = headers;
    this.baseURL = baseURL;
    this.baseURL_v2 = "";
    this.localItem = null;
    this.itemData = itemData;
    this.accountIndex = accountIndex;
    this.proxy = proxy;
    this.proxyIP = null;
    this.session_name = null;
    this.session_user_agents = this.#load_session_data();
    this.token = null;
    this.localStorage = localStorage;
    this.wallet = new ethers.Wallet(this.itemData.privateKey);
    this.provider = new ethers.JsonRpcProvider(settings.RPC_URL);
  }

  #load_session_data() {
    try {
      const filePath = path.join(process.cwd(), "session_user_agents.json");
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      } else {
        throw error;
      }
    }
  }

  #get_random_user_agent() {
    const randomIndex = Math.floor(Math.random() * user_agents.length);
    return user_agents[randomIndex];
  }

  #get_user_agent() {
    if (this.session_user_agents[this.session_name]) {
      return this.session_user_agents[this.session_name];
    }

    console.log(`[Tài khoản ${this.accountIndex + 1}] Tạo user agent...`.blue);
    const newUserAgent = this.#get_random_user_agent();
    this.session_user_agents[this.session_name] = newUserAgent;
    this.#save_session_data(this.session_user_agents);
    return newUserAgent;
  }

  #save_session_data(session_user_agents) {
    const filePath = path.join(process.cwd(), "session_user_agents.json");
    fs.writeFileSync(filePath, JSON.stringify(session_user_agents, null, 2));
  }

  #get_platform(userAgent) {
    const platformPatterns = [
      { pattern: /iPhone/i, platform: "ios" },
      { pattern: /Android/i, platform: "android" },
      { pattern: /iPad/i, platform: "ios" },
    ];

    for (const { pattern, platform } of platformPatterns) {
      if (pattern.test(userAgent)) {
        return platform;
      }
    }

    return "Unknown";
  }

  #set_headers() {
    const platform = this.#get_platform(this.#get_user_agent());
    this.headers["sec-ch-ua"] = `Not)A;Brand";v="99", "${platform} WebView";v="127", "Chromium";v="127`;
    this.headers["sec-ch-ua-platform"] = platform;
    this.headers["User-Agent"] = this.#get_user_agent();
  }

  createUserAgent() {
    try {
      this.session_name = this.itemData.address;
      this.#get_user_agent();
    } catch (error) {
      this.log(`Can't create user agent: ${error.message}`, "error");
      return;
    }
  }

  async log(msg, type = "info") {
    const accountPrefix = `[XOS][${this.accountIndex + 1}][${this.itemData.address}]`;
    let ipPrefix = "[Local IP]";
    if (settings.USE_PROXY) {
      ipPrefix = this.proxyIP ? `[${this.proxyIP}]` : "[Unknown IP]";
    }
    let logMessage = "";

    switch (type) {
      case "success":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.green;
        break;
      case "error":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.red;
        break;
      case "warning":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.yellow;
        break;
      case "custom":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.magenta;
        break;
      default:
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.blue;
    }
    console.log(logMessage);
  }

  async checkProxyIP() {
    try {
      const proxyAgent = new HttpsProxyAgent(this.proxy);
      const response = await axios.get("https://api.ipify.org?format=json", { httpsAgent: proxyAgent });
      if (response.status === 200) {
        this.proxyIP = response.data.ip;
        return response.data.ip;
      } else {
        throw new Error(`Cannot check proxy IP. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error checking proxy IP: ${error.message}`);
    }
  }

  async makeRequest(
    url,
    method,
    data = {},
    options = {
      retries: 2,
      isAuth: false,
      extraHeaders: {},
      refreshToken: null,
    }
  ) {
    const { retries, isAuth, extraHeaders, refreshToken } = options;

    const headers = {
      ...this.headers,
      ...extraHeaders,
    };

    if (!isAuth && this.token) {
      headers["authorization"] = `Bearer ${this.token}`;
    }

    let proxyAgent = null;
    if (settings.USE_PROXY) {
      proxyAgent = new HttpsProxyAgent(this.proxy);
    }
    let currRetries = 0,
      errorMessage = null,
      errorStatus = 0;

    do {
      try {
        const response = await axios({
          method,
          url,
          headers,
          timeout: 120000,
          ...(proxyAgent ? { httpsAgent: proxyAgent, httpAgent: proxyAgent } : {}),
          ...(method.toLowerCase() != "get" ? { data } : {}),
        });
        if (response?.data?.data) return { status: response.status, success: true, data: response.data.data, error: null };
        return { success: true, data: response.data, status: response.status, error: null };
      } catch (error) {
        errorStatus = error.status;
        errorMessage = error?.response?.data?.message ? error?.response?.data : error.message;
        this.log(`Request failed: ${url} | Status: ${error.status} | ${JSON.stringify(errorMessage || {})}...`, "warning");

        if (error.message.includes("stream has been aborted")) {
          return { success: false, status: error.status, data: null, error: error.response.data.error || error.response.data.message || error.message };
        }

        if (error.status == 401) {
          this.log(`Unauthorized: ${url} | trying get new token...`, "warning");
          const token = await this.getValidToken(true);
          if (token) {
            process.exit(0);
          }
          this.token = token;
          return await this.makeRequest(url, method, data, options);
        }
        if (error.status == 400) {
          this.log(`Invalid request for ${url}, maybe have new update from server | contact: https://t.me/airdrophuntersieutoc to get new update!`, "error");
          return { success: false, status: error.status, error: errorMessage, data: null };
        }
        if (error.status == 429) {
          this.log(`Rate limit ${JSON.stringify(errorMessage)}, waiting 60s to retries`, "warning");
          await sleep(60);
        }
        if (currRetries > retries) {
          return { status: error.status, success: false, error: errorMessage, data: null };
        }
        currRetries++;
        await sleep(5);
      }
    } while (currRetries <= retries);
    return { status: errorStatus, success: false, error: errorMessage, data: null };
  }

  async auth() {
    const res = await this.getNonce();
    if (!res?.data?.message) return { success: false, error: "Can't get nonce" };
    const signedMessage = await this.wallet.signMessage(res.data.message);

    const payload = {
      walletAddress: this.itemData.address,
      signMessage: res.data.message,
      signature: signedMessage,
      referrer: settings.REF_CODE,
    };

    return this.makeRequest(`${this.baseURL}/verify-signature2`, "post", payload, { isAuth: true });
  }

  async getNonce() {
    return this.makeRequest(`${this.baseURL}/get-sign-message2?walletAddress=${this.itemData.address}`, "get", null, { isAuth: true });
  }

  async getUserData() {
    return this.makeRequest(`${this.baseURL}/me`, "get");
  }
  async checkin() {
    return this.makeRequest(`${this.baseURL}/check-in`, "post", {});
  }

  async getSpin() {
    return this.makeRequest(`${this.baseURL}/my-spinRecords`, "get");
  }

  async spin() {
    return this.makeRequest(`${this.baseURL}/draw`, "post", {});
  }

  async checkAddressEligibility() {
    return this.makeRequest(`https://faucet.x.ink/api/checkAddressEligibility?address=${this.itemData.address}`, "get", null, {
      extraHeaders: {
        origin: "https://faucet.x.ink",
      },
    });
  }

  async faucet() {
    this.log(`Solving captcha...`);
    let captchaToken = null;
    if (settings.TYPE_CAPTCHA == "monstercaptcha") {
      const proxyData = parseProxyUrl(this.proxy);
      if (!proxyData) return { success: false };
      captchaToken = await solveCaptcha(
        {
          websiteURL: settings.CAPTCHA_URL,
          websiteKey: settings.WEBSITE_KEY,
        },
        proxyData
      );
    } else {
      captchaToken = await solveCaptcha();
    }
    if (!captchaToken) {
      return { success: false };
    }

    return this.makeRequest(
      `https://faucet.x.ink/api/sendToken`,
      "post",
      {
        address: this.itemData.address,
        token: "",
        v2Token: captchaToken,
        chain: "XOS",
        couponId: "",
      },
      {
        extraHeaders: {
          origin: "https://faucet.x.ink",
        },
      }
    );
  }

  async handleFaucet() {
    this.log(`Staring faucet...`);
    const resGet = await this.checkAddressEligibility();
    if (!resGet.success || !resGet?.data?.canClaim) {
      this.log(resGet?.data?.message || `This wallet can't claim tokens daily`, "warning");
      return;
    }
    const res = await this.faucet();
    if (res.success && res.data?.txHash) {
      this.log(`Faucet success! TX: https://testnet.xoscan.io/tx/${res.data.txHash}`, "success");
    } else {
      this.log(`Faucet failed: ${JSON.stringify(res)}`, "warning");
    }
  }

  async getValidToken(isNew = false) {
    const existingToken = this.token;
    const { isExpired: isExp, expirationDate } = isTokenExpired(existingToken);

    this.log(`Access token status: ${isExp ? "Expired".yellow : "Valid".green} | Acess token exp: ${expirationDate}`);
    if (existingToken && !isNew && !isExp) {
      this.log("Using valid token", "success");
      return existingToken;
    }

    this.log("No found token or experied, trying get new token...", "warning");
    const loginRes = await this.auth();
    if (!loginRes.success) {
      this.log(`Auth failed: ${JSON.stringify(loginRes)}`, "error");
      return null;
    }
    const newToken = loginRes.data;
    if (newToken?.token) {
      await saveJson(this.session_name, JSON.stringify(newToken), "localStorage.json");
      this.localItem = newToken;
      return newToken.token;
    }
    this.log("Can't get new token...", "warning");
    return null;
  }

  isCheckedInToday(lastCheckIn) {
    if (!lastCheckIn) {
      return false; // Or true, depending on how you want to handle null/undefined
    }

    const lastCheckInDate = new Date(lastCheckIn);
    const today = new Date();

    const lastCheckInUTCDate = new Date(lastCheckInDate.getUTCFullYear(), lastCheckInDate.getUTCMonth(), lastCheckInDate.getUTCDate());
    const todayUTCDate = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

    return lastCheckInUTCDate.getTime() === todayUTCDate.getTime();
  }

  async handleCheckIn(userData) {
    const lastCheckIn = userData.lastCheckIn;
    if (!this.isCheckedInToday(lastCheckIn)) {
      const checkinResult = await this.checkin();
      if (checkinResult.success) {
        this.log(`Checkin successfully!`, "success");
      } else {
        this.log("Checkin failed!", "warning");
      }
    } else {
      this.log(`You checked in today!`, "warning");
    }
  }

  async handleSyncData() {
    this.log(`Sync data...`);
    let userData = { success: false, data: null, status: 0 },
      retries = 0;
    do {
      userData = await this.getUserData();
      if (userData?.success) break;
      retries++;
    } while (retries < 1 && userData.status !== 400);
    const WXOS_ADDRESS = "0x0aab67cf6f2e99847b9a95dec950b250d648c1bb";
    const USDC_ADDRESS = "0xb2c1c007421f0eb5f4b3b3f38723c309bb208d7d";
    const BONK_ADDRESS = "0x00309602f7977d45322279c4dd5cf61d16fd061b";
    const BNB_ADDRESS = "0x83dfbe02dc1b1db11bc13a8fc7fd011e2dbbd7c0";
    const JUP_ADDRESS = "0x26b597804318824a2e88cd717376f025e6bb2219";
    const xos = await checkBalance(this.itemData.privateKey, null, this.provider);
    const USDC = await checkBalance(this.itemData.privateKey, USDC_ADDRESS, this.provider);
    const WXOS = await checkBalance(this.itemData.privateKey, WXOS_ADDRESS, this.provider);
    const BNB = await checkBalance(this.itemData.privateKey, BNB_ADDRESS, this.provider);
    const JUP = await checkBalance(this.itemData.privateKey, JUP_ADDRESS, this.provider);
    const BONK = await checkBalance(this.itemData.privateKey, BONK_ADDRESS, this.provider);

    if (userData?.success) {
      const { check_in_count, points, currentDraws } = userData.data;
      this.log(`XOS: ${xos} | USDC: ${USDC} | WXOS: ${WXOS} | BNB: ${BNB} | JUP: ${JUP} | BONK: ${BONK} | Days Checkin: ${check_in_count} | Points: ${points}`, "custom");
    } else {
      this.log("Can't sync new data...skipping", "warning");
    }
    return userData;
  }

  async handleDraws(userData) {
    const currentDraws = userData?.currentDraws || 0;
    if (currentDraws > 0) {
      let amountSpin = currentDraws;
      while (amountSpin > 0) {
        await sleep(1);
        amountSpin--;
        const resSpin = await this.spin();
        if (resSpin.success) {
          this.log(`Spinning success: + ${resSpin.data?.pointsEarned} points`, "success");
        }
      }
    }
  }

  async handleOnchain(userData) {
    if (settings.AUTO_REGISTER_OPEN_ID) {
      await registerOpenID(this.itemData.privateKey, this.provider);
    }
    if (settings.AUTO_SWAP) await swapTokens(this.itemData.privateKey, this.provider);
  }

  async handleConnectRPC() {
    const agent = new HttpsProxyAgent(this.proxy);
    let retries = 3;
    for (let i = 1; i <= retries; i++) {
      try {
        const res = new ethers.JsonRpcProvider(settings.RPC_URL, {
          name: "XOS",
          chainId: Number(settings.CHAIN_ID),
          agent: agent,
        });
        this.provider = res;
        this.log(`[${i}/${retries}] Connect RPC successs!`, "success");
        return true;
      } catch (error) {
        this.log(`[${i}/${retries}] Can't connect RPC: ${error.message}`, "warning");
        if (i > retries) {
          return null;
        } else {
          this.log(`[${i}/${retries}] Trying reconnect RPC`, "info");
          await sleep(1);
        }
      }
    }
  }
  async runAccount() {
    const accountIndex = this.accountIndex;
    this.session_name = this.itemData.address;
    this.localItem = JSON.parse(this.localStorage[this.session_name] || "{}");
    this.token = this.localItem?.token;
    this.#set_headers();
    if (settings.USE_PROXY) {
      try {
        this.proxyIP = await this.checkProxyIP();
        if (settings.USE_PROXY_FOR_RPC) {
          await this.handleConnectRPC();
        }
      } catch (error) {
        this.log(`Cannot check proxy IP ${this.proxy}: ${error.message}`, "warning");
        return;
      }
      const timesleep = getRandomNumber(settings.DELAY_START_BOT[0], settings.DELAY_START_BOT[1]);
      console.log(`=========Tài khoản ${accountIndex + 1} | ${this.proxyIP} | Bắt đầu sau ${timesleep} giây...`.green);
      await sleep(timesleep);
    }

    const token = await this.getValidToken();
    if (!token) return;
    this.token = token;

    const userData = await this.handleSyncData();
    if (userData.success) {
      if (userData.data?.twitter?.id || userData.data?.discord?.id) {
        await sleep(1);
        await this.handleCheckIn(userData.data);
        await sleep(1);
        await this.handleDraws(userData.data);
      } else {
        this.log(`You need bind X or Discord to checkin`, "warning");
      }

      if (settings.AUTO_FAUCET) {
        await this.handleFaucet();
      }
      await sleep(1);
      await this.handleOnchain(userData.data);
    } else {
      return this.log("Can't get use info...skipping", "error");
    }
  }
}

async function runWorker(workerData) {
  const { itemData, accountIndex, proxy, hasIDAPI } = workerData;
  const to = new ClientAPI(itemData, accountIndex, proxy, hasIDAPI);
  try {
    await Promise.race([to.runAccount(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 24 * 60 * 60 * 1000))]);
    parentPort.postMessage({
      accountIndex,
    });
  } catch (error) {
    parentPort.postMessage({ accountIndex, error: error.message });
  } finally {
    if (!isMainThread) {
      parentPort.postMessage("taskComplete");
    }
  }
}

async function main() {
  console.clear();
  showBanner();
  const privateKeys = loadData("privateKeys.txt");
  const proxies = loadData("proxy.txt");

  if (privateKeys.length == 0 || (privateKeys.length > proxies.length && settings.USE_PROXY)) {
    console.log("Số lượng proxy và data phải bằng nhau.".red);
    console.log(`Data: ${privateKeys.length}`);
    console.log(`Proxy: ${proxies.length}`);
    process.exit(1);
  }
  if (!settings.USE_PROXY) {
    console.log(`You are running bot without proxies!!!`.yellow);
  }
  let maxThreads = settings.USE_PROXY ? settings.MAX_THEADS : settings.MAX_THEADS_NO_PROXY;

  const resCheck = await checkBaseUrl();
  if (!resCheck.endpoint) return console.log(`Không thể tìm thấy ID API, có thể lỗi kết nỗi, thử lại sau!`.red);
  console.log(`${resCheck.message}`.yellow);

  const data = privateKeys.map((val, index) => {
    const prvk = val.startsWith("0x") ? val : `0x${val}`;
    const wallet = new ethers.Wallet(prvk);
    const item = {
      address: wallet.address,
      privateKey: prvk,
    };
    new ClientAPI(item, index, proxies[index], resCheck.endpoint, {}).createUserAgent();
    return item;
  });
  await sleep(1);
  while (true) {
    let currentIndex = 0;
    const errors = [];
    while (currentIndex < data.length) {
      const workerPromises = [];
      const batchSize = Math.min(maxThreads, data.length - currentIndex);
      for (let i = 0; i < batchSize; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            hasIDAPI: resCheck.endpoint,
            itemData: data[currentIndex],
            accountIndex: currentIndex,
            proxy: proxies[currentIndex % proxies.length],
          },
        });

        workerPromises.push(
          new Promise((resolve) => {
            worker.on("message", (message) => {
              if (message === "taskComplete") {
                worker.terminate();
              }
              if (settings.ENABLE_DEBUG) {
                console.log(message);
              }
              resolve();
            });
            worker.on("error", (error) => {
              console.log(`Lỗi worker cho tài khoản ${currentIndex}: ${error?.message}`);
              worker.terminate();
              resolve();
            });
            worker.on("exit", (code) => {
              worker.terminate();
              if (code !== 0) {
                errors.push(`Worker cho tài khoản ${currentIndex} thoát với mã: ${code}`);
              }
              resolve();
            });
          })
        );

        currentIndex++;
      }

      await Promise.all(workerPromises);

      if (errors.length > 0) {
        errors.length = 0;
      }

      if (currentIndex < data.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    await sleep(3);
    console.log(`=============${new Date().toLocaleString()} | Hoàn thành tất cả tài khoản | Chờ ${settings.TIME_SLEEP} phút=============`.magenta);
    showBanner();
    await sleep(settings.TIME_SLEEP * 60);
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.log("Lỗi rồi:", error);
    process.exit(1);
  });
} else {
  runWorker(workerData);
}
