# 🤖 Keesha v1.0 - Personal Finance Bot

Keesha is a serverless, automated expense tracker that runs entirely on **Telegram**, **Google Sheets**, and **Google Apps Script**. 

It solves the problem of manual expense tracking by automatically reading bank email alerts, forwarding them to Telegram, and allowing you to tag expenses instantly by replying to the message.

## 🚀 Features

* **Zero Cost:** Runs on Google's free tier.
* **Privacy First:** Your data lives in your personal Google Sheet. No 3rd party databases.
* **Auto-Capture:** Scans Gmail for bank transaction emails.
* **Instant Sync:** Updates Google Sheets in real-time.
* **Smart Matching:** Tag expenses by replying to the bot's message.
* **Loop Prevention:** Uses HTML output headers to prevent Telegram webhook retry loops.
* **Secure:** Protected by a custom Secret Token and Chat ID whitelisting.

## 🛠️ Prerequisites

1.  **Telegram Bot:** Create one via [@BotFather](https://t.me/BotFather) and get the `API TOKEN`.
2.  **Telegram User ID:** Get your numerical ID from [@userinfobot](https://t.me/userinfobot).
3.  **Google Sheet:** A new sheet to store data.

## 📥 Installation

### 1. Setup Google Sheets
Create a new Google Sheet and create two tabs with the exact names below:

**Tab 1: `Sheet1` (Expenses)**
| Row 1 Headers | A | B | C | D | E | F |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Header Name** | Date | Merchant | Amount | Category | Status | MessageID |

**Tab 2: `SystemLogs` (Debugging)**
| Row 1 Headers | A | B | C |
| :--- | :--- | :--- | :--- |
| **Header Name** | Timestamp | Type | Message |

### 2. Setup Google Apps Script
1.  Open your Google Sheet.
2.  Go to `Extensions` > `Apps Script`.
3.  Delete any code in the editor and paste the contents of `Code.gs`.

### 3. Configuration
Update the **CONFIGURATION** section at the top of the script:

```javascript
const BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'; // From BotFather
const SHEET_ID = '1x9Lm0fM8LBH...'; // From your Sheet URL
const MY_CHAT_ID = '123456789'; // From userinfobot
const SECRET_TOKEN = 'Banana_Pudding_123'; // Create your own password
