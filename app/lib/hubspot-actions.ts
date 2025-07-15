"use server"

import { Client } from "@hubspot/api-client"
import type { SimplePublicObject } from "@hubspot/api-client/lib/codegen/crm/companies"
import type { AccountData, ProcessedData } from "@/lib/types"
import fs from 'fs'
import path from 'path'

// --- Helper functions (previously in improved-number-handling.ts) ---
const parseCurrency = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return !isNaN(value) && isFinite(value) ? value : 0
  if (!value) return 0
  const cleaned = String(value).replace(/[$,\s]/g, "")
  const num = Number.parseFloat(cleaned)
  return !isNaN(num) && isFinite(num) ? num : 0
}

const calculateAverage = (arr: number[]): number => {
  if (arr.length === 0) return 0
  const sum = arr.reduce((acc, val) => acc + val, 0)
  return sum / arr.length
}

// Add CSV processing function
function processCSVData(startDate?: Date, endDate?: Date): ProcessedData {
  try {
    const csvPath = path.join(process.cwd(), 'public', 'comma delimited.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
    
    console.log('📊 Processing CSV data with', lines.length - 1, 'accounts')
    
    const accounts: AccountData[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length < headers.length) continue
      
      const account: any = {}
      headers.forEach((header, index) => {
        account[header] = values[index]?.replace(/"/g, '').trim() || ''
      })
      
      // Parse the date created
      const dateCreated = account['Date Created']
      let accountDate: Date | null = null
      if (dateCreated) {
        // Handle MM/DD/YYYY format
        const [month, day, year] = dateCreated.split('/')
        if (month && day && year) {
          accountDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        }
      }
      
      // Apply date filtering
      if (startDate || endDate) {
        if (!accountDate) continue
        if (startDate && accountDate < startDate) continue
        if (endDate && accountDate > endDate) continue
      }
      
      // Convert to AccountData format
      const accountData: AccountData = {
        "Account ID": parseInt(account['Account ID']) || 0,
        "Account Name": account['Account Name'] || 'Unknown Account',
        "Address": account['Address'] || 'N/A',
        "Total Sales": account['Total Sales'] || '$0',
        "Date Created": accountDate ? accountDate.toLocaleDateString() : 'N/A',
        "Date Last Quoted": account['Date Last Quoted'] || 'N/A',
        "Primary Rep Name": account['Primary Rep Name'] || 'N/A',
        "Lifecycle Stage": determineLifecycleStage(parseCurrency(account['Total Sales']))
      }
      
      accounts.push(accountData)
    }
    
    console.log('✅ CSV processing complete:', accounts.length, 'accounts after date filtering')
    
    return processAccountDataInternal(accounts)
    
  } catch (error) {
    console.error('❌ Error processing CSV data:', error)
    throw new Error('Failed to process CSV data')
  }
}

// Helper function to parse CSV line properly handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

// Helper function to determine lifecycle stage based on sales amount
function determineLifecycleStage(salesAmount: number): string {
  if (salesAmount > 50000) return 'customer'
  if (salesAmount > 10000) return 'salesqualifiedlead'
  if (salesAmount > 0) return 'marketingqualifiedlead'
  return 'lead'
}

function transformHubSpotDataToAccountData(
  contacts: any[],
  companiesMap: Map<string, SimplePublicObject>,
  ownersMap: Map<string, any>,
  startDate?: Date,
  endDate?: Date,
): AccountData[] {
  return contacts
    .filter((contact: any) => {
      // Filter by date range if provided
      if (startDate || endDate) {
        const companyId = contact.associations?.companies?.results?.[0]?.id
        const company = companyId ? companiesMap.get(companyId) : null
        
        // Try to get creation date from contact
        let createdDateStr: string | null = null
        if (contact.properties.createdate) {
          createdDateStr = contact.properties.createdate
        } else if (company?.properties.createdate) {
          createdDateStr = company.properties.createdate
        }
        
        if (createdDateStr) {
          const createdDate = new Date(createdDateStr)
          if (!isNaN(createdDate.getTime())) {
            if (startDate && createdDate < startDate) return false
            if (endDate && createdDate > endDate) return false
          }
        }
      }
      return true
    })
    .map((contact: any) => {
      const companyId = contact.associations?.companies?.results?.[0]?.id
      const company = companyId ? companiesMap.get(companyId) : null
      const ownerId = contact.properties.hubspot_owner_id
      const owner = ownerId ? ownersMap.get(ownerId) : null

      // Create contact name
      const contactName = `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim()
      const accountName = company?.properties.name || contact.properties?.company || contactName || "Unknown Account"
      
      // Get the lifecycle stage from HubSpot
      const lifecycleStage = contact.properties?.lifecyclestage || "unknown"
      
      // Assign estimated value based on lifecycle stage (more realistic for leads)
      let leadValue = "0"
      switch (lifecycleStage.toLowerCase()) {
        case 'customer':
          leadValue = "25000" // Customers have highest value
          break
        case 'salesqualifiedlead':
        case 'sql':
          leadValue = "10000" // SQLs have high potential value
          break
        case 'marketingqualifiedlead':
        case 'mql':
          leadValue = "5000" // MQLs have medium potential value
          break
        case 'lead':
          leadValue = "2000" // Basic leads have lower potential value
          break
        case 'subscriber':
          leadValue = "500" // Subscribers have minimal value
          break
        default:
          leadValue = "1000" // Default for unknown stages
      }

      let dateCreated = "N/A"
      if (contact.properties.createdate) {
        dateCreated = new Date(contact.properties.createdate).toLocaleDateString("en-US")
      } else if (company?.properties.createdate) {
        dateCreated = new Date(company.properties.createdate).toLocaleDateString("en-US")
      }

      const dateLastQuoted = contact.properties.lastmodifieddate
        ? new Date(contact.properties.lastmodifieddate).toLocaleDateString("en-US")
        : "N/A"

      const primaryRepName = owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || "N/A" : "N/A"

      let address = "N/A"
      if (company?.properties) {
        const { address: street, city, state, zip } = company.properties
        address = [street, city, state, zip].filter(Boolean).join(", ").trim() || "N/A"
      } else if (contact.properties) {
        const { city, state, country } = contact.properties
        address = [city, state, country].filter(Boolean).join(", ").trim() || "N/A"
      }

      // Extract source and attribution data
      const analyticsSource = contact.properties?.hs_analytics_source || "Unknown"
      const latestSource = contact.properties?.hs_latest_source || "Unknown"
      const sourceData1 = contact.properties?.hs_analytics_source_data_1 || ""
      const sourceData2 = contact.properties?.hs_analytics_source_data_2 || ""
      const firstTouchCampaign = contact.properties?.hs_analytics_first_touch_converting_campaign || ""
      const lastTouchCampaign = contact.properties?.hs_analytics_last_touch_converting_campaign || ""
      const firstUrl = contact.properties?.hs_analytics_first_url || ""
      const lastUrl = contact.properties?.hs_analytics_last_url || ""
      const numVisits = contact.properties?.hs_analytics_num_visits || "0"
      const numPageViews = contact.properties?.hs_analytics_num_page_views || "0"

      return {
        "Account ID": Number.parseInt(company?.id || contact.id, 10) || Math.floor(Math.random() * 1000000),
        "Account Name": accountName,
        Address: address,
        "Total Sales": leadValue,
        "Date Created": dateCreated,
        "Date Last Quoted": dateLastQuoted,
        "Primary Rep Name": primaryRepName,
        "Lifecycle Stage": lifecycleStage,
        // Source and attribution data
        "Analytics Source": analyticsSource,
        "Latest Source": latestSource,
        "Source Data 1": sourceData1,
        "Source Data 2": sourceData2,
        "First Touch Campaign": firstTouchCampaign,
        "Last Touch Campaign": lastTouchCampaign,
        "First URL": firstUrl,
        "Last URL": lastUrl,
        "Number of Visits": numVisits,
        "Number of Page Views": numPageViews,
      }
    })
}

const KNOWN_BRANDS_HS = ["Hospeco", "Indoff", "Triad", "Impact", "Legacy", "Acme", "Supply", "Corp", "LLC", "Inc"]
function extractBrandFromAccountNameHS(accountName: string): string {
  const lowerCaseName = accountName.toLowerCase()
  for (const brand of KNOWN_BRANDS_HS) {
    if (lowerCaseName.includes(brand.toLowerCase())) {
      if (
        ["LLC", "Inc", "Corp", "Group", "Brands"].includes(brand) &&
        lowerCaseName.split(brand.toLowerCase())[0].trim()
      ) {
        const potentialBrand = accountName
          .substring(0, lowerCaseName.indexOf(brand.toLowerCase()))
          .trim()
          .replace(/,$/, "")
          .trim()
        if (potentialBrand) return potentialBrand
      }
      return brand
    }
  }
  const words = accountName.split(/[\s,]+/)
  if (words.length > 0 && words[0].length > 2 && !["The", "A", "An"].includes(words[0])) return words[0]
  return "Other"
}

function processAccountDataInternal(data: AccountData[]): ProcessedData {
  const processed: ProcessedData = {
    totalAccounts: data.length,
    totalRevenue: 0,
    averageDealSize: 0,
    salesByRep: {},
    salesDistribution: { Negative: 0, "$0-$1K": 0, "$1K-$5K": 0, "$5K-$10K": 0, "$10K-$25K": 0, "$25K+": 0 },
    monthlyTrends: [],
    topStates: {},
    recentlyQuoted: 0,
    salesByBrand: {},
    topPerformingAccounts: [],
    leastPerformingAccounts: [],
    allAccounts: data,
    lifecycleStageDistribution: {},
    // Initialize new analytics properties
    trafficSourcePerformance: {},
    geographicDistribution: {},
    leadHealthScores: [],
    campaignPerformance: {},
    timeBasedInsights: {
      peakActivityHours: [],
      seasonalTrends: [],
      responseTimeMetrics: { avgResponseTime: 0, fastResponders: [], slowResponders: [] }
    },
    landingPagePerformance: {},
  }

  let totalSalesValue = 0
  const validSales: number[] = []

  data.forEach((row) => {
    const sales = parseCurrency(row["Total Sales"])
    if (!isFinite(sales) || isNaN(sales) || Math.abs(sales) > 1e12) return

    const rep = row["Primary Rep Name"] || "N/A"
    const brand = extractBrandFromAccountNameHS(row["Account Name"])
    const lifecycleStage = row["Lifecycle Stage"] || "unknown"

    totalSalesValue += sales
    if (sales > 0 && isFinite(sales) && Math.abs(sales) < 1e12) validSales.push(sales)

    // Count lifecycle stages
    if (!processed.lifecycleStageDistribution[lifecycleStage]) {
      processed.lifecycleStageDistribution[lifecycleStage] = 0
    }
    processed.lifecycleStageDistribution[lifecycleStage]++

    if (!processed.salesByRep[rep]) processed.salesByRep[rep] = { sales: 0, accounts: 0 }
    processed.salesByRep[rep].sales += sales
    processed.salesByRep[rep].accounts += 1

    if (!processed.salesByBrand[brand]) processed.salesByBrand[brand] = { sales: 0, accounts: 0 }
    processed.salesByBrand[brand].sales += sales
    processed.salesByBrand[brand].accounts += 1

    if (sales < 0) processed.salesDistribution["Negative"]++
    else if (sales <= 1000) processed.salesDistribution["$0-$1K"]++
    else if (sales <= 5000) processed.salesDistribution["$1K-$5K"]++
    else if (sales <= 10000) processed.salesDistribution["$5K-$10K"]++
    else if (sales <= 25000) processed.salesDistribution["$10K-$25K"]++
    else processed.salesDistribution["$25K+"]++

    const address = row["Address"] || ""
    const stateMatch = address.match(/\b([A-Z]{2})\b(?=,?\s*\d{5}(-\d{4})?$)/)
    if (stateMatch) {
      const state = stateMatch[1]
      if (!processed.topStates[state]) processed.topStates[state] = { accounts: 0, sales: 0 }
      processed.topStates[state].accounts += 1
      processed.topStates[state].sales += sales
    }

    if (row["Date Last Quoted"] && row["Date Last Quoted"] !== "N/A") {
      try {
        const lastQuotedDate = new Date(row["Date Last Quoted"])
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        if (!isNaN(lastQuotedDate.getTime()) && lastQuotedDate > ninetyDaysAgo) {
          processed.recentlyQuoted += 1
        }
      } catch (e) {}
    }
  })

  processed.totalRevenue = totalSalesValue
  processed.averageDealSize = calculateAverage(validSales)

  const monthCounts: Record<string, { accounts: number; revenue: number }> = {}
  data.forEach((row) => {
    const dateStr = row["Date Created"]
    if (dateStr && dateStr !== "N/A") {
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        if (!monthCounts[monthKey]) monthCounts[monthKey] = { accounts: 0, revenue: 0 }
        monthCounts[monthKey].accounts += 1
        monthCounts[monthKey].revenue += parseCurrency(row["Total Sales"])
      } catch (e) {}
    }
  })
  processed.monthlyTrends = Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, trendData]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      accounts: trendData.accounts,
      revenue: trendData.revenue,
    }))

  const sortedAccounts = [...data].sort((a, b) => parseCurrency(b["Total Sales"]) - parseCurrency(a["Total Sales"]))
  processed.topPerformingAccounts = sortedAccounts.slice(0, 5)
  processed.leastPerformingAccounts = sortedAccounts
    .filter((acc) => parseCurrency(acc["Total Sales"]) < 0)
    .slice(-5)
    .reverse()
  if (processed.leastPerformingAccounts.length < 5 && sortedAccounts.length > 0) {
    const lowestPositive = sortedAccounts
      .filter((acc) => parseCurrency(acc["Total Sales"]) >= 0)
      .slice(-(5 - processed.leastPerformingAccounts.length))
      .reverse()
    processed.leastPerformingAccounts = [...processed.leastPerformingAccounts, ...lowestPositive]
  }

  // Calculate traffic source performance
  data.forEach(account => {
    const source = normalizeTrafficSource(account["Analytics Source"] || account["Latest Source"] || "Unknown")
    const revenue = parseCurrency(account["Total Sales"])
    
    if (!processed.trafficSourcePerformance[source]) {
      processed.trafficSourcePerformance[source] = { leads: 0, revenue: 0, conversionRate: 0, avgDealSize: 0 }
    }
    
    processed.trafficSourcePerformance[source].leads++
    processed.trafficSourcePerformance[source].revenue += revenue
  })

  // Calculate conversion rates and avg deal sizes for each source
  Object.keys(processed.trafficSourcePerformance).forEach(source => {
    const sourceData = processed.trafficSourcePerformance[source]
    sourceData.avgDealSize = sourceData.leads > 0 ? sourceData.revenue / sourceData.leads : 0
    
    const sourceAccounts = data.filter(account => 
      normalizeTrafficSource(account["Analytics Source"] || account["Latest Source"] || "Unknown") === source
    )
    const sqlCount = sourceAccounts.filter(account => 
      account["Lifecycle Stage"]?.toLowerCase() === 'salesqualifiedlead'
    ).length
    sourceData.conversionRate = sourceAccounts.length > 0 ? (sqlCount / sourceAccounts.length) * 100 : 0
  })

  // Calculate geographic distribution
  data.forEach(account => {
    const address = account["Address"] || "Unknown"
    const stateMatch = address.match(/\b([A-Z]{2})\b(?=,?\s*\d{5}(-\d{4})?$)/)
    const state = stateMatch ? stateMatch[1] : "Unknown"
    const revenue = parseCurrency(account["Total Sales"])
    
    if (!processed.geographicDistribution[state]) {
      processed.geographicDistribution[state] = { leads: 0, revenue: 0 }
    }
    
    processed.geographicDistribution[state].leads++
    processed.geographicDistribution[state].revenue += revenue
  })

  // Calculate lead health scores
  processed.leadHealthScores = data.map(account => {
    const healthScore = calculateLeadHealthScore(account)
    const temperature = getLeadTemperature(healthScore)
    const riskLevel = getLeadRiskLevel(account)
    
    return {
      accountId: account["Account ID"],
      accountName: account["Account Name"],
      healthScore,
      temperature,
      riskLevel
    }
  }).sort((a, b) => b.healthScore - a.healthScore)

  // Calculate campaign performance
  data.forEach(account => {
    const campaign = account["Last Touch Campaign"] || account["First Touch Campaign"] || ""
    if (campaign && campaign.trim() && campaign !== "Unknown Campaign") {
      const revenue = parseCurrency(account["Total Sales"])
      
      if (!processed.campaignPerformance[campaign]) {
        processed.campaignPerformance[campaign] = { leads: 0, revenue: 0 }
      }
      
      processed.campaignPerformance[campaign].leads++
      processed.campaignPerformance[campaign].revenue += revenue
    }
  })

  // Calculate top landing pages (first URLs visited)
  const landingPagePerformance: Record<string, { leads: number; revenue: number; avgDealSize: number; sqlCount: number; conversionRate: number }> = {}
  
  data.forEach(account => {
    let firstUrl = account["First URL"] || ""
    if (firstUrl && firstUrl.trim()) {
      // Clean and normalize the URL for better grouping
      try {
        const url = new URL(firstUrl)
        const pathname = url.pathname
        
        // Group similar pages together
        let pageName = pathname
        if (pathname === "/" || pathname === "") {
          pageName = "Homepage"
        } else if (pathname.includes("/home")) {
          pageName = "Home Page"
        } else if (pathname.includes("/product")) {
          pageName = "Product Pages"
        } else if (pathname.includes("/about")) {
          pageName = "About Us"
        } else if (pathname.includes("/contact")) {
          pageName = "Contact Us"
        } else if (pathname.includes("/blog")) {
          pageName = "Blog"
        } else if (pathname.includes("/pricing")) {
          pageName = "Pricing"
        } else if (pathname.includes("/demo")) {
          pageName = "Demo/Trial"
        } else if (pathname.includes("/case-study") || pathname.includes("/case-studies")) {
          pageName = "Case Studies"
        } else if (pathname.includes("/resource")) {
          pageName = "Resources"
        } else {
          // Use the full path but limit length for display
          pageName = pathname.length > 30 ? pathname.substring(0, 30) + "..." : pathname
        }
        
        const revenue = parseCurrency(account["Total Sales"])
        const isSQL = account["Lifecycle Stage"]?.toLowerCase() === 'salesqualifiedlead'
        
        if (!landingPagePerformance[pageName]) {
          landingPagePerformance[pageName] = { leads: 0, revenue: 0, avgDealSize: 0, sqlCount: 0, conversionRate: 0 }
        }
        
        landingPagePerformance[pageName].leads++
        landingPagePerformance[pageName].revenue += revenue
        if (isSQL) landingPagePerformance[pageName].sqlCount++
        
      } catch (e) {
        // If URL parsing fails, use the raw URL but limit length
        const shortUrl = firstUrl.length > 40 ? firstUrl.substring(0, 40) + "..." : firstUrl
        const revenue = parseCurrency(account["Total Sales"])
        const isSQL = account["Lifecycle Stage"]?.toLowerCase() === 'salesqualifiedlead'
        
        if (!landingPagePerformance[shortUrl]) {
          landingPagePerformance[shortUrl] = { leads: 0, revenue: 0, avgDealSize: 0, sqlCount: 0, conversionRate: 0 }
        }
        
        landingPagePerformance[shortUrl].leads++
        landingPagePerformance[shortUrl].revenue += revenue
        if (isSQL) landingPagePerformance[shortUrl].sqlCount++
      }
    }
  })

  // Calculate averages and conversion rates for landing pages
  Object.keys(landingPagePerformance).forEach(page => {
    const pageData = landingPagePerformance[page]
    pageData.avgDealSize = pageData.leads > 0 ? pageData.revenue / pageData.leads : 0
    pageData.conversionRate = pageData.leads > 0 ? (pageData.sqlCount / pageData.leads) * 100 : 0
  })

  // Add landing page performance to processed data
  processed.landingPagePerformance = landingPagePerformance

  // Calculate peak activity hours (simplified)
  const hourActivity: Record<number, number> = {}
  data.forEach(account => {
    const created = account["Date Created"]
    if (created && created !== "N/A") {
      try {
        const date = new Date(created)
        const hour = date.getHours()
        hourActivity[hour] = (hourActivity[hour] || 0) + 1
      } catch (e) {}
    }
  })

  processed.timeBasedInsights.peakActivityHours = Object.entries(hourActivity)
    .map(([hour, activity]) => ({ hour: Number(hour), activity }))
    .sort((a, b) => b.activity - a.activity)
    .slice(0, 5)

  // Calculate seasonal trends
  const monthlyData: Record<string, { leads: number; revenue: number }> = {}
  data.forEach(account => {
    const created = account["Date Created"]
    if (created && created !== "N/A") {
      try {
        const date = new Date(created)
        const monthKey = date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        const revenue = parseCurrency(account["Total Sales"])
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { leads: 0, revenue: 0 }
        }
        
        monthlyData[monthKey].leads++
        monthlyData[monthKey].revenue += revenue
      } catch (e) {}
    }
  })

  processed.timeBasedInsights.seasonalTrends = Object.entries(monthlyData)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

  // Calculate response time metrics (simplified)
  const repsWithLeads: Record<string, number> = {}
  data.forEach(account => {
    const rep = account["Primary Rep Name"] || "Unknown"
    repsWithLeads[rep] = (repsWithLeads[rep] || 0) + 1
  })

  const sortedReps = Object.entries(repsWithLeads)
    .sort(([,a], [,b]) => b - a)

  processed.timeBasedInsights.responseTimeMetrics = {
    avgResponseTime: 24, // Placeholder
    fastResponders: sortedReps.slice(0, 3).map(([rep]) => rep),
    slowResponders: sortedReps.slice(-2).map(([rep]) => rep)
  }

  return processed
}

export async function fetchAndProcessHubSpotData(startDate?: Date, endDate?: Date): Promise<ProcessedData | null> {
  const apiKey = process.env.HUBSPOT_API_KEY?.trim()
  
  if (!apiKey) {
    throw new Error("HubSpot API key (HUBSPOT_API_KEY) is not configured in environment variables.")
  }

  const hubspotClient = new Client({ accessToken: apiKey })

  try {
    // Instead of deals, fetch contacts that are SQLs/MQLs
    const contactProperties = [
      "firstname", 
      "lastname", 
      "email", 
      "company", 
      "lifecyclestage", 
      "lead_status", 
      "hs_lead_status",
      "createdate", 
      "lastmodifieddate",
      "hubspot_owner_id",
      "city",
      "state",
      "country",
      "jobtitle",
      "phone",
      // Analytics and source tracking properties
      "hs_analytics_source",
      "hs_latest_source",
      "hs_analytics_source_data_1",
      "hs_analytics_source_data_2", 
      "hs_latest_source_data_1",
      "hs_latest_source_data_2",
      "hs_analytics_first_touch_converting_campaign",
      "hs_analytics_last_touch_converting_campaign",
      "hs_analytics_first_url",
      "hs_analytics_last_url",
      "hs_analytics_revenue",
      "hs_analytics_num_visits",
      "hs_analytics_num_page_views",
      "hs_analytics_average_page_views",
      "hs_analytics_first_visit_timestamp",
      "hs_analytics_last_visit_timestamp",
      "recent_conversion_event_name",
      "first_conversion_event_name",
      "hs_email_last_email_name",
      "hs_email_last_send_date",
      "hs_social_last_engagement"
    ]
    const companyProperties = ["name", "address", "city", "state", "zip", "createdate"]

    // Smart approach for 239K customers: Use Search API with date filters
    let allContacts: any[] = []
    
    console.log("🔍 Fetching contacts from HubSpot database (239K total customers)...")
    
    // If we have date filters for 2025, use Search API with date filters for efficiency
    if (startDate && startDate.getFullYear() >= 2025) {
      console.log("🎯 Using Search API to target 2025+ contacts directly (much faster than paginating 239K records)")
      
      try {
        let after: string | undefined = undefined
        let pageCount = 0
        const maxPages = 500 // Increased to ensure we get all 2025 data
        
        do {
          pageCount++
          console.log(`Searching 2025+ contacts page ${pageCount}...`)
          
          const searchRequest = {
            properties: contactProperties,
            limit: 100,
            after: after,
            filterGroups: [{
              filters: [{
                propertyName: "createdate",
                operator: "GTE",
                value: startDate.getTime().toString()
              }]
            }]
          }
          
          const contactsResponse = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest)
          
          allContacts.push(...contactsResponse.results)
          after = contactsResponse.paging?.next?.after
          
          console.log(`Search page ${pageCount}: Found ${contactsResponse.results.length} contacts`)
          
        } while (after && pageCount < maxPages)
        
        console.log(`✅ Search API found ${allContacts.length} contacts created since ${startDate.toDateString()}`)
        
      } catch (searchError: any) {
        console.log("⚠️ Search API failed, falling back to basic pagination:", searchError.message)
        
        // Fallback to basic pagination with reasonable limits
        let after: string | undefined = undefined
        let pageCount = 0
        const maxPages = 200 // Increased but reasonable for fallback
        
        do {
          pageCount++
          if (pageCount % 20 === 0) {
            console.log(`Fallback pagination page ${pageCount}... (${allContacts.length} contacts so far)`)
          }
          
          const contactsResponse = await hubspotClient.crm.contacts.basicApi.getPage(
            100,
            after,
            contactProperties,
            undefined,
            ["company"],
            false
          )
          
          allContacts.push(...contactsResponse.results)
          after = contactsResponse.paging?.next?.after
          
          if (pageCount % 20 === 0 || pageCount <= 10) {
            console.log(`Fallback page ${pageCount}: Found ${contactsResponse.results.length} contacts`)
          }
          
        } while (after && pageCount < maxPages)
      }
      
    } else {
      // No date filter or pre-2025 dates, use basic pagination
      console.log("📄 Using basic pagination (no 2025+ date filter)...")
      
      let after: string | undefined = undefined
      let pageCount = 0
             const maxPages = 500 // Increased to 50,000 contacts for better 2025 data coverage
      
      do {
        pageCount++
        if (pageCount % 20 === 0) {
          console.log(`Fetching contacts page ${pageCount}... (${allContacts.length} contacts so far)`)
        }
        
        const contactsResponse = await hubspotClient.crm.contacts.basicApi.getPage(
          100,
          after,
          contactProperties,
          undefined,
          ["company"],
          false
        )
        
        allContacts.push(...contactsResponse.results)
        after = contactsResponse.paging?.next?.after
        
        if (pageCount % 20 === 0 || pageCount <= 10) {
          console.log(`Page ${pageCount}: Found ${contactsResponse.results.length} contacts`)
        }
        
      } while (after && pageCount < maxPages)
    }
    
    console.log(`✅ Total contacts found: ${allContacts.length}`)
    
    // Note: Detailed pagination info logged during fetch process above
    
    // Filter for SQLs and MQLs
    const qualifiedLeads = allContacts.filter(contact => {
      const lifecycleStage = contact.properties?.lifecyclestage?.toLowerCase()
      const leadStatus = contact.properties?.lead_status?.toLowerCase()
      const hsLeadStatus = contact.properties?.hs_lead_status?.toLowerCase()
      
      return (
        lifecycleStage === 'salesqualifiedlead' ||
        lifecycleStage === 'marketingqualifiedlead' ||
        lifecycleStage === 'sql' ||
        lifecycleStage === 'mql' ||
        leadStatus === 'sales qualified lead' ||
        leadStatus === 'marketing qualified lead' ||
        leadStatus === 'sql' ||
        leadStatus === 'mql' ||
        hsLeadStatus === 'sales qualified lead' ||
        hsLeadStatus === 'marketing qualified lead' ||
        hsLeadStatus === 'sql' ||
        hsLeadStatus === 'mql'
      )
    })
    
    console.log(`📊 Found ${qualifiedLeads.length} qualified leads (SQLs/MQLs) out of ${allContacts.length} total contacts`)
    
    // Only fall back to CSV if we have absolutely no qualified leads from HubSpot
    if (qualifiedLeads.length === 0) {
      console.log('⚠️ No qualified leads found in HubSpot, falling back to CSV data...')
      return processCSVData(startDate, endDate)
    }
    
    // Add debug info about the leads we found
    if (qualifiedLeads.length > 0) {
      console.log("Sample qualified leads:", qualifiedLeads.slice(0, 5).map(contact => ({
        id: contact.id,
        name: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim(),
        email: contact.properties?.email,
        company: contact.properties?.company,
        lifecycleStage: contact.properties?.lifecyclestage,
        leadStatus: contact.properties?.lead_status,
        createdate: contact.properties?.createdate,
        lastmodifieddate: contact.properties?.lastmodifieddate
      })))
      
      // Debug: Show available date fields
      console.log("Available date fields in first contact:", Object.keys(qualifiedLeads[0].properties || {}).filter(key => 
        key.includes('date') || key.includes('time') || key.includes('created') || key.includes('modified')
      ))
    }
    
    // Show lifecycle stage distribution
    const lifecycleStages: Record<string, number> = {}
    const yearDistribution: Record<string, number> = {}
    
    allContacts.forEach(contact => {
      const stage = contact.properties?.lifecyclestage || 'unknown'
      lifecycleStages[stage] = (lifecycleStages[stage] || 0) + 1
      
      // Analyze date distribution
      const createDate = contact.properties?.createdate
      if (createDate) {
        try {
          const year = new Date(createDate).getFullYear().toString()
          yearDistribution[year] = (yearDistribution[year] || 0) + 1
        } catch (e) {
          // ignore invalid dates
        }
      }
    })
    
    console.log("📈 Lifecycle stage distribution:", lifecycleStages)
    console.log("📅 Year distribution of contacts:", yearDistribution)
    
    // Show month distribution for SQLs specifically 
    const sqlMonthDistribution: Record<string, number> = {}
    allContacts.filter(contact => 
      contact.properties?.lifecyclestage?.toLowerCase() === 'salesqualifiedlead'
    ).forEach(contact => {
      const createDate = contact.properties?.createdate
      if (createDate) {
        try {
          const date = new Date(createDate)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          sqlMonthDistribution[monthKey] = (sqlMonthDistribution[monthKey] || 0) + 1
        } catch (e) {
          // ignore invalid dates
        }
      }
    })
    console.log("📊 Sales Qualified Leads by month:", sqlMonthDistribution)
    
    // Show date range info for debugging
    if (startDate || endDate) {
      console.log("🗓️ Date filtering applied:", {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        totalContactsBeforeFilter: allContacts.length,
        qualifiedLeadsBeforeFilter: qualifiedLeads.length
      })
      
      // Note: Using HubSpot data for all date ranges - CSV fallback removed
    }
    
    // Apply date filtering if dates are provided
    let filteredLeads = qualifiedLeads
    if (startDate || endDate) {
      filteredLeads = qualifiedLeads.filter((contact) => {
        const createDate = contact.properties?.createdate
        if (!createDate) return false
        
        const contactDate = new Date(createDate)
        if (isNaN(contactDate.getTime())) return false
        
        // Apply date range filtering
        if (startDate && contactDate < startDate) return false
        if (endDate && contactDate > endDate) return false
        
        return true
      })
      
      console.log(`🔍 Date filtering: ${qualifiedLeads.length} → ${filteredLeads.length} qualified leads`)
      
      // Continue with HubSpot data regardless of count after filtering
    }
    
    const contacts = filteredLeads

    const companyIds = new Set<string>()
    const ownerIds = new Set<string>()
    contacts.forEach((contact) => {
      contact.associations?.companies?.results?.forEach((assoc: any) => companyIds.add(assoc.id))
      if (contact.properties.hubspot_owner_id) ownerIds.add(contact.properties.hubspot_owner_id)
    })

    const companiesMap = new Map<string, SimplePublicObject>()
    for (const id of Array.from(companyIds)) {
      try {
        const company = await hubspotClient.crm.companies.basicApi.getById(id, companyProperties)
        companiesMap.set(id, company)
      } catch (e) {
        console.warn(`Failed to fetch company ${id}:`, e)
      }
    }

    const ownersMap = new Map<string, any>()
    for (const id of Array.from(ownerIds)) {
      try {
        const owner = await hubspotClient.crm.owners.ownersApi.getById(Number(id))
        ownersMap.set(id, owner)
      } catch (e) {
        console.warn(`Failed to fetch owner ${id}:`, e)
      }
    }

    const accountDataList = transformHubSpotDataToAccountData(contacts, companiesMap, ownersMap, startDate, endDate)
    

    
    const processedData = processAccountDataInternal(accountDataList)

    return processedData
  } catch (e: any) {
    console.error("❌ HubSpot API Error:", e)
    console.error("Error details:", e.message)
    return null
  }
}

// Export CSV processing function for direct use
export async function fetchAndProcessCSVData(startDate?: Date, endDate?: Date): Promise<ProcessedData> {
  return processCSVData(startDate, endDate)
}

// Helper functions for advanced analytics
function normalizeTrafficSource(source: string): string {
  if (!source || source === "Unknown") return "Unknown"
  const normalized = source.toLowerCase()
  if (normalized.includes("organic") || normalized.includes("seo")) return "Organic Search"
  if (normalized.includes("paid") || normalized.includes("cpc") || normalized.includes("adwords")) return "Paid Search"
  if (normalized.includes("social") || normalized.includes("facebook") || normalized.includes("linkedin")) return "Social Media"
  if (normalized.includes("email")) return "Email Marketing"
  if (normalized.includes("direct")) return "Direct Traffic"
  if (normalized.includes("referral")) return "Referral"
  if (normalized.includes("offline")) return "Offline"
  return source
}

function calculateLeadHealthScore(account: AccountData): number {
  let score = 50
  const source = account["Analytics Source"] || "Unknown"
  if (source.includes("Organic Search")) score += 15
  else if (source.includes("Paid Search")) score += 10
  else if (source.includes("Referral")) score += 20
  
  const visits = Number(account["Number of Visits"] || 0)
  if (visits > 5) score += 15
  else if (visits > 2) score += 10
  
  const stage = account["Lifecycle Stage"]?.toLowerCase() || ""
  if (stage === "salesqualifiedlead") score += 25
  else if (stage === "marketingqualifiedlead") score += 15
  else if (stage === "customer") score += 30
  
  return Math.max(0, Math.min(100, score))
}

function getLeadTemperature(healthScore: number): string {
  if (healthScore >= 80) return "🔥 Hot"
  if (healthScore >= 60) return "🌡️ Warm"
  if (healthScore >= 40) return "❄️ Cool"
  return "🧊 Cold"
}

function getLeadRiskLevel(account: AccountData): string {
  const created = account["Date Created"]
  if (!created || created === "N/A") return "Unknown"
  try {
    const createDate = new Date(created)
    const daysSinceCreated = (Date.now() - createDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreated > 60) return "🚨 High Risk"
    if (daysSinceCreated > 30) return "⚠️ Medium Risk"
    return "✅ Low Risk"
  } catch (e) {
    return "Unknown"
  }
}

function calculateTimeBasedInsights(accountData: AccountData[]) {
  // Calculate peak activity hours (simplified - based on creation times)
  const hourActivity: Record<number, number> = {}
  
  accountData.forEach(account => {
    const created = account["Date Created"]
    if (created && created !== "N/A") {
      try {
        const date = new Date(created)
        const hour = date.getHours()
        hourActivity[hour] = (hourActivity[hour] || 0) + 1
      } catch (e) {}
    }
  })
  
  const peakActivityHours = Object.entries(hourActivity)
    .map(([hour, activity]) => ({ hour: Number(hour), activity }))
    .sort((a, b) => b.activity - a.activity)
    .slice(0, 5)
  
  // Calculate seasonal trends
  const monthlyData: Record<string, { leads: number; revenue: number }> = {}
  
  accountData.forEach(account => {
    const created = account["Date Created"]
    if (created && created !== "N/A") {
      try {
        const date = new Date(created)
        const monthKey = date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        const revenue = parseCurrency(account["Total Sales"])
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { leads: 0, revenue: 0 }
        }
        
        monthlyData[monthKey].leads++
        monthlyData[monthKey].revenue += revenue
      } catch (e) {}
    }
  })
  
  const seasonalTrends = Object.entries(monthlyData)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
  
  // Simplified response time metrics
  const repsWithLeads: Record<string, number> = {}
  accountData.forEach(account => {
    const rep = account["Primary Rep Name"] || "Unknown"
    repsWithLeads[rep] = (repsWithLeads[rep] || 0) + 1
  })
  
  const sortedReps = Object.entries(repsWithLeads)
    .sort(([,a], [,b]) => b - a)
  
  return {
    peakActivityHours,
    seasonalTrends,
    responseTimeMetrics: {
      avgResponseTime: 24, // Placeholder - would need actual response data
      fastResponders: sortedReps.slice(0, 3).map(([rep]) => rep),
      slowResponders: sortedReps.slice(-2).map(([rep]) => rep)
    }
  }
}
