export interface AccountData {
  "Account ID": number
  "Account Name": string
  Address: string
  "Total Sales": string // String from CSV/API, will be parsed to number
  "Date Created": string
  "Date Last Quoted": string
  "Primary Rep Name": string
  Brand?: string
  "Lifecycle Stage"?: string // HubSpot lifecycle stage (MQL, SQL, customer, etc.)
  // Source and attribution tracking
  "Analytics Source"?: string // Original source (organic search, paid search, etc.)
  "Latest Source"?: string // Most recent source
  "Source Data 1"?: string // Additional source details
  "Source Data 2"?: string // Additional source details
  "First Touch Campaign"?: string // First campaign that converted the lead
  "Last Touch Campaign"?: string // Last campaign that converted the lead
  "First URL"?: string // First URL visited
  "Last URL"?: string // Last URL visited
  "Number of Visits"?: string // Total number of visits
  "Number of Page Views"?: string // Total page views
}

export interface ProcessedData {
  totalAccounts: number
  totalRevenue: number
  averageDealSize: number
  salesByRep: Record<string, { sales: number; accounts: number }>
  salesDistribution: Record<string, number>
  monthlyTrends: Array<{ month: string; accounts: number; revenue: number }>
  topStates: Record<string, { accounts: number; sales: number }>
  recentlyQuoted: number
  salesByBrand: Record<string, { sales: number; accounts: number }>
  topPerformingAccounts: AccountData[]
  leastPerformingAccounts: AccountData[]
  allAccounts: AccountData[]
  lifecycleStageDistribution: Record<string, number> // Distribution of lifecycle stages
  // New analytics features
  trafficSourcePerformance: Record<string, { leads: number; revenue: number; conversionRate: number; avgDealSize: number }>
  geographicDistribution: Record<string, { leads: number; revenue: number }>
  leadHealthScores: Array<{ accountId: number; accountName: string; healthScore: number; temperature: string; riskLevel: string }>
  campaignPerformance: Record<string, { leads: number; revenue: number; cost?: number; roi?: number }>
  landingPagePerformance: Record<string, { leads: number; revenue: number; avgDealSize: number; sqlCount: number; conversionRate: number }>
  timeBasedInsights: {
    peakActivityHours: Array<{ hour: number; activity: number }>
    seasonalTrends: Array<{ month: string; leads: number; revenue: number }>
    responseTimeMetrics: { avgResponseTime: number; fastResponders: string[]; slowResponders: string[] }
  }
}
