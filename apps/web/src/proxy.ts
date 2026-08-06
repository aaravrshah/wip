import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const configuredWebOrigin = process.env.WIP_WEB_ORIGIN ?? 'http://localhost:3000';
const configuredExtensionOrigins = (process.env.WIP_EXTENSION_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const authenticatedProxy = clerkMiddleware({
  authorizedParties: [configuredWebOrigin, ...configuredExtensionOrigins],
});

export default process.env.WIP_DATA_SOURCE === 'neon'
  ? authenticatedProxy
  : function demoProxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
