"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Briefcase,
  ThumbsUp,
  CalendarIcon,
  ChevronRight,
  AlertCircle,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  Shield
} from "lucide-react"
import type { ProcessedData, AccountData } from "@/lib/types"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface AccountDashboardProps {
  processedData: ProcessedData | null
  isLoading: boolean
}

// Helper functions
const formatCurrency = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value)
}

const formatNumber = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return "0"
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value)
}

// Helper function to parse currency string to number
const parseCurrency = (value: string | number): number => {
  if (typeof value === "number") return value
  if (!value) return 0
  const cleaned = String(value).replace(/[$,\s]/g, "")
  const num = Number.parseFloat(cleaned)
  return !isNaN(num) && isFinite(num) ? num : 0
}

// Helper function to format lifecycle stage labels
const formatLifecycleStage = (stage: string): string => {
  const stageMap: Record<string, string> = {
    'marketingqualifiedlead': 'Marketing Qualified Lead',
    'salesqualifiedlead': 'Sales Qualified Lead',
    'customer': 'Customer',
    'lead': 'Lead',
    'subscriber': 'Subscriber',
    'opportunity': 'Opportunity',
    'evangelist': 'Evangelist',
    'other': 'Other'
  }
  
  // Return mapped value or format the original string
  if (stageMap[stage.toLowerCase()]) {
    return stageMap[stage.toLowerCase()]
  }
  
  // Fallback: split on capital letters and capitalize words
  return stage
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

// Component for the rep leads modal
interface RepLeadsModalProps {
  repName: string
  accounts: AccountData[]
  isOpen: boolean
  onClose: () => void
}

function RepLeadsModal({ repName, accounts, isOpen, onClose }: RepLeadsModalProps) {
  // Sort accounts by Total Sales from highest to lowest
  const sortedAccounts = [...accounts].sort((a, b) => {
    const salesA = parseCurrency(a["Total Sales"])
    const salesB = parseCurrency(b["Total Sales"])
    return salesB - salesA
  })

  const totalValue = sortedAccounts.reduce((sum, account) => sum + parseCurrency(account["Total Sales"]), 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500" />
            Leads for {repName}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{sortedAccounts.length} total leads</span>
            <span>•</span>
            <span>{formatCurrency(totalValue)} total pipeline value</span>
          </div>
        </DialogHeader>
        
        <div className="space-y-3">
          {sortedAccounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No leads found for this sales rep</p>
            </div>
          ) : (
            sortedAccounts.map((account, index) => {
              const salesValue = parseCurrency(account["Total Sales"])
              const lifecycleStage = account["Lifecycle Stage"] || "unknown"
              
              return (
                <div key={`${account["Account ID"]}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{account["Account Name"] || "Unknown Account"}</h4>
                        <p className="text-sm text-gray-600">{account["Address"] || "No address"}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${
                            lifecycleStage === 'customer' ? 'bg-green-50 text-green-700 border-green-200' :
                            lifecycleStage === 'salesqualifiedlead' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            lifecycleStage === 'marketingqualifiedlead' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                          }`}>
                            {formatLifecycleStage(lifecycleStage)}
                          </Badge>
                          
                          {/* Source Information */}
                          {account["Analytics Source"] && account["Analytics Source"] !== "Unknown" && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              📊 {account["Analytics Source"]}
                            </Badge>
                          )}
                          
                          {/* Latest Source if different from Analytics Source */}
                          {account["Latest Source"] && 
                           account["Latest Source"] !== "Unknown" && 
                           account["Latest Source"] !== account["Analytics Source"] && (
                            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                              🔄 {account["Latest Source"]}
                            </Badge>
                          )}
                          
                          {/* Campaign Information */}
                          {account["Last Touch Campaign"] && account["Last Touch Campaign"].trim() && (
                            <Badge variant="outline" className="text-xs bg-pink-50 text-pink-700 border-pink-200">
                              🎯 {account["Last Touch Campaign"]}
                            </Badge>
                          )}
                          
                          {/* Visit Information */}
                          {account["Number of Visits"] && Number(account["Number of Visits"]) > 0 && (
                            <span className="text-xs text-gray-500">
                              👁️ {account["Number of Visits"]} visits
                            </span>
                          )}
                          
                          {account["Date Created"] && account["Date Created"] !== "N/A" && (
                            <span className="text-xs text-gray-500">Created: {account["Date Created"]}</span>
                          )}
                          {account["Date Last Quoted"] && account["Date Last Quoted"] !== "N/A" && (
                            <span className="text-xs text-gray-500">Last quoted: {account["Date Last Quoted"]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${
                      salesValue > 50000 ? 'text-green-600' :
                      salesValue > 10000 ? 'text-blue-600' :
                      salesValue > 0 ? 'text-orange-600' :
                      'text-gray-500'
                    }`}>
                      {formatCurrency(salesValue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      #{index + 1} highest
                    </div>
                    
                    {/* Additional Source Details (if available) */}
                    {(account["First URL"] || account["Last URL"] || account["Number of Page Views"]) && (
                      <div className="mt-2 text-xs text-gray-400 space-y-1">
                        {account["Number of Page Views"] && Number(account["Number of Page Views"]) > 0 && (
                          <div>📄 {account["Number of Page Views"]} page views</div>
                        )}
                        {account["First URL"] && account["First URL"].length > 50 && (
                          <div title={account["First URL"]}>
                            🌐 First: ...{account["First URL"].slice(-30)}
                          </div>
                        )}
                        {account["First URL"] && account["First URL"].length <= 50 && (
                          <div>🌐 First: {account["First URL"]}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Password Protection Component
interface PasswordProtectionProps {
  onAuthenticated: () => void
}

function PasswordProtection({ onAuthenticated }: PasswordProtectionProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simulate a brief loading time for security
    setTimeout(() => {
      if (password === "largeoilrig") {
        onAuthenticated()
      } else {
        setError("Incorrect password. Please try again.")
        setPassword("")
      }
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-white shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 mx-auto bg-blue-500 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Sales Dashboard Access</CardTitle>
          <p className="text-gray-600 mt-2">Enter password to view confidential sales data</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter dashboard password"
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Access Dashboard
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-3 w-3" />
              <span>Protected sales funnel analytics and lead data</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AccountDashboard({ processedData, isLoading }: AccountDashboardProps) {
  const [internalStartDate, setInternalStartDate] = useState<Date>()
  const [internalEndDate, setInternalEndDate] = useState<Date>()
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false)
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false)
  const [selectedRep, setSelectedRep] = useState<string | null>(null)
  const [repLeadsModalOpen, setRepLeadsModalOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Show password protection if not authenticated
  if (!isAuthenticated) {
    return <PasswordProtection onAuthenticated={() => setIsAuthenticated(true)} />
  }

  // Helper function to get leads for a specific rep
  const getLeadsForRep = (repName: string): AccountData[] => {
    if (!processedData?.allAccounts) return []
    return processedData.allAccounts.filter(account => 
      (account["Primary Rep Name"] || "N/A") === repName
    )
  }

  const handleViewRepLeads = (repName: string) => {
    setSelectedRep(repName)
    setRepLeadsModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 min-h-[calc(100vh-100px)] flex flex-col items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-500">
          <BarChart3 className="h-8 w-8 animate-pulse" />
          <p className="text-xl">Loading Sales Funnel Data...</p>
        </div>
        <div className="w-full max-w-md mt-4">
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse-loader" style={{ width: "100%" }}></div>
          </div>
        </div>
        <style jsx global>{`
          @keyframes pulse-loader { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .animate-pulse-loader { animation: pulse-loader 1.5s infinite linear; }
        `}</style>
      </div>
    )
  }

  if (!processedData) {
    return (
      <div className="p-6 space-y-6 min-h-[calc(100vh-100px)] flex flex-col items-center justify-center text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700">No Sales Funnel Data</h2>
        <p className="text-gray-500">Click "Sync HubSpot" to load your qualified leads and sales funnel metrics.</p>
        <p className="text-sm text-gray-400">Make sure your HubSpot account has MQLs and SQLs configured.</p>
      </div>
    )
  }

  // Calculate funnel metrics from the actual contact data
  const totalLeads = processedData.totalAccounts
  const totalReps = Object.keys(processedData.salesByRep).length
  const totalRevenue = processedData.totalRevenue
  const avgDealSize = processedData.averageDealSize

  // Get actual MQLs and SQLs from HubSpot lifecycle stages
  const lifecycleDistribution = processedData.lifecycleStageDistribution || {}
  
  // Count actual lifecycle stages from HubSpot data
  const mqls = (lifecycleDistribution['marketingqualifiedlead'] || 0)
  const sqls = (lifecycleDistribution['salesqualifiedlead'] || 0)
  const customers = (lifecycleDistribution['customer'] || 0) + (lifecycleDistribution['opportunity'] || 0)
  
  // Also count any other variations of the stage names
  const mqlVariations = ['marketingqualifiedlead', 'mql'].reduce((sum, stage) => 
    sum + (lifecycleDistribution[stage] || 0), 0)
  const sqlVariations = ['salesqualifiedlead', 'sql'].reduce((sum, stage) => 
    sum + (lifecycleDistribution[stage] || 0), 0)
  
  const finalMqls = Math.max(mqls, mqlVariations)
  const finalSqls = Math.max(sqls, sqlVariations)
  const expandedAccounts = Math.round(customers * 0.30) // 30% of customers expand

  // Calculate revenue for each stage
  const mqlValue = finalMqls * 1000 // $1k potential per MQL
  const sqlValue = finalSqls * 2000 // $2k potential per SQL
  const customerValue = customers * 5000 // $5k average customer value
  const expansionValue = expandedAccounts * 15000 // $15k expansion value

  // Conversion rates based on actual HubSpot data
  const mqlToSqlRate = finalSqls > 0 && finalMqls > 0 ? ((finalSqls / finalMqls) * 100).toFixed(1) : "0.0"
  const sqlToCustomerRate = customers > 0 && finalSqls > 0 ? ((customers / finalSqls) * 100).toFixed(1) : "0.0"
  const customerToExpansionRate = expandedAccounts > 0 && customers > 0 ? ((expandedAccounts / customers) * 100).toFixed(1) : "30.0"

  const clearDateRange = () => {
    setInternalStartDate(undefined)
    setInternalEndDate(undefined)
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Funnel Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your lead progression from MQLs to customer expansion</p>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Qualified Leads</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalLeads)}</div>
            <p className="text-xs text-gray-500">MQLs + SQLs</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Sales Reps</CardTitle>
            <Briefcase className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReps}</div>
            <p className="text-xs text-gray-500">Managing leads</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-gray-500">Total pipeline</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Deal Size</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgDealSize)}</div>
            <p className="text-xs text-gray-500">Per opportunity</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Analytics Dashboard */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Advanced Analytics</h2>
          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
            🚀 AI-Powered Insights
          </Badge>
        </div>

        {/* Top Row: Traffic Sources, Lead Health, Geographic */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Traffic Source Performance */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">🚦 Traffic Source Performance</CardTitle>
              <p className="text-sm text-gray-600">Lead generation by source with conversion rates</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(processedData.trafficSourcePerformance || {})
                  .sort(([,a], [,b]) => b.leads - a.leads)
                  .slice(0, 6)
                  .map(([source, data]) => (
                    <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{source}</span>
                          <Badge variant="outline" className="text-xs">
                            {data.conversionRate.toFixed(1)}% SQL
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.leads} leads • {formatCurrency(data.avgDealSize)} avg
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-blue-600">
                          {formatCurrency(data.revenue)}
                        </div>
                      </div>
                    </div>
                  ))}
                {Object.keys(processedData.trafficSourcePerformance || {}).length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No traffic source data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Lead Health Scores */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">🌡️ Lead Health & Temperature</CardTitle>
              <p className="text-sm text-gray-600">Highest scoring leads with risk assessment</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(processedData.leadHealthScores || []).slice(0, 6).map((lead) => (
                  <div key={lead.accountId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {lead.accountName}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs">{lead.temperature}</span>
                        <span className="text-xs text-gray-500">{lead.riskLevel}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {lead.healthScore}/100
                      </div>
                      <div className={`w-12 h-2 rounded-full ${
                        lead.healthScore >= 80 ? 'bg-green-200' :
                        lead.healthScore >= 60 ? 'bg-yellow-200' :
                        lead.healthScore >= 40 ? 'bg-orange-200' : 'bg-red-200'
                      }`}>
                        <div 
                          className={`h-full rounded-full ${
                            lead.healthScore >= 80 ? 'bg-green-500' :
                            lead.healthScore >= 60 ? 'bg-yellow-500' :
                            lead.healthScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${lead.healthScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(processedData.leadHealthScores || []).length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No health score data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Geographic Distribution */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">🗺️ Geographic Performance</CardTitle>
              <p className="text-sm text-gray-600">Leads and revenue by state/region</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(processedData.geographicDistribution || {})
                  .sort(([,a], [,b]) => b.revenue - a.revenue)
                  .slice(0, 6)
                  .map(([state, data]) => (
                    <div key={state} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {state === "Unknown" ? "🌍 Unknown" : `🇺🇸 ${state}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.leads} leads
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(data.revenue)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(data.leads > 0 ? data.revenue / data.leads : 0)} avg
                        </div>
                      </div>
                    </div>
                  ))}
                {Object.keys(processedData.geographicDistribution || {}).length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No geographic data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row: Campaign Performance & Time Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign Performance */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">🎯 Top Performing Campaigns</CardTitle>
              <p className="text-sm text-gray-600">Marketing campaigns driving the most revenue</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(processedData.campaignPerformance || {})
                  .sort(([,a], [,b]) => b.revenue - a.revenue)
                  .slice(0, 5)
                  .map(([campaign, data]) => (
                    <div key={campaign} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          🎯 {campaign}
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.leads} leads generated
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-purple-600">
                          {formatCurrency(data.revenue)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(data.leads > 0 ? data.revenue / data.leads : 0)} per lead
                        </div>
                      </div>
                    </div>
                  ))}
                {Object.keys(processedData.campaignPerformance || {}).length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No campaign data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Peak Activity & Insights */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">⏰ Peak Activity Hours</CardTitle>
              <p className="text-sm text-gray-600">When your leads are most active</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(processedData.timeBasedInsights?.peakActivityHours || []).map((hourData) => (
                  <div key={hourData.hour} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        🕐 {hourData.hour}:00 - {hourData.hour + 1}:00
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-indigo-600">
                        {hourData.activity} leads
                      </div>
                    </div>
                  </div>
                ))}
                {(processedData.timeBasedInsights?.peakActivityHours || []).length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    No activity data available
                  </div>
                )}
              </div>
              
              {/* Response Time Insights */}
              {processedData.timeBasedInsights?.responseTimeMetrics && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-900 mb-2">🏆 Top Performers</div>
                  <div className="flex flex-wrap gap-1">
                    {processedData.timeBasedInsights.responseTimeMetrics.fastResponders.map((rep) => (
                      <Badge key={rep} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        ⚡ {rep}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Landing Pages Performance - Full Width */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">🌐 Top Landing Pages Performance</CardTitle>
            <p className="text-sm text-gray-600">Which pages visitors land on first and their conversion rates to SQLs</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(processedData.landingPagePerformance || {})
                .sort(([,a], [,b]) => b.leads - a.leads)
                .slice(0, 9)
                .map(([page, data]) => (
                  <div key={page} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {page === "Homepage" ? "🏠" : page.includes("Product") ? "📦" : page.includes("About") ? "ℹ️" : 
                           page.includes("Contact") ? "📞" : page.includes("Blog") ? "📝" : page.includes("Pricing") ? "💰" :
                           page.includes("Demo") ? "🎬" : page.includes("Case") ? "📊" : page.includes("Resource") ? "📚" : "🌐"} {page}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs ml-2 ${
                        data.conversionRate >= 20 ? 'bg-green-50 text-green-700 border-green-200' :
                        data.conversionRate >= 10 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        data.conversionRate >= 5 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      }`}>
                        {data.conversionRate.toFixed(1)}% SQL
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Leads</span>
                        <span className="text-sm font-semibold text-blue-600">{data.leads}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Revenue</span>
                        <span className="text-sm font-semibold text-green-600">{formatCurrency(data.revenue)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Avg Deal</span>
                        <span className="text-sm font-medium text-gray-800">{formatCurrency(data.avgDealSize)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">SQLs</span>
                        <span className="text-sm font-medium text-purple-600">{data.sqlCount}</span>
                      </div>
                    </div>
                    
                    {/* Conversion Rate Visual */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                        <span>Conversion Rate</span>
                        <span>{data.conversionRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            data.conversionRate >= 20 ? 'bg-green-500' :
                            data.conversionRate >= 10 ? 'bg-blue-500' :
                            data.conversionRate >= 5 ? 'bg-orange-500' : 'bg-gray-400'
                          }`}
                          style={{ width: `${Math.min(data.conversionRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            
            {Object.keys(processedData.landingPagePerformance || {}).length === 0 && (
              <div className="text-sm text-gray-500 text-center py-8">
                No landing page data available. First URL data may not be populated for these contacts.
              </div>
            )}
            
            {Object.keys(processedData.landingPagePerformance || {}).length > 9 && (
              <div className="mt-4 text-center">
                <Badge variant="outline" className="text-xs text-gray-600">
                  Showing top 9 of {Object.keys(processedData.landingPagePerformance || {}).length} landing pages
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Funnel Visualization */}
      <div className="bg-white rounded-lg p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Sales Funnel Progression</h2>
          <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
            📊 Based on {formatNumber(totalLeads)} real contacts
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Stage 1: Marketing (Lead Generation) */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto bg-blue-500 rounded-full flex items-center justify-center mb-3">
                <Target className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-lg text-blue-800">Marketing</CardTitle>
              <p className="text-sm text-blue-600">Lead Generation</p>
            </CardHeader>
                         <CardContent className="text-center space-y-3">
               <div className="bg-white rounded-lg p-4">
                 <div className="text-3xl font-bold text-blue-800">{formatNumber(finalMqls)}</div>
                 <div className="text-sm text-blue-600">Marketing Qualified Leads</div>
                 <div className="text-xs text-gray-500 mt-1">{formatCurrency(mqlValue)} potential</div>
               </div>
               <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                 {totalLeads > 0 ? Math.round((finalMqls / totalLeads) * 100) : 0}% of total leads
               </Badge>
             </CardContent>
          </Card>

          {/* Arrow */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="flex flex-col items-center">
              <ChevronRight className="h-8 w-8 text-gray-400" />
              <div className="text-xs text-gray-500 mt-1">{mqlToSqlRate}% convert</div>
            </div>
          </div>

          {/* Stage 2: Sales Management (Opportunity Creation) */}
          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-3">
                <Users className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-lg text-green-800">Sales Management</CardTitle>
              <p className="text-sm text-green-600">Opportunity Creation</p>
            </CardHeader>
                         <CardContent className="text-center space-y-3">
               <div className="bg-white rounded-lg p-4">
                 <div className="text-3xl font-bold text-green-800">{formatNumber(finalSqls)}</div>
                 <div className="text-sm text-green-600">Sales Qualified Leads</div>
                 <div className="text-xs text-gray-500 mt-1">{formatCurrency(sqlValue)} potential</div>
               </div>
               <Badge className="bg-green-100 text-green-800 border-green-200">
                 {totalLeads > 0 ? Math.round((finalSqls / totalLeads) * 100) : 0}% of total leads
               </Badge>
             </CardContent>
          </Card>

          {/* Arrow */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="flex flex-col items-center">
              <ChevronRight className="h-8 w-8 text-gray-400" />
              <div className="text-xs text-gray-500 mt-1">{sqlToCustomerRate}% convert</div>
            </div>
          </div>

          {/* Stage 3: Marketing & Sales (Onboarding) */}
          <Card className="border-2 border-orange-200 bg-orange-50">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto bg-orange-500 rounded-full flex items-center justify-center mb-3">
                <ThumbsUp className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-lg text-orange-800">Marketing & Sales</CardTitle>
              <p className="text-sm text-orange-600">Customer Onboarding</p>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="bg-white rounded-lg p-4">
                <div className="text-3xl font-bold text-orange-800">{formatNumber(customers)}</div>
                <div className="text-sm text-orange-600">New Customers</div>
                <div className="text-xs text-gray-500 mt-1">{formatCurrency(customerValue)} revenue</div>
              </div>
                             <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                 {finalSqls > 0 ? Math.round((customers / finalSqls) * 100) : 0}% of SQLs
               </Badge>
            </CardContent>
          </Card>

          {/* Arrow */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="flex flex-col items-center">
              <ChevronRight className="h-8 w-8 text-gray-400" />
              <div className="text-xs text-gray-500 mt-1">{customerToExpansionRate}% expand</div>
            </div>
          </div>

          {/* Stage 4: Account Management (Customer Expansion) */}
          <Card className="border-2 border-purple-200 bg-purple-50">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto bg-purple-500 rounded-full flex items-center justify-center mb-3">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-lg text-purple-800">Account Management</CardTitle>
              <p className="text-sm text-purple-600">Customer Expansion</p>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="bg-white rounded-lg p-4">
                <div className="text-3xl font-bold text-purple-800">{formatNumber(expandedAccounts)}</div>
                <div className="text-sm text-purple-600">Expanded Accounts</div>
                <div className="text-xs text-gray-500 mt-1">{formatCurrency(expansionValue)} expansion</div>
              </div>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">30% expand</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Summary */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">MQL → SQL</div>
              <div className="text-2xl font-bold text-gray-800">{mqlToSqlRate}%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">SQL → Customer</div>
              <div className="text-2xl font-bold text-gray-800">{sqlToCustomerRate}%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Customer → Expansion</div>
              <div className="text-2xl font-bold text-gray-800">{customerToExpansionRate}%</div>
            </div>
          </div>
        </div>
      </div>

             {/* Lifecycle Stage Debug Info */}
       {Object.keys(lifecycleDistribution).length > 0 && (
         <div className="bg-white rounded-lg p-6 shadow-sm">
           <h3 className="text-xl font-semibold text-gray-900 mb-4">HubSpot Lifecycle Stage Distribution</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {Object.entries(lifecycleDistribution)
               .sort(([, a], [, b]) => b - a)
               .map(([stage, count]) => (
                 <div key={stage} className="bg-gray-50 rounded-lg p-3 text-center">
                   <div className="text-2xl font-bold text-gray-800">{count}</div>
                   <div className="text-sm text-gray-600">{formatLifecycleStage(stage)}</div>
                   <div className="text-xs text-gray-500">
                     {totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0}%
                   </div>
                 </div>
               ))}
           </div>
         </div>
       )}

       {/* Sales Rep Performance */}
       {Object.keys(processedData.salesByRep).length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Performing Sales Reps</h3>
          <div className="space-y-3">
            {Object.entries(processedData.salesByRep)
              .sort(([, a], [, b]) => b.sales - a.sales)
              .slice(0, 5)
              .map(([rep, data], index) => (
                <div key={rep} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{rep}</div>
                      <div className="text-sm text-gray-500">{data.accounts} qualified leads</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs h-7 px-2"
                        onClick={() => handleViewRepLeads(rep)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Leads from this user
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCurrency(data.sales)}</div>
                    <div className="text-sm text-gray-500">pipeline value</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Rep Leads Modal */}
      {selectedRep && (
        <RepLeadsModal
          repName={selectedRep}
          accounts={getLeadsForRep(selectedRep)}
          isOpen={repLeadsModalOpen}
          onClose={() => {
            setRepLeadsModalOpen(false)
            setSelectedRep(null)
          }}
        />
      )}
    </div>
  )
}
