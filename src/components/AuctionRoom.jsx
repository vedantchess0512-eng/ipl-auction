import { useParams } from 'react-router-dom'
import AuctionRoomMobile from './AuctionRoomMobile.jsx'
import AuctionRoomDesktop from './AuctionRoomDesktop.jsx'

export default function AuctionRoom() {
  const { roomId } = useParams()
  const isMobile = window.innerWidth <= 768
  return isMobile ? <AuctionRoomMobile /> : <AuctionRoomDesktop />
}
