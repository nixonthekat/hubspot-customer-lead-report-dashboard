"use server"

import { Client } from "@hubspot/api-client"
import type { SimplePublicObject } from "@hubspot/api-client/lib/codegen/crm/companies" // Or other relevant types
import type { AccountData, ProcessedData } from "../../types"

// --- Helper functions (previously in improved-number-handling.ts) ---
const safeParseCurrency = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return !isNaN(value) && isFinite(value) ? value : 0
  if (!value) return 0
  const cleaned = String(value).replace(/[$,\s]/g, "")
  const num = Number.parseFloat(cleaned)
  return !isNaN(num) && isFinite(num) ? num : 0
}

const safeAverage = (arr: number[]): number => {
  if (!arr || arr.length === 0) return 0
  const validValues = arr.filter((val) => !isNaN(val) && isFinite(val))
  if (validValues.length === 0) return 0
  const sum = validValues.reduce((a, b) => a + b, 0)
  return sum / validValues.length
}
// --- End Helper functions ---

// --- Data Transformation: HubSpot to AccountData ---
function transformHubSpotDataToAccountData(
  deals: any[], // Replace 'any' with specific HubSpot deal types if available
  companiesMap: Map<string, SimplePublicObject>,
  ownersMap: Map<string, any>, // Replace 'any' with specific HubSpot owner types
): AccountData[] {
  return deals
    .filter((deal) => deal.properties.dealstage === "closedwon") // Consider only 'Closed Won' deals for sales
    .map((deal) => {
      const companyId = deal.associations?.companies?.results?.[0]?.id
      const company = companyId ? companiesMap.get(companyId) : null
      const ownerId = deal.properties.hubspot_owner_id
      const owner = ownerId ? ownersMap.get(ownerId) : null

      const accountName = company?.properties.name || deal.properties.dealname || "Unknown Account"
      const totalSales = deal.properties.amount || "0"

      let dateCreated = "N/A"
      if (company?.properties.createdate) {
        dateCreated = new Date(company.properties.createdate).toLocaleDateString("en-US")
      } else if (deal.properties.createdate) {
        dateCreated = new Date(deal.properties.createdate).toLocaleDateString("en-US")
      }

      const dateLastQuoted = deal.properties.closedate
        ? new Date(deal.properties.closedate).toLocaleDateString("en-US")
        : "N/A"

      const primaryRepName = owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || "N/A" : "N/A"

      let address = "N/A"
      if (company?.properties) {
        const { address: street, city, state, zip } = company.properties
        address = [street, city, state, zip].filter(Boolean).join(", ").trim() || "N/A"
      }

      return {
        "Account ID": Number.parseInt(company?.id || deal.id, 10) || Math.floor(Math.random() * 1000000),
        "Account Name": accountName,
        Address: address,
        "Total Sales": totalSales,
        "Date Created": dateCreated,
        "Date Last Quoted": dateLastQuoted,
        "Primary Rep Name": primaryRepName,
      } as AccountData
    })
}

// --- Brand Extraction Logic (reused) ---
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

// --- Core Data Processing Logic (reused and generalized) ---
function processAccountDataInternal(
  data: AccountData[],
  parseCurrency: (value: string) => number,
  extractBrand: (name: string) => string,
): ProcessedData {
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
  }

  let totalSalesValue = 0
  const validSales: number[] = []

  data.forEach((row) => {
    const sales = parseCurrency(row["Total Sales"])
    if (!isFinite(sales) || isNaN(sales) || Math.abs(sales) > 1e12) return

    const rep = row["Primary Rep Name"] || "N/A"
    const brand = extractBrand(row["Account Name"])

    totalSalesValue += sales
    if (sales > 0 && isFinite(sales) && Math.abs(sales) < 1e12) validSales.push(sales)

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
      } catch (e) {
        /* ignore invalid dates */
      }
    }
  })

  processed.totalRevenue = totalSalesValue
  processed.averageDealSize = safeAverage(validSales)

  const monthCounts: Record<string, { accounts: number; revenue: number }> = {}
  data.forEach((row) => {
    const dateStr = row["Date Created"]
    if (dateStr && dateStr !== "N/A") {
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return // Skip invalid dates
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        if (!monthCounts[monthKey]) monthCounts[monthKey] = { accounts: 0, revenue: 0 }
        monthCounts[monthKey].accounts += 1
        monthCounts[monthKey].revenue += parseCurrency(row["Total Sales"])
      } catch (e) {
        /* Skip invalid dates */
      }
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
  return processed
}

// --- Main Server Action ---
export async function fetchAndProcessHubSpotData(): Promise<ProcessedData | null> {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    console.error("HubSpot API key (HUBSPOT_API_KEY) is not configured in environment variables.")
    return null
  }

  const hubspotClient = new Client({ apiKey })

  try {
    const dealProperties = ["dealname", "amount", "closedate", "createdate", "dealstage", "hubspot_owner_id"]
    const companyProperties = ["name", "address", "city", "state", "zip", "createdate"]
    const ownerProperties = ["firstName", "lastName", "email"] // email might not be needed for display

    // 1. Fetch Deals with associations
    const dealsResponse = await hubspotClient.crm.deals.basicApi.getPage(100, undefined, dealProperties, undefined, [
      "company",
      "owner",
    ])
    const deals = dealsResponse.results

    // 2. Collect associated Company and Owner IDs
    const companyIds = new Set<string>()
    const ownerIds = new Set<string>()
    deals.forEach((deal) => {
      deal.associations?.companies?.results?.forEach((assoc) => companyIds.add(assoc.id))
      if (deal.properties.hubspot_owner_id) ownerIds.add(deal.properties.hubspot_owner_id)
    })

    // 3. Batch Fetch Companies (simplified: one by one, consider batch API for production)
    const companiesMap = new Map<string, SimplePublicObject>()
    for (const id of Array.from(companyIds)) {
      try {
        const company = await hubspotClient.crm.companies.basicApi.getById(id, companyProperties)
        companiesMap.set(id, company)
      } catch (e) {
        console.warn(`Failed to fetch company ${id}:`, e)
      }
    }

    // 4. Batch Fetch Owners (simplified: one by one)
    const ownersMap = new Map<string, any>()
    for (const id of Array.from(ownerIds)) {
      try {
        // Owner IDs from deals are strings, but HubSpot API expects number for getById
        const owner = await hubspotClient.crm.owners.ownersApi.getById(Number(id))
        ownersMap.set(id, owner)
      } catch (e) {
        console.warn(`Failed to fetch owner ${id}:`, e)
      }
    }

    // 5. Transform HubSpot data to AccountData structure
    const accountDataList = transformHubSpotDataToAccountData(deals, companiesMap, ownersMap)

    // 6. Process AccountData to get ProcessedData
    const processedData = processAccountDataInternal(accountDataList, safeParseCurrency, extractBrandFromAccountNameHS)

    return processedData
  } catch (e: any) {
    console.error("Error fetching or processing HubSpot data:", e.message)
    if (e.cause) console.error("Cause:", e.cause)
    return null
  }
}
