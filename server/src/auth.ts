import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET

if (!secret) {
  throw new Error('JWT_SECRET is not set. Refusing to start without a signing secret.')
}

// Narrowed for the rest of the module now that we've asserted it is present.
export const JWT_SECRET: string = secret

export type AuthUser = {
  id: number
  email: string
  name: string
  role: string
}

/**
 * Verify a bearer token's signature and return its payload, or null if the
 * token is missing/invalid. Uses jwt.verify (not jwt.decode) so a forged or
 * tampered token is rejected.
 */
export function verifyToken(token: string | undefined | null): AuthUser | null {
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser
  } catch {
    return null
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' })
}

export function bearerFromHeader(req: Request): string | null {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  return token || null
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const user = verifyToken(bearerFromHeader(req))
  if (!user) {
    return res.status(401).json({ error: 'Invalid or missing token' })
  }
  ;(req as any).user = user
  next()
}
