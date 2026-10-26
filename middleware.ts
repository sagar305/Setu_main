import { NextResponse, type NextRequest } from "next/server";

// The TB Analyser loads its assets by relative path, so it only works at
// /products/tb-analyzer/app/. A redirect in next.config.js cannot add the
// slash, because its matching treats a trailing slash as optional and would
// redirect the slashed URL to itself; here the exact path is visible.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/products/tb-analyzer/app") {
    // A plain URL, not nextUrl.clone(): NextURL drops the trailing slash again.
    const url = new URL(`/products/tb-analyzer/app/${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/products/tb-analyzer/app",
};
