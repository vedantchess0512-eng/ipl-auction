# IPL Auction Game 🏏

A real-time IPL auction game to play with friends. Built with React + Firebase.

---

## ⚡ Setup in 15 minutes (FREE)

### Step 1: Install Node.js
Download from https://nodejs.org (LTS version)

### Step 2: Create Firebase Project (FREE)
1. Go to https://console.firebase.google.com
2. Click "Add project" → name it "ipl-auction-game"
3. Disable Google Analytics → Create project
4. Click "Realtime Database" in left sidebar → "Create Database"
5. Choose your region → Start in **test mode** → Enable
6. Click the ⚙️ gear icon → "Project settings"
7. Scroll down to "Your apps" → Click `</>` (Web)
8. Register app (name it anything) → Copy the config object

### Step 3: Add Firebase Config
Open `src/firebase.js` and replace the config with yours:
```js
const firebaseConfig = {
  apiKey: "your-actual-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
}
```

### Step 4: Run the App
```bash
npm install
npm run dev
```
Open http://localhost:5173 in your browser.

### Step 5: Deploy FREE on Vercel
```bash
npm install -g vercel
vercel
```
Follow the prompts. You'll get a URL like `https://ipl-auction-xyz.vercel.app`
Share this URL with friends!

---

## 🎮 How to Play

### Host:
1. Go to the website → "Create Room"
2. Enter your name, pick format (Mega/Legends/IPL2026)
3. Set squad limits, bid timer, bid increment
4. Select teams for the auction
5. Share the room code/link with friends
6. Once everyone joins → click "Start Auction"
7. Control the auction: click "SOLD" or "Unsold" for each player

### Players:
1. Go to the website → Enter your name + room code → "Join"
2. Pick your team in the lobby
3. Wait for host to start
4. During auction: click "BID ₹X" to bid on players
5. Highest bidder when timer hits 0 wins the player

---

## 📋 Auction Formats

| Format | Purse | Players | Retentions |
|--------|-------|---------|------------|
| Mega Auction | ₹120 Cr each | All IPL 2026 | None |
| Legends Auction | ₹120 Cr each | IPL All-Time Legends | None |
| IPL 2026 Real | Real purses | Real auction pool | Real retentions |

*IPL 2026 Real format coming after you provide the data.*

---

## 📁 Project Structure
```
src/
  components/
    Landing.jsx      - Home page
    HostSetup.jsx    - Create auction room (3-step setup)
    Lobby.jsx        - Friends join and pick teams
    AuctionRoom.jsx  - Live bidding screen
    Squad.jsx        - View squads after auction
  data/
    megaAuctionPlayers.js  - All Mega Auction players
    legendsPlayers.js      - All Legends players
    teams.js               - IPL team colors + formats
  utils/
    db.js            - All Firebase operations
  firebase.js        - Firebase config (YOU EDIT THIS)
```

---

## 🔜 Step 2 (Coming Next)
- XI Selection per match
- Toss system
- Match engine (ball-by-ball simulation)
- Points table
- IPL Playoffs bracket
- Trophy screen

---

## ❓ FAQ

**Why Firebase Realtime Database?**
It syncs bids instantly across all friends' phones/laptops. Free tier handles 10+ users easily.

**Is it really free?**
Yes. Firebase free tier + Vercel free tier = ₹0 forever for friend group usage.

**Can I add IPL 2026 real format later?**
Yes — just add your data to `src/data/ipl2026Players.js` following the same format.
