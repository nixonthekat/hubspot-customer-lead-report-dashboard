"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AccountData } from "@/lib/types"

// --- Helper functions (previously in improved-number-handling.ts) ---
const parseCurrency = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return !isNaN(value) && isFinite(value) ? value : 0
  if (!value) return 0
  const cleaned = String(value).replace(/[$,\s]/g, "")
  const num = Number.parseFloat(cleaned)
  return !isNaN(num) && isFinite(num) ? num : 0
}

const formatCurrency = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return "$0.00" // Default for modal, more precise
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2, // Ensure two decimal places for modal
    maximumFractionDigits: 2,
  }).format(value)
}
// --- End Helper functions ---

interface RepAccountDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  repName: string
  accounts: AccountData[]
}

export default function RepAccountDetailsModal({ isOpen, onClose, repName, accounts }: RepAccountDetailsModalProps) {
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Top Accounts for {repName}</DialogTitle>
          <DialogDescription>
            Showing top performing accounts managed by {repName}, sorted by total sales.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
                <TableHead>Date Created</TableHead>
                <TableHead>Last Quoted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <TableRow key={account["Account ID"]}>
                    <TableCell className="font-medium truncate max-w-[200px]">{account["Account Name"]}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(parseCurrency(account["Total Sales"]))}
                    </TableCell>
                    <TableCell>{account["Date Created"]}</TableCell>
                    <TableCell>{account["Date Last Quoted"] !== "N/A" ? account["Date Last Quoted"] : "-"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No accounts found for this representative.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
