/**
 * KEESHA v1.0 - Serverless Personal Finance Bot
 * * A Google Apps Script bot that tracks expenses via Telegram and logs them to Google Sheets.
 * Features:
 * - Auto-captures bank emails (Gmail)
 * - "Reply to Tag" workflow
 * - Duplicate Message Shield
 * - Security Token Authentication
 * * @author [Your Name/GitHub Handle]
 */

// ================= CONFIGURATION =================
// 🔴 REPLACE THESE VALUES WITH YOUR OWN 🔴
const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN'; // Get from @BotFather
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';     // Found in the URL of your spreadsheet
const MY_CHAT_ID = 'YOUR_TELEGRAM_USER_ID';  // Get from @userinfobot

// 🔐 SECURITY: Create a random password here. 
const SECRET_TOKEN = "Create_A_Strong_Password_Here"; 

// 🛑 IMPORTANT: Run 'resetBotConnection' after deploying to update this URL!
const WEB_APP_URL = "YOUR_DEPLOYED_WEB_APP_URL"; 

// ================= CONSTANTS =================
const SHEET_NAME = 'Sheet1';
const LOG_SHEET_NAME = 'SystemLogs';
// Modify this query to match your specific bank's email format
const EMAIL_QUERY = 'from:alerts@hdfcbank.net is:unread'; 
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/`;

// -------------------------------------------------
// 1. THE WEBHOOK HANDLER (doPost)
// -------------------------------------------------
function doPost(e) {
  // 🏆 THE MAGIC FIX: Returns HTML instead of Text to prevent Telegram Retry Loops
  const output = HtmlService.createHtmlOutput("OK");
  
  try {
    if (!e || !e.postData) return output;

    // --- 🔐 SECURITY CHECK ---
    // Verifies that the request is coming to the specific secured URL
    if (e.parameter.bot_secret !== SECRET_TOKEN) {
      return output; 
    }
    
    const update = JSON.parse(e.postData.contents);
    if (!update.message) return output;

    const msgId = String(update.message.message_id);
    const chatId = String(update.message.chat.id);
    const text = update.message.text || "";
    const replyTo = update.message.reply_to_message;

    // --- 🛡️ DUPLICATE SHIELD ---
    // Prevents processing the same message twice (Cache lasts 10 mins)
    const cache = CacheService.getScriptCache();
    if (cache.get(msgId)) {
      return output; 
    }
    cache.put(msgId, 'true', 600);

    // --- LOGIC ---
    // Only allow the owner to interact with the bot
    if (chatId === MY_CHAT_ID) {
       logSystem("INCOMING", `User sent: ${text}`);
       handleReply(text, chatId, replyTo);
    } else {
       logSystem("WARNING", `Unauthorized access from: ${chatId}`);
    }

  } catch (error) {
    logSystem("ERROR", "Bot Crash: " + error.toString());
  }
  
  return output;
}

// -------------------------------------------------
// 2. LOGIC HANDLERS 
// -------------------------------------------------
function handleReply(category, chatId, replyMessage) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  const replyToId = replyMessage ? String(replyMessage.message_id).trim() : null;

  // STRATEGY A: PRECISE MATCH (User replied to a specific bot message)
  if (replyToId) {
    for (let i = data.length - 1; i >= 1; i--) {
      // Check Column F (Index 5) for the Message ID
      if (String(data[i][5]).trim() === replyToId) {
         updateRow(sheet, i, category, chatId, data[i]);
         return;
      }
    }
    logSystem("WARNING", `Precise match failed for ID: ${replyToId}`);
  }

  // STRATEGY B: LAZY MATCH (User sent a category without replying)
  // Finds the most recent "Pending" transaction
  for (let i = data.length - 1; i >= 1; i--) {
    const status = String(data[i][4]).trim().toLowerCase();
    if (status === "pending") { 
       updateRow(sheet, i, category, chatId, data[i]);
       return;
    }
  }
  
  sendTelegramMessage("⚠️ No pending expenses found to tag!", chatId);
  logSystem("INFO", "No pending expenses found.");
}

function updateRow(sheet, rowIndex, category, chatId, rowData) {
  const merchant = rowData[1];
  const amount = rowData[2];

  // Update Category (Col D) and Status (Col E)
  sheet.getRange(rowIndex + 1, 4).setValue(category); 
  sheet.getRange(rowIndex + 1, 5).setValue("Done");   
  
  sendTelegramMessage(`✅ Tagged ₹${amount} at *${merchant}* as: ${category}`, chatId);
  logSystem("SUCCESS", `Updated Row ${rowIndex+1}: ${merchant} -> ${category}`);
}

// -------------------------------------------------
// 3. SYSTEM LOGGER 
// -------------------------------------------------
function logSystem(type, message) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(LOG_SHEET_NAME);
    if (sheet) {
      sheet.appendRow([new Date(), type, message]);
    }
  } catch (e) {
    console.error("Logging failed: " + e);
  }
}

// -------------------------------------------------
// 4. EMAIL PROCESSOR 
// -------------------------------------------------
function processBankEmails() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  // Searches for unread bank emails
  const threads = GmailApp.search(EMAIL_QUERY);
  
  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      if (msg.isUnread()) {
        const body = msg.getPlainBody().replace(/\r\n/g, ' ').replace(/\n/g, ' ');
        
        // 🔴 CUSTOMIZE REGEX BELOW FOR YOUR BANK'S FORMAT 🔴
        const amountMatch = body.match(/Rs\.?\s*([\d,]+\.\d{2})/);
        const merchantMatch = body.match(/to VPA\s+.*?\s+(.+?)\s+on/) || body.match(/at\s+(.+?)\s+on/);

        if (amountMatch) {
          const amount = amountMatch[1];
          let merchant = merchantMatch ? merchantMatch[1].trim() : "Unknown";
          if (merchant.includes("@")) merchant = "UPI";
          
          // Send to Telegram
          const telegramResp = sendTelegramMessage(`💰 *New Expense*\nAmt: ₹${amount}\nTo: ${merchant}\n\nReply to this message with category.`);
          
          // Capture ID for reply matching
          let messageId = "";
          if (telegramResp && telegramResp.ok) messageId = telegramResp.result.message_id;

          // Save to Sheet: [Date, Merchant, Amount, Category, Status, MessageID]
          sheet.appendRow([new Date(), merchant, amount, "", "Pending", messageId]);
          logSystem("EMAIL", `Captured ₹${amount} at ${merchant} (ID: ${messageId})`);
          
          msg.markRead();
        }
      }
    });
  });
}

// -------------------------------------------------
// 5. UTILITIES
// -------------------------------------------------
function sendTelegramMessage(text, chatId) {
  const url = TELEGRAM_API + "sendMessage";
  const payload = { chat_id: chatId || MY_CHAT_ID, text: text, parse_mode: "Markdown" };
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post", contentType: "application/json", payload: JSON.stringify(payload)
    });
    return JSON.parse(response.getContentText());
  } catch (e) {
    logSystem("API ERROR", e.toString());
    return null;
  }
}

/**
 * ⚠️ RUN THIS FUNCTION MANUALLY AFTER DEPLOYING ⚠️
 * It registers your Web App URL with Telegram and applies the Security Token.
 */
function resetBotConnection() {
  // 1. Delete old webhook
  const clearUrl = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`;
  UrlFetchApp.fetch(clearUrl);
  
  Utilities.sleep(1000);
  
  // 2. Set NEW webhook with the secret in the URL
  const securedUrl = `${WEB_APP_URL}?bot_secret=${SECRET_TOKEN}`;
  const setUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(securedUrl)}`;
  
  const response = UrlFetchApp.fetch(setUrl);
  Logger.log("Secure Webhook Set: " + response.getContentText());
}
