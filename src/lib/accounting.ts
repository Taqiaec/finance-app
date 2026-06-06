import type { JournalLineType } from './types'

export interface DraftLine {
  id: string
  account_id: string
  type: JournalLineType
  amount: number
}

export function calcTotalByType(lines: DraftLine[], type: JournalLineType): number {
  return lines
    .filter((l) => l.type === type)
    .reduce((sum, l) => sum + l.amount, 0)
}

export function calcDebitTotal(lines: DraftLine[]): number {
  return calcTotalByType(lines, 'debit')
}

export function calcCreditTotal(lines: DraftLine[]): number {
  return calcTotalByType(lines, 'credit')
}

export function isBalanced(lines: DraftLine[]): boolean {
  return calcDebitTotal(lines) === calcCreditTotal(lines) && lines.length >= 2
}

export function hasValidLines(lines: DraftLine[]): boolean {
  return (
    lines.length >= 2 &&
    lines.every((l) => l.account_id !== '' && l.amount > 0) &&
    lines.some((l) => l.type === 'debit') &&
    lines.some((l) => l.type === 'credit')
  )
}
