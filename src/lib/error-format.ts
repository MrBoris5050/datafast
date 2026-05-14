/**
 * Utility functions for formatting API errors into clean, user-friendly messages
 */

/**
 * Strips ANSI color codes from error messages
 */
function stripAnsiCodes(str: string): string {
  // Remove ANSI escape sequences (color codes, formatting, etc.)
  return str.replace(/\u001b\[[0-9;]*m/g, '')
}

/**
 * Formats Prisma errors into clean, user-friendly messages
 */
export function formatPrismaError(error: any): string {
  if (!error) return 'An unexpected error occurred'

  const errorCode = error.code
  const errorMessage = error.message || String(error)

  // Handle specific Prisma error codes
  switch (errorCode) {
    case 'P2002':
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field'
      return `A record with this ${field} already exists`
    
    case 'P2003':
      // Foreign key constraint violation
      return 'Referenced record does not exist'
    
    case 'P2025':
      // Record not found
      return 'Record not found'
    
    case 'P1001':
      // Can't reach database server
      return 'Database connection failed. Please try again later'
    
    case 'P1008':
      // Operations timed out
      return 'Database operation timed out. Please try again'
    
    case 'P1017':
      // Server has closed the connection
      return 'Database connection was closed. Please try again'
    
    default:
      // For other errors, clean up the message
      let cleanMessage = stripAnsiCodes(errorMessage)
      
      // Remove file paths and line numbers
      cleanMessage = cleanMessage.replace(/[A-Z]:\\[^\s]+/g, '')
      cleanMessage = cleanMessage.replace(/\/[^\s]+/g, '')
      cleanMessage = cleanMessage.replace(/:\d+:\d+/g, '')
      
      // Extract meaningful parts
      // Look for common patterns like "Unique constraint failed on the fields: (`field`)"
      const uniqueConstraintMatch = cleanMessage.match(/Unique constraint failed on the fields: \(`([^`]+)`\)/i)
      if (uniqueConstraintMatch) {
        return `A record with this ${uniqueConstraintMatch[1]} already exists`
      }
      
      // Look for "Record to update not found"
      if (cleanMessage.includes('Record to update not found')) {
        return 'Record not found'
      }
      
      // Look for "Record to delete does not exist"
      if (cleanMessage.includes('Record to delete does not exist')) {
        return 'Record not found'
      }
      
      // Remove excessive whitespace and newlines
      cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim()
      
      // If message is still too long or contains technical details, return generic message
      if (cleanMessage.length > 200 || cleanMessage.includes('invocation') || cleanMessage.includes('Prisma')) {
        return 'A database error occurred. Please try again or contact support if the issue persists'
      }
      
      return cleanMessage || 'An unexpected error occurred'
  }
}

/**
 * Formats any error into a clean, user-friendly message
 */
export function formatError(error: any): string {
  if (!error) return 'An unexpected error occurred'

  // Handle Prisma errors
  if (error.code && error.code.startsWith('P')) {
    return formatPrismaError(error)
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message || String(error)
    const cleanMessage = stripAnsiCodes(message)
    
    // Remove technical details
    if (cleanMessage.includes('invocation') || cleanMessage.includes('Prisma')) {
      return formatPrismaError(error)
    }
    
    return cleanMessage
  }

  // Handle string errors
  if (typeof error === 'string') {
    return stripAnsiCodes(error)
  }

  // Fallback
  return 'An unexpected error occurred'
}

/**
 * Gets appropriate HTTP status code for an error
 */
export function getErrorStatusCode(error: any): number {
  if (!error) return 500

  const errorCode = error.code

  // Prisma error codes
  switch (errorCode) {
    case 'P2002': // Unique constraint
    case 'P2003': // Foreign key constraint
      return 409 // Conflict
    
    case 'P2025': // Record not found
      return 404
    
    case 'P1001': // Can't reach database
    case 'P1008': // Timeout
    case 'P1017': // Connection closed
      return 503 // Service Unavailable
    
    default:
      // Check error message for common patterns
      const message = String(error.message || error).toLowerCase()
      if (message.includes('not found') || message.includes('does not exist')) {
        return 404
      }
      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return 401
      }
      if (message.includes('insufficient') || message.includes('invalid')) {
        return 400
      }
      return 500
  }
}


