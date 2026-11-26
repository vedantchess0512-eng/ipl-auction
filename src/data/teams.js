export const IPL_TEAMS = [
  {
    id: "MI",
    name: "Mumbai Indians",
    shortName: "MI",
    color: "#004BA0",
    accent: "#D4AF37",
    city: "Mumbai",
    logo: "https://scores.iplt20.com/ipl/teamlogos/MI.png",
    gradient: "linear-gradient(135deg, #004BA0, #0078D7)"
  },
  {
    id: "CSK",
    name: "Chennai Super Kings",
    shortName: "CSK",
    color: "#F9CD05",
    accent: "#2A3FA5",
    city: "Chennai",
    logo: "https://scores.iplt20.com/ipl/teamlogos/CSK.png",
    gradient: "linear-gradient(135deg, #F2A900, #F5CD00)"
  },
  {
    id: "RCB",
    name: "Royal Challengers Bangalore",
    shortName: "RCB",
    color: "#EC1C24",
    accent: "#000000",
    city: "Bangalore",
    logo: "https://scores.iplt20.com/ipl/teamlogos/RCB.png",
    gradient: "linear-gradient(135deg, #C8102E, #1B1B1B)"
  },
  {
    id: "KKR",
    name: "Kolkata Knight Riders",
    shortName: "KKR",
    color: "#3A225D",
    accent: "#F2A900",
    city: "Kolkata",
    logo: "https://scores.iplt20.com/ipl/teamlogos/KKR.png",
    gradient: "linear-gradient(135deg, #3A225D, #6A3D9A)"
  },
  {
    id: "DC",
    name: "Delhi Capitals",
    shortName: "DC",
    color: "#004C93",
    accent: "#EF1C25",
    city: "Delhi",
    logo: "https://scores.iplt20.com/ipl/teamlogos/DC.png",
    gradient: "linear-gradient(135deg, #0033A0, #E53935)"
  },
  {
    id: "PBKS",
    name: "Punjab Kings",
    shortName: "PBKS",
    color: "#ED1B24",
    accent: "#A7A9AC",
    city: "Punjab",
    logo: "https://scores.iplt20.com/ipl/teamlogos/PBKS.png",
    gradient: "linear-gradient(135deg, #DD1F2D, #A0A0A0)"
  },
  {
    id: "RR",
    name: "Rajasthan Royals",
    shortName: "RR",
    color: "#EA1A85",
    accent: "#254AA5",
    city: "Jaipur",
    logo: "https://scores.iplt20.com/ipl/teamlogos/RR.png",
    gradient: "linear-gradient(135deg, #FF69B4, #1B3FA6)"
  },
  {
    id: "SRH",
    name: "Sunrisers Hyderabad",
    shortName: "SRH",
    color: "#F26522",
    accent: "#000000",
    city: "Hyderabad",
    logo: "https://scores.iplt20.com/ipl/teamlogos/SRH.png",
    gradient: "linear-gradient(135deg, #FF6B00, #1B1B1B)"
  },
  {
    id: "GT",
    name: "Gujarat Titans",
    shortName: "GT",
    color: "#1C1C6E",
    accent: "#C8A84B",
    city: "Ahmedabad",
    logo: "https://scores.iplt20.com/ipl/teamlogos/GT.png",
    gradient: "linear-gradient(135deg, #1C4B9C, #D4A843)"
  },
  {
    id: "LSG",
    name: "Lucknow Super Giants",
    shortName: "LSG",
    color: "#A0C2E8",
    accent: "#FBBD16",
    city: "Lucknow",
    logo: "https://scores.iplt20.com/ipl/teamlogos/LSG.png",
    gradient: "linear-gradient(135deg, #00B5D8, #A0C840)"
  }
]

export const AUCTION_FORMATS = {
  MEGA: {
    id: "MEGA",
    name: "Mega Auction",
    description: "All IPL 2026 players up for auction. No retentions. Each team gets ₹120 Cr.",
    pursePerTeam: 12000,
    maxOverseas: 8,
    icon: "🏆",
    comingSoon: false
  },
  LEGENDS: {
    id: "LEGENDS",
    name: "Legends Auction",
    description: "IPL all-time legends. No retentions. Each team gets ₹120 Cr.",
    pursePerTeam: 12000,
    maxOverseas: 8,
    icon: "⭐",
    comingSoon: false
  },
  IPL2026: {
    id: "IPL2026",
    name: "IPL 2026 Real",
    description: "Real IPL 2026 auction. Actual retained players & team purses loaded automatically.",
    pursePerTeam: null,
    maxOverseas: 8,
    icon: "🌸",
    comingSoon: false
  }
}
