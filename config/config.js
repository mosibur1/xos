require("dotenv").config();
const { _isArray } = require("../utils/utils.js");

const settings = {
  TIME_SLEEP: process.env.TIME_SLEEP ? parseInt(process.env.TIME_SLEEP) : 8,
  MAX_THEADS: process.env.MAX_THEADS ? parseInt(process.env.MAX_THEADS) : 10,
  MAX_THEADS_NO_PROXY: process.env.MAX_THEADS_NO_PROXY ? parseInt(process.env.MAX_THEADS_NO_PROXY) : 10,
  AMOUNT_REF: process.env.AMOUNT_REF ? parseInt(process.env.AMOUNT_REF) : 100,
  NUMBER_PER_REF: process.env.NUMBER_PER_REF ? parseInt(process.env.NUMBER_PER_REF) : 100,

  SKIP_TASKS: process.env.SKIP_TASKS ? JSON.parse(process.env.SKIP_TASKS.replace(/'/g, '"')) : [],
  TOKENS_SWAP: process.env.TOKENS_SWAP ? JSON.parse(process.env.TOKENS_SWAP.replace(/'/g, '"')) : [],
  TASKS_ID: process.env.TASKS_ID ? JSON.parse(process.env.TASKS_ID.replace(/'/g, '"')) : [],

  AUTO_TASK: process.env.AUTO_TASK ? process.env.AUTO_TASK.toLowerCase() === "true" : false,
  AUTO_CHALLENGE: process.env.AUTO_CHALLENGE ? process.env.AUTO_CHALLENGE.toLowerCase() === "true" : false,
  ENABLE_MAP_RANGE_CHALLENGE: process.env.ENABLE_MAP_RANGE_CHALLENGE ? process.env.ENABLE_MAP_RANGE_CHALLENGE.toLowerCase() === "true" : false,

  AUTO_SHOW_COUNT_DOWN_TIME_SLEEP: process.env.AUTO_SHOW_COUNT_DOWN_TIME_SLEEP ? process.env.AUTO_SHOW_COUNT_DOWN_TIME_SLEEP.toLowerCase() === "true" : false,
  AUTO_CLAIM_BONUS: process.env.AUTO_CLAIM_BONUS ? process.env.AUTO_CLAIM_BONUS.toLowerCase() === "true" : false,
  ENABLE_ADVANCED_MERGE: process.env.ENABLE_ADVANCED_MERGE ? process.env.ENABLE_ADVANCED_MERGE.toLowerCase() === "true" : false,
  ENABLE_DEBUG: process.env.ENABLE_DEBUG ? process.env.ENABLE_DEBUG.toLowerCase() === "true" : false,

  USE_PROXY_FOR_RPC: process.env.USE_PROXY_FOR_RPC ? process.env.USE_PROXY_FOR_RPC.toLowerCase() === "true" : false,
  AUTO_BUY_PET: process.env.AUTO_BUY_PET ? process.env.AUTO_BUY_PET.toLowerCase() === "true" : false,
  AUTO_SELL_PET: process.env.AUTO_SELL_PET ? process.env.AUTO_SELL_PET.toLowerCase() === "true" : false,

  AUTO_STAKE: process.env.AUTO_STAKE ? process.env.AUTO_STAKE.toLowerCase() === "true" : false,

  ADVANCED_ANTI_DETECTION: process.env.ADVANCED_ANTI_DETECTION ? process.env.ADVANCED_ANTI_DETECTION.toLowerCase() === "true" : false,
  AUTO_TAP: process.env.AUTO_TAP ? process.env.AUTO_TAP.toLowerCase() === "true" : false,
  USE_PROXY: process.env.USE_PROXY ? process.env.USE_PROXY.toLowerCase() === "true" : false,
  AUTO_DAILY_COMBO: process.env.AUTO_DAILY_COMBO ? process.env.AUTO_DAILY_COMBO.toLowerCase() === "true" : false,
  AUTO_FAUCET: process.env.AUTO_FAUCET ? process.env.AUTO_FAUCET.toLowerCase() === "true" : false,
  AUTO_SWAP: process.env.AUTO_SWAP ? process.env.AUTO_SWAP.toLowerCase() === "true" : false,
  AUTO_REGISTER_OPEN_ID: process.env.AUTO_REGISTER_OPEN_ID ? process.env.AUTO_REGISTER_OPEN_ID.toLowerCase() === "true" : false,

  API_ID: process.env.API_ID ? process.env.API_ID : null,
  BASE_URL: process.env.BASE_URL ? process.env.BASE_URL : null,
  BASE_URL_v2: process.env.BASE_URL_v2 ? process.env.BASE_URL_v2 : null,
  REF_CODE: process.env.REF_CODE ? process.env.REF_CODE : "8S50BW",
  RPC_URL: process.env.RPC_URL ? process.env.RPC_URL : null,
  CHAIN_ID: process.env.CHAIN_ID ? process.env.CHAIN_ID : 1267,

  TYPE_CAPTCHA: process.env.TYPE_CAPTCHA ? process.env.TYPE_CAPTCHA : null,
  API_KEY_2CAPTCHA: process.env.API_KEY_2CAPTCHA ? process.env.API_KEY_2CAPTCHA : null,
  API_KEY_ANTI_CAPTCHA: process.env.API_KEY_ANTI_CAPTCHA ? process.env.API_KEY_ANTI_CAPTCHA : null,
  CAPTCHA_URL: process.env.CAPTCHA_URL ? process.env.CAPTCHA_URL : null,
  WEBSITE_KEY: process.env.WEBSITE_KEY ? process.env.WEBSITE_KEY : null,
  DAILY_COMBO: process.env.DAILY_COMBO ? process.env.DAILY_COMBO : null,

  DELAY_BETWEEN_REQUESTS: process.env.DELAY_BETWEEN_REQUESTS && _isArray(process.env.DELAY_BETWEEN_REQUESTS) ? JSON.parse(process.env.DELAY_BETWEEN_REQUESTS) : [1, 5],
  DELAY_START_BOT: process.env.DELAY_START_BOT && _isArray(process.env.DELAY_START_BOT) ? JSON.parse(process.env.DELAY_START_BOT) : [1, 15],
  PERCENT_STAKE: process.env.PERCENT_STAKE && _isArray(process.env.PERCENT_STAKE) ? JSON.parse(process.env.PERCENT_STAKE) : [1, 15],
  PERCENT_SWAP: process.env.PERCENT_SWAP && _isArray(process.env.PERCENT_SWAP) ? JSON.parse(process.env.PERCENT_SWAP) : [10, 15],
  AMOUNT_SWAP: process.env.AMOUNT_SWAP && _isArray(process.env.AMOUNT_SWAP) ? JSON.parse(process.env.AMOUNT_SWAP) : [10, 15],
  DELAY_SWAP: process.env.DELAY_SWAP && _isArray(process.env.DELAY_SWAP) ? JSON.parse(process.env.DELAY_SWAP) : [10, 15],
};

module.exports = settings;
