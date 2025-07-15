"use client"

import { useState, useTransition, useEffect } from "react"
import AccountDashboard from "@/components/dashboard"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import type { ProcessedData } from "@/lib/types"
import { fetchAndProcessHubSpotData } from "@/app/lib/hubspot-actions"
import { RefreshCw, AlertTriangle, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function Home() {
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  // Date filtering state - default to 2025 range where your data exists
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [dateRange, setDateRange] = useState<string>("")
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false)
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false)

  // Auto-fetch data when date range changes
  useEffect(() => {
    if (processedData) {
      handleSyncHubSpot()
    }
  }, [startDate, endDate])

  // Update date range display
  useEffect(() => {
    if (startDate && endDate) {
      setDateRange(`${format(startDate, "MMM dd, yyyy")} - ${format(endDate, "MMM dd, yyyy")}`)
    } else if (startDate) {
      setDateRange(`From ${format(startDate, "MMM dd, yyyy")}`)
    } else if (endDate) {
      setDateRange(`Until ${format(endDate, "MMM dd, yyyy")}`)
    } else {
      setDateRange("")
    }
  }, [startDate, endDate])

  const handleSyncHubSpot = () => {
    setError(null)
    startTransition(async () => {
      try {
        console.log("🔍 Fetching HubSpot data with date filter:", { startDate, endDate })
        const data = await fetchAndProcessHubSpotData(startDate, endDate)
        if (data) {
          // Clean up the data for 100% accuracy
          const cleanedData = {
            ...data,
            // Filter out unknown/N/A reps
            salesByRep: Object.fromEntries(
              Object.entries(data.salesByRep).filter(([rep]) => 
                rep && rep !== "N/A" && rep !== "Unknown Rep" && rep.trim() !== ""
              )
            ),
            // Filter out generic brands
            salesByBrand: Object.fromEntries(
              Object.entries(data.salesByBrand).filter(([brand]) => 
                brand && brand !== "Other" && brand !== "Unknown" && brand.trim() !== ""
              )
            ),
            // Only include accounts with valid data
            topPerformingAccounts: data.topPerformingAccounts.filter(acc => 
              acc["Account Name"] && 
              acc["Account Name"] !== "Unknown Account" &&
              acc["Primary Rep Name"] && 
              acc["Primary Rep Name"] !== "N/A"
            ),
            allAccounts: data.allAccounts.filter(acc => 
              acc["Account Name"] && 
              acc["Account Name"] !== "Unknown Account"
            )
          }
          
          setProcessedData(cleanedData)
          console.log("✅ Data cleaned and processed:", {
            totalAccounts: cleanedData.totalAccounts,
            validReps: Object.keys(cleanedData.salesByRep).length,
            validBrands: Object.keys(cleanedData.salesByBrand).length
          })
        } else {
          setError("Failed to fetch or process HubSpot data. Check API key and permissions, or server logs.")
        }
      } catch (e: any) {
        console.error("Client-side error during HubSpot sync:", e)
        setError(e.message || "An unexpected error occurred during HubSpot sync.")
      }
    })
  }

  const clearDateRange = () => {
    setStartDate(undefined)
    setEndDate(undefined)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Tabs defaultValue="dashboard" className="w-full">
        <div className="border-b bg-white sticky top-0 z-10">
          <div className="container mx-auto flex flex-wrap justify-between items-center py-3 gap-4">
            <TabsList className="grid w-full max-w-xs grid-cols-1">
              <TabsTrigger value="dashboard">Sales Funnel Dashboard</TabsTrigger>
            </TabsList>
            
            {/* Date Range Filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Filter by date:</span>
                
                {/* Start Date Picker */}
                <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-36 justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date)
                        setIsStartCalendarOpen(false)
                      }}
                      disabled={(date) => endDate ? date > endDate : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-gray-400">to</span>
                
                {/* End Date Picker */}
                <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-36 justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date)
                        setIsEndCalendarOpen(false)
                      }}
                      disabled={(date) => startDate ? date < startDate : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                                 {(startDate || endDate) && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={clearDateRange}
                     className="h-8 px-2 text-xs"
                   >
                     Clear
                   </Button>
                 )}
               </div>
               
               {/* Quick Date Presets */}
               <div className="flex items-center gap-2 text-xs">
                 <span className="text-gray-500">Quick:</span>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => {
                     setStartDate(new Date('2025-01-01'))
                     setEndDate(new Date('2025-12-31'))
                   }}
                   className="h-7 px-2 text-xs"
                 >
                   All 2025
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => {
                     setStartDate(new Date('2025-01-01'))
                     setEndDate(new Date('2025-06-30'))
                   }}
                   className="h-7 px-2 text-xs"
                 >
                   H1 2025
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => {
                     setStartDate(new Date('2025-04-01'))
                     setEndDate(new Date('2025-04-30'))
                   }}
                   className="h-7 px-2 text-xs"
                 >
                   Apr 2025
                 </Button>
              </div>
              
              <Button onClick={handleSyncHubSpot} disabled={isPending} className="flex-shrink-0">
                <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                {isPending ? "Fetching Contacts..." : "Sync HubSpot"}
              </Button>
            </div>
          </div>

          {/* Active Date Filter Display */}
          {dateRange && (
            <div className="container mx-auto px-4 pb-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                📅 Filtered: {dateRange}
                {processedData && ` • ${processedData.totalAccounts} qualified leads found`}
              </Badge>
            </div>
          )}
        </div>

        <TabsContent value="dashboard" className="mt-0">
          {error && (
            <div className="container mx-auto my-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Error loading HubSpot data:</p>
                <p className="text-sm">{error}</p>
                <p className="text-xs mt-1">Check your API key and permissions in the .env.local file</p>
              </div>
            </div>
          )}
          
          {/* Data Summary */}
          {processedData && !isPending && (
            <div className="container mx-auto my-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">✅ Data loaded successfully:</span>
                  <span>{processedData.totalAccounts} qualified leads</span>
                  <span>{Object.keys(processedData.salesByRep).length} active reps</span>
                  <span>{Object.keys(processedData.salesByBrand).length} brands</span>
                </div>
                <div className="text-xs text-green-600">
                  From {processedData.allAccounts.length} total contacts
                </div>
              </div>
            </div>
          )}

          {/* Date Range Hint */}
          {(startDate || endDate) && processedData && processedData.totalAccounts < 100 && (
            <div className="container mx-auto my-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded">
              <div className="flex items-center gap-2">
                <span className="font-medium">💡 Tip:</span>
                <span className="text-sm">
                  Your contacts were created in 2025 (Jan-Apr). Try selecting dates like 
                  <strong> Jan 1, 2025 - Dec 31, 2025</strong> to see all {1999} leads.
                </span>
              </div>
            </div>
          )}
          
          <AccountDashboard processedData={processedData} isLoading={isPending && !error} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
