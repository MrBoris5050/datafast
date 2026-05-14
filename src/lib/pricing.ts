import { UserRole } from '@prisma/client'

type PlanWithRolePrices = {
  price?: any
  priceCustomer?: any
  priceAgent?: any
  priceWholesaler?: any
  priceDealer?: any
}

const resolvePrice = (values: Array<any>): number => {
  const price = values.find((value) => value !== undefined && value !== null)
  return Number(price ?? 0)
}

export function getPlanPriceForRole(plan: PlanWithRolePrices, role: UserRole): number {
  switch (role) {
    case 'ADMIN':
    case 'CUSTOMER':
      return resolvePrice([plan.priceCustomer, plan.price])
    case 'AGENT':
      return resolvePrice([plan.priceAgent, plan.priceCustomer, plan.price])
    case 'WHOLESALER':
      return resolvePrice([plan.priceWholesaler, plan.priceDealer, plan.priceCustomer, plan.price])
    case 'DEALER':
      return resolvePrice([plan.priceDealer, plan.priceWholesaler, plan.priceCustomer, plan.price])
    default:
      return resolvePrice([plan.priceCustomer, plan.price])
  }
}


