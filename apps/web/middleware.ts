import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Authentication disabled for development
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|static|favicon.ico).*)'],
};
