import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { configuredAuthorizedParties } from '@/auth/authorized-parties';

const authenticatedProxy = clerkMiddleware({
  authorizedParties: configuredAuthorizedParties({
    webOrigin: process.env.WIP_WEB_ORIGIN,
    extensionOrigins: process.env.WIP_EXTENSION_ORIGINS,
  }),
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
