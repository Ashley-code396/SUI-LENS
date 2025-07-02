"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Calendar, MapPin, Users, BarChart3 } from "lucide-react"
import Link from "next/link"
import { EmptyStateIllustration } from "@/components/empty-state-illustration"
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import Image from "next/image"
import { useUser } from "../landing/UserContext"
import { ProfileDropdown } from "../landing/ProfileDropDown"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"

export default function DashboardPage() {
  type Event = {
    id: string
    title?: string
    date?: string
    time?: string
    location?: string
    attendees?: number
    description?: string
  }
  const [myEvents, setMyEvents] = useState<Event[]>([])
  const [registeredEvents, setRegisteredEvents] = useState<Event[]>([])
  const [activeTab, setActiveTab] = useState("my-events")
  const [sidebarSection, setSidebarSection] = useState<string>("overview")
  const { user, logout } = useUser()
  const [showDropdown, setShowDropdown] = useState(false)
  const account = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  // Guest list state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [guests, setGuests] = useState<any[]>([])
  const [loadingGuests, setLoadingGuests] = useState(false)

  // Fetch events created by the connected wallet
  useEffect(() => {
    const fetchMyEvents = async () => {
      if (!account?.address) {
        setMyEvents([])
        return
      }
      const eventsSnapshot = await getDocs(
        query(collection(db, "events"), where("creator", "==", account.address))
      )
      const events: Event[] = eventsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      setMyEvents(events)
      // Set default selected event for guests section
      if (events.length > 0 && !selectedEventId) {
        setSelectedEventId(events[0].id)
      }
    }
    fetchMyEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  // Fetch registered events for the connected wallet
  useEffect(() => {
    const fetchRegisteredEvents = async () => {
      if (!account?.address) {
        setRegisteredEvents([])
        return
      }
      const eventsSnapshot = await getDocs(collection(db, "events"))
      const events: Event[] = []
      for (const docSnap of eventsSnapshot.docs) {
        const eventId = docSnap.id
        const regQuery = query(
          collection(db, "events", eventId, "registrations"),
          where("address", "==", account.address)
        )
        const regSnapshot = await getDocs(regQuery)
        if (!regSnapshot.empty) {
          events.push({
            id: eventId,
            ...docSnap.data(),
          })
        }
      }
      setRegisteredEvents(events)
    }
    fetchRegisteredEvents()
  }, [account])

  // Fetch guests for the selected event
  useEffect(() => {
    const fetchGuests = async () => {
      if (!selectedEventId) {
        setGuests([])
        return
      }
      setLoadingGuests(true)
      const snapshot = await getDocs(collection(db, "events", selectedEventId, "registrations"))
      setGuests(snapshot.docs.map(doc => doc.data()))
      setLoadingGuests(false)
    }
    if (sidebarSection === "guests" && selectedEventId) {
      fetchGuests()
    }
  }, [selectedEventId, sidebarSection])

  // Mint POAPs using Transaction
  const handleMintPoaps = async () => {
    if (!selectedEventId) {
      alert("No event selected.")
      return
    }
    const attendeesSnapshot = await getDocs(
      collection(db, "events", selectedEventId, "attendees")
    )
    const checkedInAddresses = attendeesSnapshot.docs.map(doc => doc.data().address)
    if (!checkedInAddresses.length) {
      alert("No checked-in guests to mint POAPs for.")
      return
    }
    const event = myEvents.find(e => e.id === selectedEventId)
    if (!event) {
      alert("Event not found.")
      return
    }
    const dateTimeString = `${event.date}T${event.time || "00:00"}:00Z`
    const eventDateU64 = Math.floor(new Date(dateTimeString).getTime() / 1000)

    const tx = new Transaction()
    tx.moveCall({
      target: `${process.env.NEXT_PUBLIC_SUI_PACKAGE_ID}::poap::batch_mint_and_transfer`,
      arguments: [
        tx.pure.string(event.title || ""),
        tx.pure.u64(eventDateU64),
        tx.pure.string(event.description || ""),
        tx.pure.vector("address", checkedInAddresses),
      ],
    })
    try {
      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: (result) => {
            alert("POAPs minted! Tx digest: " + result.digest)
          },
          onError: (e) => {
            alert("Minting failed: " + (e.message || e))
          },
        }
      )
    } catch (e: any) {
      alert("Minting failed: " + (e.message || e))
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-[#0B1620] py-6 px-4 flex flex-col gap-6">
        <div className="flex items-center mb-8">
          <Image src="https://i.ibb.co/PZHSkCVG/Suilens-Logo-Mark-Suilens-Black.png" alt="Suilens Logo" width={24} height={24} unoptimized />
          <span className="ml-2 text-lg font-bold text-white">Suilens</span>
        </div>
        <nav className="flex-1 flex flex-col gap-4">
          <button
            onClick={() => setSidebarSection("overview")}
            className={`flex items-center gap-2 font-medium hover:text-gray-300 ${sidebarSection === "overview" ? "text-white" : "text-gray-400"}`}
          >
            <svg width="20" height="20" fill="none">
              <rect width="20" height="20" rx="4" fill="#fff" fillOpacity="0.1" />
              <rect x="4" y="4" width="4" height="4" rx="1" fill="#fff" />
              <rect x="12" y="4" width="4" height="4" rx="1" fill="#fff" />
              <rect x="4" y="12" width="4" height="4" rx="1" fill="#fff" />
              <rect x="12" y="12" width="4" height="4" rx="1" fill="#fff" />
            </svg>
            Overview
          </button>
          <button
            onClick={() => setSidebarSection("guests")}
            className={`flex items-center gap-2 font-medium hover:text-white ${sidebarSection === "guests" ? "text-white" : "text-gray-400"}`}
          >
            <svg width="20" height="20" fill="none">
              <path d="M10 10a3 3 0 100-6 3 3 0 000 6zM10 12c-3.314 0-6 1.343-6 3v1a1 1 0 001 1h10a1 1 0 001-1v-1c0-1.657-2.686-3-6-3z" fill="currentColor" />
            </svg>
            Guests
          </button>
          <button
            onClick={() => setSidebarSection("registration")}
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <svg width="20" height="20" fill="none">
              <rect x="3" y="7" width="14" height="10" rx="2" fill="currentColor" fillOpacity=".2" />
              <rect x="7" y="3" width="6" height="4" rx="1" fill="currentColor" />
            </svg>
            Registration
          </button>
          <button
            onClick={() => setSidebarSection("blast")}
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <svg width="20" height="20" fill="none">
              <rect x="3" y="7" width="14" height="10" rx="2" fill="currentColor" fillOpacity=".2" />
              <rect x="7" y="3" width="6" height="4" rx="1" fill="currentColor" />
            </svg>
            Blast
          </button>
          <div className="mt-6">
            <span className="text-gray-500 text-xs mb-2 block">Insight</span>
            <button className="flex items-center gap-2 text-gray-400 hover:text-white mb-2">
              <svg width="20" height="20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" fillOpacity=".2" />
                <rect x="7" y="7" width="6" height="6" rx="1" fill="currentColor" />
              </svg>
              Statistics
            </button>
            <Link href="/bounties" className="flex items-center gap-2 text-gray-400 hover:text-white">
              <svg width="20" height="20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
                <rect x="8" y="8" width="4" height="4" rx="1" fill="currentColor" />
              </svg>
              Bounties
            </Link>
          </div>
        </nav>
      </aside>
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Nav */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <nav className="flex items-center gap-6">
            {["Home", "Communities", "Discover Events", "Bounties", "Dashboard"].map((item) => (
              <Link
                key={item}
                href={
                  item === "Home"
                    ? "/landing"
                    : item === "Discover Events"
                    ? "/discover"
                    : `/${item.toLowerCase().replace(/ /g, "")}`
                }
                className={`text-sm font-medium ${item === "Dashboard" ? "text-black font-bold" : "text-gray-500 hover:text-black"} transition-colors`}
              >
                {item}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/create">
              <Button className="bg-[#56A8FF] text-white px-4 py-2 rounded-full">Create Event</Button>
            </Link>
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown((v) => !v)}
                  className="focus:outline-none"
                  aria-label="Open profile menu"
                >
                  <Image
                    src={user.avatarUrl || "/placeholder-user.jpg"}
                    alt="User"
                    width={32}
                    height={32}
                    className="rounded-full cursor-pointer border-2 border-blue-500"
                  />
                </button>
                {showDropdown && (
                  <div className="absolute right-0 mt-2 z-50">
                    <ProfileDropdown
                      walletAddress={user.walletAddress ?? ""}
                      onLogout={() => {
                        setShowDropdown(false)
                        logout()
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        {/* Main Dashboard Content */}
        <main className="flex-1 p-6">
          {sidebarSection === "guests" ? (
            <div className="pt-8">
              <h2 className="text-2xl font-semibold mb-4 text-center">Guest List</h2>
              {myEvents.length === 0 ? (
                <div className="text-center text-gray-500">No events available.</div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-4 justify-center mb-6">
                    {myEvents.map((event) => (
                      <button
                        key={event.id}
                        className={`px-4 py-2 rounded-lg border ${
                          event.id === selectedEventId ? "bg-blue-500 text-white" : "bg-white text-gray-700"
                        }`}
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        {event.title}
                      </button>
                    ))}
                  </div>
                  {loadingGuests ? (
                    <div className="text-center text-gray-500">Loading guests...</div>
                  ) : guests.length === 0 ? (
                    <div className="text-center text-gray-500">No guests registered yet.</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border mt-4">
                          <thead>
                            <tr>
                              <th className="text-left p-2">Name</th>
                              <th className="text-left p-2">Email</th>
                              <th className="text-left p-2">Wallet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guests.map((guest, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-2">{guest.name}</td>
                                <td className="p-2">{guest.email}</td>
                                <td className="p-2">{guest.address}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mint POAPs Button */}
                      {sidebarSection === "guests" && guests.length > 0 && (
                        <div className="flex justify-center mt-6">
                          <Button
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg"
                            onClick={handleMintPoaps}
                          >
                            Mint POAPs for Checked-in Guests
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <Card className="base-card-light overflow-hidden shadow-lg rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-500 text-xs font-medium">Total Events</p>
                        <p className="text-xl font-bold">{myEvents.length}</p>
                      </div>
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="base-card-light overflow-hidden shadow-lg rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-500 text-xs font-medium">Total Attendees</p>
                        <p className="text-xl font-bold">
                          {myEvents.reduce((sum, e) => sum + Number(e.attendees || 0), 0)}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="base-card-light overflow-hidden shadow-lg rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-500 text-xs font-medium">Registered For</p>
                        <p className="text-xl font-bold">{registeredEvents.length}</p>
                        <p className="text-gray-400 text-xs mt-1">Upcoming events</p>
                      </div>
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="base-card-light overflow-hidden shadow-lg rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-500 text-xs font-medium">This Month</p>
                        <p className="text-xl font-bold">0</p>
                        <p className="text-gray-400 text-xs mt-1">Events attended</p>
                      </div>
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="my-events" className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">My Events</h2>
                  </div>
                  {myEvents.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {myEvents.map((event) => (
                        <Card
                          key={event.id}
                          className="base-card-light group overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 rounded-2xl"
                        >
                          <CardContent className="p-4">
                            <div className="font-bold text-lg">{event.title}</div>
                            <div className="text-sm text-gray-500">{event.date}</div>
                            <div className="text-sm text-gray-500">{event.location}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <EmptyStateIllustration
                      type="no-created-events"
                      title="No events created yet"
                      description="Start creating amazing events and connect with your audience. Your first event is just a click away!"
                      actionText="Create Your First Event"
                      onAction={() => (window.location.href = "/create")}
                    />
                  )}
                </TabsContent>
                <TabsContent value="registered" className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900">Registered Events</h2>
                  {registeredEvents.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {registeredEvents.map((event) => (
                        <Card key={event.id} className="base-card-light overflow-hidden rounded-2xl">
                          <CardContent className="p-4">
                            <div className="font-bold text-lg">{event.title}</div>
                            <div className="text-sm text-gray-500">{event.date}</div>
                            <div className="text-sm text-gray-500">{event.location}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <EmptyStateIllustration
                      type="no-registered-events"
                      title="No registered events"
                      description="Discover exciting events happening around you and register to join the fun!"
                      actionText="Explore Events"
                      onAction={() => (window.location.href = "/discover")}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </main>
      </div>
    </div>
  )
}